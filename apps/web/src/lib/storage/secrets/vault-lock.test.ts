import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_IDS, type ProviderId } from '@tran/core';
import { freshIdb, memoryStorage, type MemoryStorage } from '$lib/storage/test-utils';
import { fakeKey } from '../../../../tests/support/fake-keys';
import type { ChannelLike, VaultMessage } from './channel';
import { IV_BYTES, SALT_BYTES, open, seal } from './crypto';
import {
	COOLDOWN_BASE_MS,
	COOLDOWN_CAP_MS,
	LOCK_MAX_ATTEMPTS,
	LOCK_MIN_LENGTH,
	cooldownFor,
	createLock,
	exportDek,
	importDek,
	rewrap,
	unwrapDek
} from './lock';
import { createSecretsDb, type SecretsDb } from './secrets-db';
import { SESSION_KEY, Vault, VaultError, type VaultEvent } from './vault';

// Passphrases are assembled at runtime so no literal secret-shaped string sits in the source.
const PASS = ['correct', 'horse', 'battery', 'staple'].join(' ');
const OTHER = ['tranquil', 'otter', 'reading', 'maps'].join(' ');
const LOW = 1000;

const rejects = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch {
		return true;
	}
	return false;
};

describe('lock constants and cooldown schedule', () => {
	it('uses a 12-character minimum and 5 free attempts', () => {
		expect(LOCK_MIN_LENGTH).toBe(12);
		expect(LOCK_MAX_ATTEMPTS).toBe(5);
		expect(COOLDOWN_BASE_MS).toBe(30_000);
		expect(COOLDOWN_CAP_MS).toBe(300_000);
	});

	it.each([
		[0, 0],
		[1, 0],
		[4, 0],
		[5, 30_000],
		[6, 60_000],
		[7, 120_000],
		[8, 240_000],
		[9, 300_000],
		[20, 300_000]
	])('cooldownFor(%i) === %i', (failed, ms) => {
		expect(cooldownFor(failed)).toBe(ms);
	});
});

describe('createLock / unwrapDek / rewrap', () => {
	it('creates a v1 PBKDF2 record with a wrapped data key and a zeroed counter', async () => {
		const { record, dek } = await createLock(PASS, LOW);
		expect(record.id).toBe('vault');
		expect(record.v).toBe(1);
		expect(record.kdf).toBe('PBKDF2-SHA256');
		expect(record.iterations).toBe(LOW);
		expect(record.salt).toBeInstanceOf(Uint8Array);
		expect(record.salt.byteLength).toBe(SALT_BYTES);
		expect(record.wrapped.iv.byteLength).toBe(IV_BYTES);
		expect(record.wrapped.ct.byteLength).toBeGreaterThan(32);
		expect(record.failedAttempts).toBe(0);
		expect(record.cooldownUntil).toBeNull();
		expect(dek.algorithm.name).toBe('AES-GCM');
		const box = await seal(dek, 'hello', 'aad');
		expect(await open(dek, box, 'aad')).toBe('hello');
	});

	it('unwraps the same data key with the right passphrase and rejects a wrong one', async () => {
		const { record, dek } = await createLock(PASS, LOW);
		const box = await seal(dek, 'payload', 'aad');
		const again = await unwrapDek(record, PASS);
		expect(await open(again, box, 'aad')).toBe('payload');
		expect(await rejects(unwrapDek(record, OTHER))).toBe(true);
	});

	it('rewrap uses a new salt and box; only the new passphrase opens it', async () => {
		const { record, dek } = await createLock(PASS, LOW);
		const box = await seal(dek, 'payload', 'aad');
		const next = await rewrap(record, dek, OTHER, LOW);
		expect(Array.from(next.salt)).not.toEqual(Array.from(record.salt));
		expect(Array.from(next.wrapped.ct)).not.toEqual(Array.from(record.wrapped.ct));
		expect(Array.from(next.wrapped.iv)).not.toEqual(Array.from(record.wrapped.iv));
		const k = await unwrapDek(next, OTHER);
		expect(await open(k, box, 'aad')).toBe('payload');
		expect(await rejects(unwrapDek(next, PASS))).toBe(true);
	});

	it('exportDek / importDek round-trip the data key as base64', async () => {
		const { dek } = await createLock(PASS, LOW);
		const b64 = await exportDek(dek);
		expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
		expect(atob(b64).length).toBe(32);
		const back = await importDek(b64);
		const box = await seal(dek, 'payload', 'aad');
		expect(await open(back, box, 'aad')).toBe('payload');
	});
});

// ---------------------------------------------------------------------------------------------
// Vault integration: lock / unlock / change / remove, persisted rate limit, cross-tab lock.
// ---------------------------------------------------------------------------------------------

const DEK_STASH = 'tran.vault.dek.v1';
const T0 = 1_700_000_000_000;
const clock = { t: T0 };
const live: Vault[] = [];
const dbs: SecretsDb[] = [];
let seq = 0;

beforeEach(() => {
	clock.t = T0;
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const v of live.splice(0)) v.dispose();
	for (const d of dbs.splice(0)) d.close();
});

type Idb = ReturnType<typeof freshIdb>;

function spyChannel(name: string) {
	const bc = new BroadcastChannel(name);
	const posted: VaultMessage[] = [];
	const channel: ChannelLike = {
		postMessage: (m) => {
			posted.push(m);
			bc.postMessage(m);
		},
		addEventListener: (t, l) => bc.addEventListener(t, l as EventListener),
		close: () => bc.close()
	};
	return { channel, posted };
}

async function makeVault(
	opts: { session?: MemoryStorage; idb?: Idb; channelName?: string; production?: boolean } = {}
) {
	const session = opts.session ?? memoryStorage();
	const idb = opts.idb ?? freshIdb();
	const channelName = opts.channelName ?? `tran-vault-lock-test-${++seq}`;
	const { channel, posted } = spyChannel(channelName);
	const db = createSecretsDb(idb);
	dbs.push(db);
	const events: VaultEvent[] = [];
	const vault = new Vault({
		session,
		openDb: () => db,
		channel,
		...(opts.production ? {} : { iterations: LOW }),
		now: () => clock.t,
		tabId: `lock-tab-${seq}-${live.length}`
	});
	live.push(vault);
	vault.onChange((e) => events.push(e));
	await vault.init();
	return { vault, session, idb, db, channelName, events, posted };
}

const KEYS: Partial<Record<ProviderId, string>> = {
	anthropic: fakeKey('anthropic'),
	openai: fakeKey('openai'),
	rentcast: fakeKey('rentcast')
};
const planted = Object.entries(KEYS) as [ProviderId, string][];

/** A remembered vault holding the planted keys, then locked at rest with PASS (still unlocked). */
async function lockedVault(opts: Parameters<typeof makeVault>[0] = {}) {
	const t = await makeVault(opts);
	await t.vault.setMode('remember');
	for (const [p, k] of planted) await t.vault.setKey(p, k);
	await t.vault.setPassphrase(PASS);
	return t;
}

const errOf = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		return e;
	}
	throw new Error('expected rejection');
};

const codeOf = async (p: Promise<unknown>) => ((await errOf(p)) as VaultError).code;

const bytesAsArrays = (_k: string, v: unknown) => (v instanceof Uint8Array ? Array.from(v) : v);

/** Every raw tran-secrets row as JSON, with byte arrays spelled out as number arrays. */
async function rawDump(db: SecretsDb): Promise<string> {
	return JSON.stringify(
		{ keys: await db.keys.toArray(), meta: await db.meta.toArray() },
		bytesAsArrays
	);
}

const vaultRow = async (db: SecretsDb) =>
	(await db.meta.get('vault')) as
		{ failedAttempts: number; cooldownUntil: number | null; iterations: number } | undefined;

describe('Vault.setPassphrase', () => {
	it('is only available in remember mode (no-lock otherwise)', async () => {
		const { vault } = await makeVault();
		await vault.setKey('anthropic', KEYS.anthropic!);
		const err = await errOf(vault.setPassphrase(PASS));
		expect(err).toBeInstanceOf(VaultError);
		expect((err as VaultError).code).toBe('no-lock');
		expect(vault.getStatus().hasLock).toBe(false);
	});

	it('rejects a passphrase shorter than 12 characters (too-short) and writes nothing', async () => {
		const { vault, db } = await makeVault();
		await vault.setMode('remember');
		await vault.setKey('openai', KEYS.openai!);
		expect(await codeOf(vault.setPassphrase(PASS.slice(0, 11)))).toBe('too-short');
		expect(await db.meta.get('vault')).toBeUndefined();
		expect((await db.keys.get('openai'))?.value).toBe(KEYS.openai);
	});

	it('seals every remembered key at rest: no raw tran-secrets row contains a planted key', async () => {
		const { vault, db, events } = await lockedVault();
		const s = vault.getStatus();
		expect(s.hasLock).toBe(true);
		expect(s.locked).toBe(false);
		for (const row of await db.keys.toArray()) {
			expect(row.box).toBeDefined();
			expect(row.value).toBeUndefined();
		}
		const dump = await rawDump(db);
		for (const [, k] of planted) {
			expect(dump).not.toContain(k);
			expect(dump).not.toContain(k.slice(0, 16));
		}
		expect(dump).not.toContain(PASS);
		expect((await vaultRow(db))?.iterations).toBe(LOW);
		expect(events).toContainEqual({ kind: 'lock-changed', remote: false });
		// Still readable in this tab right after locking at rest.
		for (const [p, k] of planted) expect(await vault.getKey(p)).toBe(k);
	});

	it('uses 12-byte IVs that are all distinct and a 16-byte salt', async () => {
		const { db } = await lockedVault();
		const rows = await db.keys.toArray();
		const record = (await db.meta.get('vault')) as unknown as {
			salt: Uint8Array;
			wrapped: { iv: Uint8Array };
		};
		const ivs = [...rows.map((r) => r.box!.iv), record.wrapped.iv];
		for (const iv of ivs) expect(iv.byteLength).toBe(IV_BYTES);
		expect(new Set(ivs.map((iv) => Array.from(iv).join(','))).size).toBe(ivs.length);
		expect(record.salt.byteLength).toBe(SALT_BYTES);
	});

	it('stores the production iteration count (600000) when none is injected', async () => {
		const { db } = await lockedVault({ production: true });
		expect((await vaultRow(db))?.iterations).toBe(600000);
	});
});

describe('reopening a locked vault', () => {
	it('a new tab sees every remembered key as locked: no last4, no getKey, no known secrets', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb, channelName: a.channelName });
		const s = b.vault.getStatus();
		expect(s.mode).toBe('remember');
		expect(s.hasLock).toBe(true);
		expect(s.locked).toBe(true);
		for (const [p] of planted) {
			expect(s.providers[p]).toEqual({ state: 'locked' });
			expect(await b.vault.getKey(p)).toBeUndefined();
		}
		expect(b.vault.knownSecrets()).toEqual([]);
	});
});

describe('Vault.unlock and the persisted rate limit', () => {
	it('a wrong passphrase returns wrong and persists failedAttempts = 1', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb });
		expect(await b.vault.unlock(OTHER)).toBe('wrong');
		expect((await vaultRow(b.db))?.failedAttempts).toBe(1);
		expect(b.vault.getStatus().locked).toBe(true);
	});

	it('5 wrong attempts start a 30 s cooldown that survives a reload, then doubles', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb });
		for (let i = 1; i <= 4; i++) expect(await b.vault.unlock(OTHER)).toBe('wrong');
		expect(await b.vault.unlock(OTHER)).toEqual({ cooldownUntil: T0 + 30_000 });
		expect((await vaultRow(b.db))?.failedAttempts).toBe(5);
		expect(b.vault.getStatus().cooldownUntil).toBe(T0 + 30_000);

		// During the cooldown nothing is derived, even for the right passphrase.
		const derive = vi.spyOn(crypto.subtle, 'deriveKey');
		clock.t = T0 + 10_000;
		expect(await b.vault.unlock(PASS)).toEqual({ cooldownUntil: T0 + 30_000 });
		expect(derive).toHaveBeenCalledTimes(0);
		expect(b.vault.getStatus().locked).toBe(true);

		// Reload: a new Vault on the same database still reports the cooldown.
		const c = await makeVault({ idb: a.idb });
		expect(c.vault.getStatus().cooldownUntil).toBe(T0 + 30_000);

		// Past the cooldown another attempt is allowed; the 6th failure doubles it to 60 s.
		clock.t = T0 + 30_001;
		expect(await c.vault.unlock(OTHER)).toEqual({ cooldownUntil: T0 + 30_001 + 60_000 });
		expect(derive).toHaveBeenCalled();
		expect((await vaultRow(c.db))?.failedAttempts).toBe(6);
	});

	it('the right passphrase unlocks, resets the counter and restores every key', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb });
		expect(await b.vault.unlock(OTHER)).toBe('wrong');
		expect(await b.vault.unlock(OTHER)).toBe('wrong');
		expect(await b.vault.unlock(PASS)).toBe('ok');
		const row = await vaultRow(b.db);
		expect(row?.failedAttempts).toBe(0);
		expect(row?.cooldownUntil).toBeNull();
		const s = b.vault.getStatus();
		expect(s.locked).toBe(false);
		expect(s.cooldownUntil).toBeNull();
		for (const [p, k] of planted) {
			expect(await b.vault.getKey(p)).toBe(k);
			expect(s.providers[p]).toEqual({ state: 'remembered', last4: k.slice(-4) });
		}
		expect(b.events).toContainEqual({ kind: 'unlocked', remote: false });
	});

	it('a reload of the SAME tab stays unlocked; a new tab is locked', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb });
		expect(await b.vault.unlock(PASS)).toBe('ok');
		expect(b.session.getItem(DEK_STASH)).not.toBeNull();

		const reload = await makeVault({ idb: a.idb, session: b.session });
		expect(reload.vault.getStatus().locked).toBe(false);
		expect(await reload.vault.getKey('anthropic')).toBe(KEYS.anthropic);

		const fresh = await makeVault({ idb: a.idb });
		expect(fresh.vault.getStatus().locked).toBe(true);
		expect(await fresh.vault.getKey('anthropic')).toBeUndefined();
	});

	it('setKey seals the new key while unlocked and refuses while locked', async () => {
		const k = fakeKey('gemini');
		const a = await lockedVault();
		await a.vault.setKey('gemini', k);
		const row = await a.db.keys.get('gemini');
		expect(row?.value).toBeUndefined();
		expect(row?.box).toBeDefined();
		expect(await rawDump(a.db)).not.toContain(k);
		expect(await a.vault.getKey('gemini')).toBe(k);

		const b = await makeVault({ idb: a.idb });
		expect(await codeOf(b.vault.setKey('openrouter', fakeKey('openrouter')))).toBe('vault-locked');
		expect(await b.db.keys.get('openrouter')).toBeUndefined();
	});

	it('unlock without a lock is no-lock', async () => {
		const { vault } = await makeVault();
		expect(await codeOf(vault.unlock(PASS))).toBe('no-lock');
	});
});

describe('provider-bound ciphertexts (AAD)', () => {
	it('swapping two rows makes decryption fail instead of returning the other key', async () => {
		const a = await lockedVault();
		const anth = await a.db.keys.get('anthropic');
		const oai = await a.db.keys.get('openai');
		await a.db.keys.put({ provider: 'anthropic', box: oai!.box! });
		await a.db.keys.put({ provider: 'openai', box: anth!.box! });

		const b = await makeVault({ idb: a.idb });
		expect(await b.vault.unlock(PASS)).toBe('ok');
		const err = await errOf(b.vault.getKey('anthropic'));
		expect(err).toBeInstanceOf(VaultError);
		expect((err as VaultError).code).toBe('corrupt');
		expect(String(err)).not.toContain(KEYS.openai!);
		expect(await codeOf(b.vault.getKey('openai'))).toBe('corrupt');
		expect(await b.vault.getKey('rentcast')).toBe(KEYS.rentcast);
	});
});

describe('Vault.lock and cross-tab lock', () => {
	it('lock clears the DEK stash and memory and broadcasts locked', async () => {
		const a = await lockedVault();
		expect(a.session.getItem(DEK_STASH)).not.toBeNull();
		await a.vault.lock();
		expect(a.session.getItem(DEK_STASH)).toBeNull();
		expect(a.vault.getStatus().locked).toBe(true);
		expect(a.vault.knownSecrets()).toEqual([]);
		expect(await a.vault.getKey('anthropic')).toBeUndefined();
		expect(a.posted.map((m) => m.type)).toContain('locked');
		expect(a.events).toContainEqual({ kind: 'locked', remote: false });

		const reload = await makeVault({ idb: a.idb, session: a.session });
		expect(reload.vault.getStatus().locked).toBe(true);
	});

	it('locking in one tab locks every other open tab (each clears its own stash)', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb, channelName: a.channelName });
		expect(await b.vault.unlock(PASS)).toBe('ok');
		expect(b.session.getItem(DEK_STASH)).not.toBeNull();

		await a.vault.lock();
		await vi.waitFor(() => expect(b.events).toContainEqual({ kind: 'locked', remote: true }));
		expect(b.session.getItem(DEK_STASH)).toBeNull();
		expect(b.vault.getStatus().locked).toBe(true);
		expect(b.vault.knownSecrets()).toEqual([]);
		expect(await b.vault.getKey('openai')).toBeUndefined();
	});

	it('lock without a lock is no-lock', async () => {
		const { vault } = await makeVault();
		expect(await codeOf(vault.lock())).toBe('no-lock');
	});
});

describe('Vault.changePassphrase', () => {
	it('a wrong current passphrase returns wrong and leaves the counter alone', async () => {
		const a = await lockedVault();
		expect(await a.vault.changePassphrase(OTHER, OTHER)).toBe('wrong');
		expect((await vaultRow(a.db))?.failedAttempts).toBe(0);
		expect(await codeOf(a.vault.changePassphrase(PASS, 'too short'))).toBe('too-short');
	});

	it('rewraps only: key rows are byte-for-byte unchanged and only the new passphrase unlocks', async () => {
		const a = await lockedVault();
		const before = JSON.stringify(await a.db.keys.toArray(), bytesAsArrays);
		expect(await a.vault.changePassphrase(PASS, OTHER)).toBe('ok');
		expect(JSON.stringify(await a.db.keys.toArray(), bytesAsArrays)).toBe(before);
		expect(a.events).toContainEqual({ kind: 'lock-changed', remote: false });
		expect(a.vault.getStatus().locked).toBe(false);

		const b = await makeVault({ idb: a.idb });
		expect(await b.vault.unlock(PASS)).toBe('wrong');
		expect(await b.vault.unlock(OTHER)).toBe('ok');
		expect(await b.vault.getKey('openai')).toBe(KEYS.openai);
	});
});

describe('Vault.removePassphrase', () => {
	it('requires an unlocked vault with a lock', async () => {
		const plain = await makeVault();
		expect(await codeOf(plain.vault.removePassphrase())).toBe('no-lock');
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb });
		expect(await codeOf(b.vault.removePassphrase())).toBe('vault-locked');
		expect(await b.db.meta.get('vault')).toBeDefined();
	});

	it('writes the keys back as remembered plaintext and deletes the lock', async () => {
		const a = await lockedVault();
		await a.vault.removePassphrase();
		for (const [p, k] of planted) expect(await a.db.keys.get(p)).toEqual({ provider: p, value: k });
		expect(await a.db.meta.get('vault')).toBeUndefined();
		expect(a.session.getItem(DEK_STASH)).toBeNull();
		const s = a.vault.getStatus();
		expect(s.hasLock).toBe(false);
		expect(s.locked).toBe(false);
		expect(s.providers.anthropic.state).toBe('remembered');
		expect(a.events).toContainEqual({ kind: 'lock-changed', remote: false });

		const b = await makeVault({ idb: a.idb });
		expect(b.vault.getStatus().hasLock).toBe(false);
		expect(await b.vault.getKey('rentcast')).toBe(KEYS.rentcast);
	});
});

describe('setMode and forgetAll with a lock', () => {
	it('switching to session while unlocked copies keys to this tab and deletes rows and the lock', async () => {
		const a = await lockedVault();
		await a.vault.setMode('session');
		expect(await a.db.keys.count()).toBe(0);
		expect(await a.db.meta.get('vault')).toBeUndefined();
		expect(await a.db.meta.get('mode')).toBeUndefined();
		expect(a.session.getItem(DEK_STASH)).toBeNull();
		for (const [p, k] of planted) {
			expect(a.session.getItem(SESSION_KEY)).toContain(k);
			expect(await a.vault.getKey(p)).toBe(k);
		}
		expect(a.vault.getStatus().hasLock).toBe(false);
	});

	it('switching to session while locked is refused', async () => {
		const a = await lockedVault();
		const b = await makeVault({ idb: a.idb });
		expect(await codeOf(b.vault.setMode('session'))).toBe('vault-locked');
		expect(await b.db.keys.count()).toBe(planted.length);
	});

	it('forgetAll also deletes the vault row and the DEK stash', async () => {
		const a = await lockedVault();
		await a.vault.forgetAll();
		expect(await a.db.meta.get('vault')).toBeUndefined();
		expect(a.session.getItem(DEK_STASH)).toBeNull();
		expect(a.vault.getStatus().hasLock).toBe(false);
		expect(await a.db.keys.count()).toBe(0);
	});
});

describe('no secrets leak through errors, events or broadcasts', () => {
	it('never echoes the passphrase, a key or a last4', async () => {
		const errors: unknown[] = [];
		const plain = await makeVault();
		errors.push(await errOf(plain.vault.setPassphrase(PASS)));
		const a = await lockedVault();
		errors.push(await errOf(a.vault.setPassphrase(PASS.slice(0, 11))));
		errors.push(await errOf(a.vault.changePassphrase(PASS, PASS.slice(0, 11))));
		const b = await makeVault({ idb: a.idb, channelName: a.channelName });
		errors.push(await errOf(b.vault.removePassphrase()));
		errors.push(await errOf(b.vault.setKey('gemini', fakeKey('gemini'))));
		errors.push(await errOf(b.vault.setMode('session')));
		const swapped = await a.db.keys.get('openai');
		await a.db.keys.put({ provider: 'anthropic', box: swapped!.box! });
		expect(await b.vault.unlock(PASS)).toBe('ok');
		errors.push(await errOf(b.vault.getKey('anthropic')));
		await a.vault.changePassphrase(PASS, OTHER);
		await a.vault.lock();

		const texts = [
			...errors.flatMap((e) => [String(e), (e as Error).message, JSON.stringify(e)]),
			JSON.stringify(a.events),
			JSON.stringify(b.events),
			JSON.stringify(a.posted),
			JSON.stringify(b.posted)
		];
		for (const e of errors) expect(e).toBeInstanceOf(VaultError);
		for (const t of texts) {
			expect(t).not.toContain(PASS);
			expect(t).not.toContain(OTHER);
			for (const [, k] of planted) {
				expect(t).not.toContain(k);
				expect(t).not.toContain(k.slice(-4));
			}
		}
		for (const m of [...a.posted, ...b.posted]) {
			expect(Object.keys(m).sort()).toEqual(['from', 'type']);
		}
		expect(PROVIDER_IDS).toContain('anthropic');
	});
});
