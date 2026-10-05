import { PROVIDER_IDS, type ProviderId } from '@tran/core';
import type { ChannelLike, VaultMessage } from './channel';
import { ITERATIONS, aadFor, open, seal, toBytes, type Box } from './crypto';
import {
	LOCK_MIN_LENGTH,
	cooldownFor,
	createLock,
	exportDek,
	importDek,
	rewrap,
	unwrapDek,
	type VaultLockRecord
} from './lock';
import type { KeyRow, MetaRow, SecretsDb } from './secrets-db';

// The key vault. Three stores behind one API:
// - session: sessionStorage[SESSION_KEY] (per tab, the default), mirrored in an in-memory Map
// - remember: the separate 'tran-secrets' IndexedDB (opt-in), never the main data DB
// - meta: the 'mode' row and the 'vault' passphrase-lock row (lock.ts)
// With a passphrase lock, remembered rows hold only a sealed box. The data key (DEK) that opens
// them lives in this tab's memory and sessionStorage[DEK_STASH_KEY] while unlocked, so a reload of
// the same tab stays unlocked and a new tab or browser session starts locked.
// Rules: every thrown error is a VaultError with a fixed code (no interpolation, never key text);
// events and broadcasts carry only kinds and provider ids; nothing here logs (lint-enforced).

export type KeyState = 'none' | 'session' | 'remembered' | 'locked';

export interface VaultStatus {
	mode: 'session' | 'remember';
	hasLock: boolean;
	/** True when a passphrase lock exists and this tab does not hold the data key. */
	locked: boolean;
	/** Epoch ms until which unlock attempts are refused; null when no cooldown is running. */
	cooldownUntil: number | null;
	storageBlocked: boolean;
	/** last4 is present only when the key is readable. */
	providers: Record<ProviderId, { state: KeyState; last4?: string }>;
}

export type VaultEvent = {
	kind: 'keys-changed' | 'mode-changed' | 'forgotten' | 'locked' | 'unlocked' | 'lock-changed';
	provider?: ProviderId;
	remote: boolean;
};

export type VaultErrorCode =
	| 'empty-key'
	| 'invalid-key'
	| 'vault-locked'
	| 'storage-blocked'
	| 'wrong-passphrase'
	| 'cooldown'
	| 'no-lock'
	| 'too-short'
	| 'corrupt';

export class VaultError extends Error {
	constructor(readonly code: VaultErrorCode) {
		super(code);
		this.name = 'VaultError';
	}
}

export interface VaultDeps {
	session: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
	openDb: () => SecretsDb;
	channel: ChannelLike | null;
	/** PBKDF2 iterations for a NEW lock. Default ITERATIONS; tests inject 1000. */
	iterations?: number;
	/** Default Date.now. */
	now?: () => number;
	/** Default crypto.randomUUID(). */
	tabId?: string;
}

export const SESSION_KEY = 'tran.vault.session.v1';
/** This tab's copy of the raw data key while unlocked (base64). Removed by lock and forget-all. */
export const DEK_STASH_KEY = 'tran.vault.dek.v1';

const MODE_ROW = 'mode';
const VAULT_ROW = 'vault';
const isProvider = (p: unknown): p is ProviderId =>
	typeof p === 'string' && (PROVIDER_IDS as readonly string[]).includes(p);

const isBytes = (x: unknown): x is Uint8Array => x instanceof Uint8Array;
const isBox = (x: unknown): x is Box =>
	!!x && typeof x === 'object' && isBytes((x as Box).iv) && isBytes((x as Box).ct);
/** Copy at the IndexedDB read boundary. */
const boxOf = (b: Box): Box => ({ iv: toBytes(b.iv), ct: toBytes(b.ct) });

/** Validates the raw 'vault' meta row; anything malformed is treated as no lock. */
function lockOf(row: MetaRow | undefined): VaultLockRecord | null {
	if (!row || row.v !== 1 || row.kdf !== 'PBKDF2-SHA256') return null;
	if (typeof row.iterations !== 'number' || !isBytes(row.salt) || !isBox(row.wrapped)) return null;
	return {
		id: 'vault',
		v: 1,
		kdf: 'PBKDF2-SHA256',
		iterations: row.iterations,
		salt: toBytes(row.salt),
		wrapped: boxOf(row.wrapped),
		failedAttempts: typeof row.failedAttempts === 'number' ? row.failedAttempts : 0,
		cooldownUntil: typeof row.cooldownUntil === 'number' ? row.cooldownUntil : null
	};
}

const metaOf = (record: VaultLockRecord): MetaRow => ({ ...record });

type Source = 'session' | 'remembered';

export class Vault {
	readonly #session: VaultDeps['session'];
	readonly #openDb: VaultDeps['openDb'];
	readonly #channel: ChannelLike | null;
	readonly #tabId: string;
	readonly iterations: number;
	readonly now: () => number;

	#db: SecretsDb | null = null;
	#mode: 'session' | 'remember' = 'session';
	#storageBlocked = false;
	/** Read cache for readable keys. */
	readonly #memory = new Map<ProviderId, string>();
	/** Where each readable key lives. */
	readonly #source = new Map<ProviderId, Source>();
	/** Providers that have a sealed row but no readable copy. */
	readonly #sealed = new Set<ProviderId>();
	readonly #listeners = new Set<(e: VaultEvent) => void>();
	/** The passphrase-lock record (cached; the DB row is the source of truth). */
	#lock: VaultLockRecord | null = null;
	/** The data key; present only while this tab is unlocked. */
	#dek: CryptoKey | null = null;
	#disposed = false;

	constructor(deps: VaultDeps) {
		this.#session = deps.session;
		this.#openDb = deps.openDb;
		this.#channel = deps.channel;
		this.#tabId = deps.tabId ?? crypto.randomUUID();
		this.iterations = deps.iterations ?? ITERATIONS;
		this.now = deps.now ?? Date.now;
	}

	async init(): Promise<void> {
		this.#loadSession();
		try {
			const db = this.#openDb();
			await db.open();
			this.#db = db;
		} catch {
			// Blocked or unavailable IndexedDB: keys stay session-only for this tab.
			this.#db = null;
			this.#storageBlocked = true;
		}
		await this.#loadRemembered();
		this.#channel?.addEventListener('message', (e) => {
			void this.#onMessage(e.data);
		});
	}

	getStatus(): VaultStatus {
		const providers = {} as VaultStatus['providers'];
		for (const p of PROVIDER_IDS) {
			const key = this.#memory.get(p);
			if (key !== undefined) {
				providers[p] = {
					state: this.#source.get(p) === 'remembered' ? 'remembered' : 'session',
					last4: key.slice(-4)
				};
			} else if (this.#sealed.has(p)) {
				providers[p] = { state: 'locked' };
			} else {
				providers[p] = { state: 'none' };
			}
		}
		const until = this.#lock?.cooldownUntil ?? null;
		return {
			mode: this.#mode,
			hasLock: this.#lock !== null,
			locked: this.#isLocked(),
			cooldownUntil: until !== null && until > this.now() ? until : null,
			storageBlocked: this.#storageBlocked,
			providers
		};
	}

	/** undefined when absent or locked. Throws VaultError('corrupt') when a sealed row fails to open. */
	async getKey(p: ProviderId): Promise<string | undefined> {
		if (this.#lock && this.#db && this.#source.get(p) !== 'session') {
			if (!this.#dek) return undefined;
			const row = await this.#db.keys.get(p);
			if (!row) return undefined;
			if (typeof row.value === 'string') return row.value;
			if (!isBox(row.box)) return undefined;
			return this.#openRow(p, row.box);
		}
		return this.#memory.get(p);
	}

	async setKey(p: ProviderId, key: string): Promise<void> {
		const value = key.trim();
		if (value === '') throw new VaultError('empty-key');
		if (/\s/.test(value)) throw new VaultError('invalid-key');
		if (this.#mode === 'remember' && this.#db) {
			const db = this.#db;
			let row: KeyRow = { provider: p, value };
			if (this.#lock) {
				if (!this.#dek) throw new VaultError('vault-locked');
				row = { provider: p, box: await seal(this.#dek, value, aadFor(p)) };
			}
			await db.transaction('rw', db.keys, async () => {
				await db.keys.put(row);
			});
			this.#memory.set(p, value);
			this.#source.set(p, 'remembered');
		} else {
			this.#memory.set(p, value);
			this.#source.set(p, 'session');
			this.#writeSession();
		}
		this.#sealed.delete(p);
		this.#emit({ kind: 'keys-changed', provider: p, remote: false });
		this.#post('keys-changed');
	}

	async removeKey(p: ProviderId): Promise<void> {
		this.#memory.delete(p);
		this.#source.delete(p);
		this.#sealed.delete(p);
		this.#writeSession();
		if (this.#db) {
			const db = this.#db;
			await db.transaction('rw', db.keys, async () => {
				await db.keys.delete(p);
			});
		}
		this.#emit({ kind: 'keys-changed', provider: p, remote: false });
		this.#post('keys-changed');
	}

	/** Clears the session store, memory, every tran-secrets key AND meta row, then tells other tabs. */
	async forgetAll(): Promise<void> {
		this.#session.removeItem(SESSION_KEY);
		this.#dropDek();
		this.#lock = null;
		this.#memory.clear();
		this.#source.clear();
		this.#sealed.clear();
		this.#mode = 'session';
		if (this.#db) {
			const db = this.#db;
			// Clear tables; never delete the database: another tab may hold it open.
			await db.transaction('rw', db.keys, db.meta, async () => {
				await db.keys.clear();
				await db.meta.clear();
			});
		}
		this.#emit({ kind: 'forgotten', remote: false });
		this.#post('forget-all');
	}

	async setMode(m: 'session' | 'remember'): Promise<void> {
		if (m === this.#mode) return;
		if (this.#isLocked()) throw new VaultError('vault-locked');
		if (m === 'remember') {
			if (!this.#db) throw new VaultError('storage-blocked');
			const db = this.#db;
			const rows = [...this.#memory].map(([provider, value]) => ({ provider, value }));
			await db.transaction('rw', db.keys, db.meta, async () => {
				await db.keys.bulkPut(rows);
				await db.meta.put({ id: MODE_ROW, value: 'remember' });
			});
			for (const p of this.#memory.keys()) this.#source.set(p, 'remembered');
			this.#mode = 'remember';
			this.#session.removeItem(SESSION_KEY);
		} else {
			// Keep the readable keys for this tab first, then drop the remembered copies and the lock.
			for (const p of this.#memory.keys()) this.#source.set(p, 'session');
			this.#sealed.clear();
			this.#mode = 'session';
			this.#writeSession();
			this.#lock = null;
			this.#dropDek();
			if (this.#db) {
				const db = this.#db;
				await db.transaction('rw', db.keys, db.meta, async () => {
					await db.keys.clear();
					await db.meta.bulkDelete([MODE_ROW, VAULT_ROW]);
				});
			}
		}
		this.#emit({ kind: 'mode-changed', remote: false });
		this.#post('mode-changed');
	}

	/**
	 * Locks every remembered key at rest behind `pass` (remember mode only). All rows are sealed and
	 * the lock record written in ONE rw transaction, so a crash never leaves half-plaintext rows.
	 */
	async setPassphrase(pass: string): Promise<void> {
		if (this.#mode !== 'remember' || !this.#db) throw new VaultError('no-lock');
		if (pass.length < LOCK_MIN_LENGTH) throw new VaultError('too-short');
		if (this.#isLocked()) throw new VaultError('vault-locked');
		const db = this.#db;
		const plain = new Map<ProviderId, string>();
		for (const row of await db.keys.toArray()) {
			if (isProvider(row.provider) && typeof row.value === 'string') {
				plain.set(row.provider, row.value);
			}
		}
		for (const [p, s] of this.#source) {
			const v = this.#memory.get(p);
			if (s === 'remembered' && v !== undefined && !plain.has(p)) plain.set(p, v);
		}
		const { record, dek } = await createLock(pass, this.iterations);
		const rows: KeyRow[] = [];
		for (const [provider, value] of plain) {
			rows.push({ provider, box: await seal(dek, value, aadFor(provider)) });
		}
		await db.transaction('rw', db.keys, db.meta, async () => {
			await db.keys.bulkPut(rows);
			await db.meta.put(metaOf(record));
		});
		this.#lock = record;
		await this.#keepDek(dek);
		for (const [p, v] of plain) {
			this.#memory.set(p, v);
			this.#source.set(p, 'remembered');
			this.#sealed.delete(p);
		}
		this.#emit({ kind: 'lock-changed', remote: false });
		this.#post('keys-changed');
	}

	/**
	 * Rewraps the data key under `next`; key rows are untouched. A wrong `current` returns 'wrong'
	 * without counting as a failed unlock. Requires this tab to be unlocked, so it cannot be used
	 * as a way around the unlock rate limit.
	 */
	async changePassphrase(current: string, next: string): Promise<'ok' | 'wrong'> {
		const record = await this.#readLock();
		if (!record || !this.#db) throw new VaultError('no-lock');
		if (next.length < LOCK_MIN_LENGTH) throw new VaultError('too-short');
		if (!this.#dek) throw new VaultError('vault-locked');
		let dek: CryptoKey;
		try {
			dek = await unwrapDek(record, current);
		} catch {
			return 'wrong';
		}
		const updated = {
			...(await rewrap(record, dek, next, this.iterations)),
			failedAttempts: 0,
			cooldownUntil: null
		};
		const db = this.#db;
		await db.transaction('rw', db.meta, async () => {
			await db.meta.put(metaOf(updated));
		});
		this.#lock = updated;
		this.#emit({ kind: 'lock-changed', remote: false });
		this.#post('keys-changed');
		return 'ok';
	}

	/** Writes every key back as remembered plaintext and deletes the lock (requires unlocked). */
	async removePassphrase(): Promise<void> {
		if (!this.#lock || !this.#db) throw new VaultError('no-lock');
		if (!this.#dek) throw new VaultError('vault-locked');
		const db = this.#db;
		const rows: KeyRow[] = [];
		for (const row of await db.keys.toArray()) {
			if (!isProvider(row.provider)) continue;
			if (typeof row.value === 'string') rows.push({ provider: row.provider, value: row.value });
			else if (isBox(row.box)) {
				rows.push({ provider: row.provider, value: await this.#openRow(row.provider, row.box) });
			}
		}
		await db.transaction('rw', db.keys, db.meta, async () => {
			await db.keys.bulkPut(rows);
			await db.meta.delete(VAULT_ROW);
		});
		this.#lock = null;
		this.#dropDek();
		for (const { provider, value } of rows) {
			this.#memory.set(provider, value!);
			this.#source.set(provider, 'remembered');
			this.#sealed.delete(provider);
		}
		this.#emit({ kind: 'lock-changed', remote: false });
		this.#post('keys-changed');
	}

	/** Forgets the data key in this tab and tells every other tab to do the same. */
	async lock(): Promise<void> {
		if (!this.#lock) throw new VaultError('no-lock');
		this.#dropDek();
		await this.#loadRemembered();
		this.#emit({ kind: 'locked', remote: false });
		this.#post('locked');
	}

	/**
	 * The cooldown is checked BEFORE any key derivation. A failure is counted in the same rw
	 * transaction that re-reads the record, so concurrent tabs cannot lose a failure and a reload
	 * keeps the counter. Honest note: someone with disk access can reset the counter; the PBKDF2
	 * cost is the real brute-force defense and the cooldown is a UX guard.
	 */
	async unlock(pass: string): Promise<'ok' | 'wrong' | { cooldownUntil: number }> {
		const record = await this.#readLock();
		if (!record || !this.#db) throw new VaultError('no-lock');
		if (record.cooldownUntil !== null && this.now() < record.cooldownUntil) {
			return { cooldownUntil: record.cooldownUntil };
		}
		const db = this.#db;
		let dek: CryptoKey;
		try {
			dek = await unwrapDek(record, pass);
		} catch {
			const now = this.now();
			const failed = await db.transaction('rw', db.meta, async () => {
				const cur = lockOf(await db.meta.get(VAULT_ROW)) ?? record;
				const failedAttempts = cur.failedAttempts + 1;
				const wait = cooldownFor(failedAttempts);
				const next = { ...cur, failedAttempts, cooldownUntil: wait > 0 ? now + wait : null };
				await db.meta.put(metaOf(next));
				return next;
			});
			this.#lock = failed;
			return failed.cooldownUntil !== null ? { cooldownUntil: failed.cooldownUntil } : 'wrong';
		}
		const reset = await db.transaction('rw', db.meta, async () => {
			const cur = lockOf(await db.meta.get(VAULT_ROW)) ?? record;
			const next = { ...cur, failedAttempts: 0, cooldownUntil: null };
			await db.meta.put(metaOf(next));
			return next;
		});
		this.#lock = reset;
		await this.#keepDek(dek);
		await this.#loadRemembered();
		this.#emit({ kind: 'unlocked', remote: false });
		return 'ok';
	}

	onChange(cb: (e: VaultEvent) => void): () => void {
		this.#listeners.add(cb);
		return () => {
			this.#listeners.delete(cb);
		};
	}

	/** For the export key scan ONLY. Never log or render the result. */
	knownSecrets(): string[] {
		return [...this.#memory.values()];
	}

	dispose(): void {
		this.#disposed = true;
		this.#listeners.clear();
		this.#channel?.close();
	}

	// ---- internals ----

	#isLocked(): boolean {
		return this.#lock !== null && this.#dek === null;
	}

	async #openRow(p: ProviderId, box: Box): Promise<string> {
		if (!this.#dek) throw new VaultError('vault-locked');
		try {
			return await open(this.#dek, boxOf(box), aadFor(p));
		} catch {
			// Wrong data key or a row moved from another provider (AAD mismatch).
			throw new VaultError('corrupt');
		}
	}

	async #readLock(): Promise<VaultLockRecord | null> {
		if (!this.#db || this.#mode !== 'remember') return (this.#lock = null);
		this.#lock = lockOf(await this.#db.meta.get(VAULT_ROW));
		return this.#lock;
	}

	async #keepDek(dek: CryptoKey): Promise<void> {
		this.#dek = dek;
		this.#session.setItem(DEK_STASH_KEY, await exportDek(dek));
	}

	#dropDek(): void {
		this.#dek = null;
		this.#session.removeItem(DEK_STASH_KEY);
	}

	#loadSession(): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(this.#session.getItem(SESSION_KEY) ?? '{}');
		} catch {
			parsed = {};
		}
		if (!parsed || typeof parsed !== 'object') return;
		for (const [p, v] of Object.entries(parsed as Record<string, unknown>)) {
			if (isProvider(p) && typeof v === 'string' && v !== '') {
				this.#memory.set(p, v);
				this.#source.set(p, 'session');
			}
		}
	}

	/**
	 * Re-reads the mode row, the lock record and remembered keys from tran-secrets (no-op when
	 * blocked). With a lock, sealed rows are opened only if this tab holds the data key (in memory
	 * or in its sessionStorage stash).
	 */
	async #loadRemembered(): Promise<void> {
		if (!this.#db) return;
		const db = this.#db;
		const [mode, rows, lockRow] = await db.transaction('r', db.keys, db.meta, async () => [
			await db.meta.get(MODE_ROW),
			await db.keys.toArray(),
			await db.meta.get(VAULT_ROW)
		]);
		this.#mode = mode?.value === 'remember' ? 'remember' : 'session';
		for (const [p, s] of [...this.#source]) {
			if (s === 'remembered') {
				this.#source.delete(p);
				this.#memory.delete(p);
			}
		}
		this.#sealed.clear();
		this.#lock = this.#mode === 'remember' ? lockOf(lockRow) : null;
		let fromStash = false;
		if (!this.#lock) {
			if (this.#dek || this.#session.getItem(DEK_STASH_KEY) !== null) this.#dropDek();
		} else if (!this.#dek) {
			const stash = this.#session.getItem(DEK_STASH_KEY);
			if (stash !== null) {
				try {
					this.#dek = await importDek(stash);
					fromStash = true;
				} catch {
					this.#dropDek();
				}
			}
		}
		if (this.#mode !== 'remember') return;
		let sealedRows = 0;
		let opened = 0;
		for (const row of rows) {
			if (!isProvider(row.provider)) continue;
			if (typeof row.value === 'string') {
				this.#memory.set(row.provider, row.value);
				this.#source.set(row.provider, 'remembered');
			} else if (isBox(row.box) && !this.#memory.has(row.provider)) {
				sealedRows++;
				const value = this.#dek
					? await this.#openRow(row.provider, row.box).catch(() => null)
					: null;
				if (value === null) {
					this.#sealed.add(row.provider);
				} else {
					opened++;
					this.#memory.set(row.provider, value);
					this.#source.set(row.provider, 'remembered');
				}
			}
		}
		if (fromStash && sealedRows > 0 && opened === 0) {
			// A stale stash (the lock was replaced in another tab): this tab is locked after all.
			this.#dropDek();
		}
	}

	#writeSession(): void {
		const out: Record<string, string> = {};
		for (const [p, s] of this.#source) {
			const v = this.#memory.get(p);
			if (s === 'session' && v !== undefined) out[p] = v;
		}
		if (Object.keys(out).length === 0) this.#session.removeItem(SESSION_KEY);
		else this.#session.setItem(SESSION_KEY, JSON.stringify(out));
	}

	async #onMessage(msg: VaultMessage | undefined): Promise<void> {
		if (this.#disposed || !msg || msg.from === this.#tabId) return;
		switch (msg.type) {
			case 'forget-all':
				this.#session.removeItem(SESSION_KEY);
				this.#dropDek();
				this.#lock = null;
				this.#memory.clear();
				this.#source.clear();
				this.#sealed.clear();
				this.#mode = 'session';
				this.#emit({ kind: 'forgotten', remote: true });
				return;
			case 'locked':
				// sessionStorage is per tab: each tab clears ITS OWN data-key stash.
				this.#session.removeItem(SESSION_KEY);
				this.#dropDek();
				this.#memory.clear();
				this.#source.clear();
				await this.#loadRemembered();
				this.#emit({ kind: 'locked', remote: true });
				return;
			case 'mode-changed': {
				const wasRemember = this.#mode === 'remember';
				if (wasRemember) {
					// The other tab switched to session and is deleting the rows: keep this tab's
					// readable keys usable by copying them into this tab's own session store first.
					for (const p of this.#memory.keys()) this.#source.set(p, 'session');
					this.#writeSession();
				}
				await this.#loadRemembered();
				if (this.#mode === 'remember' && this.#db) {
					// The other tab opted this device into remember: move this tab's own session-only
					// keys there too (rows already remembered win), so a key lives in one store.
					const db = this.#db;
					const moved: { provider: ProviderId; value: string }[] = [];
					for (const [provider, s] of this.#source) {
						const value = this.#memory.get(provider);
						if (s === 'session' && value !== undefined) moved.push({ provider, value });
					}
					await db.transaction('rw', db.keys, async () => {
						for (const row of moved) {
							if (!(await db.keys.get(row.provider))) await db.keys.put(row);
						}
					});
					for (const { provider } of moved) this.#source.set(provider, 'remembered');
					this.#session.removeItem(SESSION_KEY);
				}
				this.#emit({ kind: 'mode-changed', remote: true });
				return;
			}
			case 'keys-changed':
				// Also re-reads the lock record (set / change / remove passphrase in another tab).
				if (this.#mode === 'remember') await this.#loadRemembered();
				this.#emit({ kind: 'keys-changed', remote: true });
				return;
		}
	}

	#emit(e: VaultEvent): void {
		for (const cb of this.#listeners) cb(e);
	}

	#post(type: VaultMessage['type']): void {
		this.#channel?.postMessage({ type, from: this.#tabId });
	}
}
