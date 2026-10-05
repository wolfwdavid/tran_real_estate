import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_IDS } from '@tran/core';
import { freshIdb, memoryStorage, type MemoryStorage } from '$lib/storage/test-utils';
import { fakeKey } from '../../../../tests/support/fake-keys';
import type { ChannelLike, VaultMessage } from './channel';
import { createSecretsDb, type SecretsDb } from './secrets-db';
import { SESSION_KEY, Vault, VaultError, type VaultEvent } from './vault';

type Idb = ReturnType<typeof freshIdb>;

const live: Vault[] = [];
const dbs: SecretsDb[] = [];
let channelSeq = 0;

afterEach(() => {
	for (const v of live.splice(0)) v.dispose();
	for (const d of dbs.splice(0)) d.close();
});

/** Real Node BroadcastChannel, wrapped so every posted message is recorded. */
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

async function makeVault(opts: { session?: MemoryStorage; idb?: Idb; channelName?: string } = {}) {
	const session = opts.session ?? memoryStorage();
	const idb = opts.idb ?? freshIdb();
	const channelName = opts.channelName ?? `tran-vault-test-${++channelSeq}`;
	const { channel, posted } = spyChannel(channelName);
	const db = createSecretsDb(idb);
	dbs.push(db);
	const events: VaultEvent[] = [];
	const vault = new Vault({
		session,
		openDb: () => db,
		channel,
		iterations: 1000,
		now: () => 1_700_000_000_000,
		tabId: `tab-${channelSeq}-${live.length}`
	});
	live.push(vault);
	vault.onChange((e) => events.push(e));
	await vault.init();
	return { vault, session, idb, db, channelName, events, posted };
}

const errOf = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		return e;
	}
	throw new Error('expected rejection');
};

describe('Vault defaults and setKey', () => {
	it('starts in session mode with every provider empty', async () => {
		const { vault } = await makeVault();
		const s = vault.getStatus();
		expect(s.mode).toBe('session');
		expect(s.hasLock).toBe(false);
		expect(s.locked).toBe(false);
		expect(s.cooldownUntil).toBeNull();
		expect(s.storageBlocked).toBe(false);
		for (const p of PROVIDER_IDS) expect(s.providers[p]).toEqual({ state: 'none' });
	});

	it('trims and stores a key in this tab session store only', async () => {
		const k = fakeKey('anthropic');
		const { vault, session, db, events } = await makeVault();
		await vault.setKey('anthropic', '  ' + k + '\n');
		expect(await vault.getKey('anthropic')).toBe(k);
		expect(session.getItem(SESSION_KEY)).toContain(k);
		expect(vault.getStatus().providers.anthropic).toEqual({ state: 'session', last4: k.slice(-4) });
		expect(await db.keys.count()).toBe(0);
		expect(events).toContainEqual({ kind: 'keys-changed', provider: 'anthropic', remote: false });
	});

	it('getStatus returns a fresh snapshot each call', async () => {
		const { vault } = await makeVault();
		const a = vault.getStatus();
		await vault.setKey('openai', fakeKey('openai'));
		expect(a.providers.openai.state).toBe('none');
		expect(vault.getStatus()).not.toBe(a);
	});

	it('rejects empty and whitespace-bearing keys without echoing them', async () => {
		const k = fakeKey('openai');
		const { vault } = await makeVault();
		const cases: [string, string][] = [
			['', 'empty-key'],
			['   \n\t', 'empty-key'],
			[k.slice(0, 10) + ' ' + k.slice(10), 'invalid-key'],
			[k.slice(0, 10) + '\n' + k.slice(10), 'invalid-key']
		];
		for (const [input, code] of cases) {
			const err = await errOf(vault.setKey('openai', input));
			expect(err).toBeInstanceOf(VaultError);
			expect((err as VaultError).code).toBe(code);
			for (const text of [String(err), (err as Error).message, JSON.stringify(err)]) {
				expect(text).not.toContain(k.slice(0, 10));
				expect(text).not.toContain(k.slice(-4));
			}
		}
		expect(vault.getStatus().providers.openai.state).toBe('none');
	});

	it('keeps session keys per tab: a new tab (new session store) sees none', async () => {
		const idb = freshIdb();
		const a = await makeVault({ idb });
		await a.vault.setKey('anthropic', fakeKey('anthropic'));
		const b = await makeVault({ idb, channelName: a.channelName });
		expect(b.vault.getStatus().providers.anthropic.state).toBe('none');
		expect(await b.vault.getKey('anthropic')).toBeUndefined();
	});

	it('survives a reload: a new Vault on the SAME session store reads the key back', async () => {
		const k = fakeKey('gemini');
		const a = await makeVault();
		await a.vault.setKey('gemini', k);
		const b = await makeVault({ session: a.session, idb: a.idb });
		expect(await b.vault.getKey('gemini')).toBe(k);
		expect(b.vault.getStatus().providers.gemini.state).toBe('session');
	});
});

describe('remember mode', () => {
	it('moves session keys into tran-secrets and a new tab can read them', async () => {
		const k = fakeKey('anthropic');
		const r = fakeKey('rentcast');
		const a = await makeVault();
		await a.vault.setKey('anthropic', k);
		await a.vault.setKey('rentcast', r);
		await a.vault.setMode('remember');

		expect(await a.db.keys.get('anthropic')).toEqual({ provider: 'anthropic', value: k });
		expect(await a.db.keys.get('rentcast')).toEqual({ provider: 'rentcast', value: r });
		expect(await a.db.meta.get('mode')).toEqual({ id: 'mode', value: 'remember' });
		expect(a.session.getItem(SESSION_KEY)).toBeNull();
		expect(a.vault.getStatus().mode).toBe('remember');
		expect(a.vault.getStatus().providers.anthropic).toEqual({
			state: 'remembered',
			last4: k.slice(-4)
		});
		expect(a.events).toContainEqual({ kind: 'mode-changed', remote: false });

		const b = await makeVault({ idb: a.idb, channelName: a.channelName });
		expect(b.vault.getStatus().mode).toBe('remember');
		expect(b.vault.getStatus().providers.anthropic.state).toBe('remembered');
		expect(await b.vault.getKey('anthropic')).toBe(k);
	});

	it('setKey in remember mode writes straight to tran-secrets', async () => {
		const k = fakeKey('openrouter');
		const { vault, db, session } = await makeVault();
		await vault.setMode('remember');
		await vault.setKey('openrouter', k);
		expect((await db.keys.get('openrouter'))?.value).toBe(k);
		expect(session.getItem(SESSION_KEY)).toBeNull();
		expect(vault.getStatus().providers.openrouter.state).toBe('remembered');
	});

	it('switching back to session keeps keys for this tab and deletes the remembered copies', async () => {
		const k = fakeKey('openai');
		const { vault, db, session } = await makeVault();
		await vault.setKey('openai', k);
		await vault.setMode('remember');
		await db.meta.put({ id: 'vault', placeholder: true });
		await vault.setMode('session');

		expect(await db.keys.count()).toBe(0);
		expect(await db.meta.get('mode')).toBeUndefined();
		expect(await db.meta.get('vault')).toBeUndefined();
		expect(await vault.getKey('openai')).toBe(k);
		expect(session.getItem(SESSION_KEY)).toContain(k);
		expect(vault.getStatus().mode).toBe('session');
		expect(vault.getStatus().providers.openai.state).toBe('session');
	});

	it('remote mode-changed to session: the other tab copies its keys into its own session store', async () => {
		const k = fakeKey('anthropic');
		const a = await makeVault();
		await a.vault.setKey('anthropic', k);
		await a.vault.setMode('remember');
		const b = await makeVault({ idb: a.idb, channelName: a.channelName });
		expect(b.vault.getStatus().providers.anthropic.state).toBe('remembered');

		await a.vault.setMode('session');
		await vi.waitFor(() => expect(b.events).toContainEqual({ kind: 'mode-changed', remote: true }));
		expect(await a.db.keys.count()).toBe(0);
		expect(b.vault.getStatus().mode).toBe('session');
		expect(b.vault.getStatus().providers.anthropic.state).toBe('session');
		expect(await b.vault.getKey('anthropic')).toBe(k);
		expect(b.session.getItem(SESSION_KEY)).toContain(k);
	});

	it('remote mode-changed to remember: the other tab re-reads tran-secrets', async () => {
		const k = fakeKey('gemini');
		const a = await makeVault();
		const b = await makeVault({ idb: a.idb, channelName: a.channelName });
		await a.vault.setKey('gemini', k);
		await a.vault.setMode('remember');
		await vi.waitFor(() => expect(b.events).toContainEqual({ kind: 'mode-changed', remote: true }));
		expect(b.vault.getStatus().mode).toBe('remember');
		expect(await b.vault.getKey('gemini')).toBe(k);
	});
});

describe('removeKey', () => {
	it('removes a key from session, memory and tran-secrets', async () => {
		const { vault, db, session, events } = await makeVault();
		await vault.setKey('rentcast', fakeKey('rentcast'));
		await vault.setKey('openai', fakeKey('openai'));
		await vault.removeKey('rentcast');
		expect(await vault.getKey('rentcast')).toBeUndefined();
		expect(session.getItem(SESSION_KEY) ?? '').not.toContain(fakeKey('rentcast'));
		expect(events.at(-1)).toEqual({ kind: 'keys-changed', provider: 'rentcast', remote: false });

		await vault.setMode('remember');
		await vault.removeKey('openai');
		expect(await db.keys.get('openai')).toBeUndefined();
		expect(vault.getStatus().providers.openai.state).toBe('none');
	});
});

describe('forgetAll', () => {
	it('clears session, memory, every tran-secrets key and meta row, and resets the mode', async () => {
		const { vault, db, session, events } = await makeVault();
		await vault.setKey('anthropic', fakeKey('anthropic'));
		await vault.setMode('remember');
		await vault.setKey('rentcast', fakeKey('rentcast'));
		await db.meta.put({ id: 'vault', placeholder: true });
		session.setItem(SESSION_KEY, JSON.stringify({ openai: fakeKey('openai') }));

		await vault.forgetAll();

		expect(session.getItem(SESSION_KEY)).toBeNull();
		for (const p of PROVIDER_IDS) {
			expect(await vault.getKey(p)).toBeUndefined();
			expect(vault.getStatus().providers[p].state).toBe('none');
		}
		expect(vault.knownSecrets()).toEqual([]);
		expect(await db.keys.count()).toBe(0);
		expect(await db.meta.count()).toBe(0);
		expect(vault.getStatus().mode).toBe('session');
		expect(events.at(-1)).toEqual({ kind: 'forgotten', remote: false });
	});

	it('forgets in session mode too: a session-only key is gone from the session store', async () => {
		const { vault, session } = await makeVault();
		await vault.setKey('anthropic', fakeKey('anthropic'));
		await vault.forgetAll();
		expect(session.getItem(SESSION_KEY)).toBeNull();
		expect(await vault.getKey('anthropic')).toBeUndefined();
	});

	it('broadcasts forget-all so another tab clears ITS OWN session store and memory', async () => {
		const a = await makeVault();
		const b = await makeVault({ channelName: a.channelName });
		await a.vault.setKey('anthropic', fakeKey('anthropic'));
		await b.vault.setKey('openai', fakeKey('openai', 'B'));
		expect(b.session.getItem(SESSION_KEY)).toContain(fakeKey('openai', 'B'));

		await a.vault.forgetAll();
		await vi.waitFor(() => expect(b.events).toContainEqual({ kind: 'forgotten', remote: true }));
		expect(b.session.getItem(SESSION_KEY)).toBeNull();
		expect(await b.vault.getKey('openai')).toBeUndefined();
		expect(b.vault.getStatus().providers.openai.state).toBe('none');
	});

	it('ignores its own broadcasts (no remote event in the sending tab)', async () => {
		const a = await makeVault();
		const b = await makeVault({ channelName: a.channelName });
		await a.vault.forgetAll();
		await vi.waitFor(() => expect(b.events).toContainEqual({ kind: 'forgotten', remote: true }));
		expect(a.events.filter((e) => e.remote)).toEqual([]);
	});
});

describe('broadcast payloads', () => {
	it('carry only {type, from}: never a key or last4', async () => {
		const { vault, posted } = await makeVault();
		const keys = PROVIDER_IDS.map((p) => fakeKey(p));
		for (const [i, p] of PROVIDER_IDS.entries()) await vault.setKey(p, keys[i]!);
		await vault.setMode('remember');
		await vault.removeKey('openai');
		await vault.setMode('session');
		await vault.forgetAll();

		expect(posted.length).toBeGreaterThan(0);
		expect(new Set(posted.map((m) => m.type))).toEqual(
			new Set(['keys-changed', 'mode-changed', 'forget-all'])
		);
		for (const m of posted) {
			expect(Object.keys(m).sort()).toEqual(['from', 'type']);
			const json = JSON.stringify(m);
			for (const k of keys) {
				expect(json).not.toContain(k);
				expect(json).not.toContain(k.slice(-4));
			}
		}
	});
});

describe('storage blocked', () => {
	it('falls back to session-only when tran-secrets cannot open', async () => {
		const session = memoryStorage();
		const blocked = {
			open: () => Promise.reject(new DOMException('blocked', 'SecurityError')),
			close: () => {}
		} as unknown as SecretsDb;
		const vault = new Vault({ session, openDb: () => blocked, channel: null, tabId: 't' });
		live.push(vault);
		await vault.init();
		expect(vault.getStatus().storageBlocked).toBe(true);
		expect(vault.getStatus().mode).toBe('session');
		const err = await errOf(vault.setMode('remember'));
		expect(err).toBeInstanceOf(VaultError);
		expect((err as VaultError).code).toBe('storage-blocked');

		const k = fakeKey('rentcast');
		await vault.setKey('rentcast', k);
		expect(await vault.getKey('rentcast')).toBe(k);
		await vault.forgetAll();
		expect(await vault.getKey('rentcast')).toBeUndefined();
	});
});

describe('knownSecrets', () => {
	it('returns exactly the readable plaintext keys', async () => {
		const { vault } = await makeVault();
		expect(vault.knownSecrets()).toEqual([]);
		const a = fakeKey('anthropic');
		const r = fakeKey('rentcast');
		await vault.setKey('anthropic', a);
		await vault.setKey('rentcast', r);
		expect(vault.knownSecrets().sort()).toEqual([a, r].sort());
		await vault.setMode('remember');
		expect(vault.knownSecrets().sort()).toEqual([a, r].sort());
	});
});

describe('dispose', () => {
	it('closes the channel and stops reacting to broadcasts', async () => {
		const a = await makeVault();
		const b = await makeVault({ channelName: a.channelName });
		await b.vault.setKey('openai', fakeKey('openai'));
		b.vault.dispose();
		await a.vault.forgetAll();
		await new Promise((r) => setTimeout(r, 30));
		expect(b.events.filter((e) => e.remote)).toEqual([]);
	});
});
