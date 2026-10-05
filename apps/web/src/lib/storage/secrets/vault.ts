import { PROVIDER_IDS, type ProviderId } from '@tran/core';
import type { ChannelLike, VaultMessage } from './channel';
import { ITERATIONS } from './crypto';
import type { SecretsDb } from './secrets-db';

// The key vault. Three stores behind one API:
// - session: sessionStorage[SESSION_KEY] (per tab, the default), mirrored in an in-memory Map
// - remember: the separate 'tran-secrets' IndexedDB (opt-in), never the main data DB
// - meta: the 'mode' row (and the 'vault' passphrase row added by 03-07)
// Rules: every thrown error is a VaultError with a fixed code (no interpolation, never key text);
// events and broadcasts carry only kinds and provider ids; nothing here logs (lint-enforced).

export type KeyState = 'none' | 'session' | 'remembered' | 'locked';

export interface VaultStatus {
	mode: 'session' | 'remember';
	/** Lock fields stay false/null until the passphrase lock (03-07). */
	hasLock: boolean;
	locked: boolean;
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
	/** Default ITERATIONS; tests inject 1000. Used by the passphrase lock (03-07). */
	iterations?: number;
	/** Default Date.now. */
	now?: () => number;
	/** Default crypto.randomUUID(). */
	tabId?: string;
}

export const SESSION_KEY = 'tran.vault.session.v1';

const MODE_ROW = 'mode';
const VAULT_ROW = 'vault';
const isProvider = (p: unknown): p is ProviderId =>
	typeof p === 'string' && (PROVIDER_IDS as readonly string[]).includes(p);

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
	/** Providers that have a sealed row but no readable copy (03-07). */
	readonly #sealed = new Set<ProviderId>();
	readonly #listeners = new Set<(e: VaultEvent) => void>();
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
		return {
			mode: this.#mode,
			hasLock: false,
			locked: false,
			cooldownUntil: null,
			storageBlocked: this.#storageBlocked,
			providers
		};
	}

	async getKey(p: ProviderId): Promise<string | undefined> {
		return this.#memory.get(p);
	}

	async setKey(p: ProviderId, key: string): Promise<void> {
		const value = key.trim();
		if (value === '') throw new VaultError('empty-key');
		if (/\s/.test(value)) throw new VaultError('invalid-key');
		if (this.#mode === 'remember' && this.#db) {
			const db = this.#db;
			await db.transaction('rw', db.keys, async () => {
				await db.keys.put({ provider: p, value });
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
		if (this.getStatus().locked) throw new VaultError('vault-locked');
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
			// Keep the readable keys for this tab first, then drop the remembered copies.
			for (const p of this.#memory.keys()) this.#source.set(p, 'session');
			this.#sealed.clear();
			this.#mode = 'session';
			this.#writeSession();
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

	/** Re-reads the mode row and remembered keys from tran-secrets (no-op when blocked). */
	async #loadRemembered(): Promise<void> {
		if (!this.#db) return;
		const db = this.#db;
		const [mode, rows] = await db.transaction('r', db.keys, db.meta, async () => [
			await db.meta.get(MODE_ROW),
			await db.keys.toArray()
		]);
		this.#mode = mode?.value === 'remember' ? 'remember' : 'session';
		for (const [p, s] of [...this.#source]) {
			if (s === 'remembered') {
				this.#source.delete(p);
				this.#memory.delete(p);
			}
		}
		this.#sealed.clear();
		if (this.#mode !== 'remember') return;
		for (const row of rows) {
			if (!isProvider(row.provider)) continue;
			if (typeof row.value === 'string') {
				this.#memory.set(row.provider, row.value);
				this.#source.set(row.provider, 'remembered');
			} else if (row.box && !this.#memory.has(row.provider)) {
				this.#sealed.add(row.provider);
			}
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
				this.#memory.clear();
				this.#source.clear();
				this.#sealed.clear();
				this.#mode = 'session';
				this.#emit({ kind: 'forgotten', remote: true });
				return;
			case 'locked':
				this.#session.removeItem(SESSION_KEY);
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
