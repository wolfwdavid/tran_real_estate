// The app-wide data runtime (DATA-01..04): mode selection from key state + preference, gateway
// rebuilds, reactive usage, the per-call over-cap prompt and cross-tab sync.
//
// Node `web` project: Vitest compiles `.svelte.ts` in SSR mode here, so $state fields are plain
// values and effects never run. These tests drive methods and read the resulting state; reactive
// store behaviour is covered by stores.browser.test.ts. Never vi.useFakeTimers() (Pitfall 1).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { isGatewayError, type DataRequest } from '@tran/core/request';
import { loadFixtureSet } from './fixtures/load';
import { ReactiveSpendError } from './gateway';
import { createDataDb, type DataDb, type RentCastKeyState } from './platform';
import { createPrefsRepo } from './prefs-repo';
import { createLedgerRepo } from './ledger-repo';
import {
	createDataRuntime,
	type ChannelLike,
	type DataMessage,
	type DataRuntime,
	type KeyPort
} from './runtime.svelte';
import { jsonResponse, makeDb, spyFetch, T0, TEST_KEY } from './testing/harness';
import { listingRows, rentals } from './testing/gateway-harness';

// ---------------------------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------------------------

function fakeKeys(initial: { key: string | null; state: RentCastKeyState }) {
	const listeners = new Set<() => void>();
	let key = initial.key;
	let state = initial.state;
	const port: KeyPort = {
		get: () => key,
		state: () => state,
		onChange(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		}
	};
	return {
		port,
		listeners,
		set(next: { key: string | null; state: RentCastKeyState }) {
			key = next.key;
			state = next.state;
			for (const l of [...listeners]) l();
		}
	};
}

/** An in-memory BroadcastChannel stand-in: like the real one, a sender never hears itself. */
function fakeBus() {
	const members = new Set<{ deliver: (m: DataMessage) => void }>();
	const posted: DataMessage[] = [];
	function channel() {
		const handlers = new Set<(e: { data: DataMessage }) => void>();
		const self = {
			deliver: (m: DataMessage) => {
				for (const h of [...handlers]) h({ data: m });
			}
		};
		members.add(self);
		const state = { closed: false };
		const ch: ChannelLike & { state: typeof state } = {
			state,
			postMessage(m) {
				posted.push(m);
				for (const other of [...members]) {
					if (other !== self) queueMicrotask(() => other.deliver(structuredClone(m)));
				}
			},
			addEventListener(_t, cb) {
				handlers.add(cb);
			},
			close() {
				state.closed = true;
				members.delete(self);
				handlers.clear();
			}
		};
		return ch;
	}
	return { channel, posted };
}

/** Two Dexie connections to one fake IndexedDB database: two tabs of the same origin. */
function sharedDbs(): [DataDb, DataDb] {
	const indexedDB = new IDBFactory();
	const name = `t-${crypto.randomUUID()}`;
	return [
		createDataDb({ name, indexedDB, IDBKeyRange }),
		createDataDb({ name, indexedDB, IDBKeyRange })
	];
}

const LIVE = { key: TEST_KEY, state: 'available' as const };
const NO_KEY = { key: null, state: 'none' as const };

const okListings = () =>
	spyFetch((url) => jsonResponse(200, listingRows(2, url.searchParams.get('zipCode') ?? '74201')));

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function started(rt: DataRuntime): Promise<DataRuntime> {
	cleanups.push(await rt.start());
	return rt;
}

function makeRuntime(
	opts: {
		db?: DataDb;
		keys?: KeyPort;
		fetch?: typeof fetch;
		channel?: ChannelLike | null;
		reactiveGuard?: () => boolean;
		clock?: () => number;
	} = {}
) {
	const loadFixtures = vi.fn(loadFixtureSet);
	const net = opts.fetch ? { fetch: opts.fetch, calls: [] } : okListings();
	const rt = createDataRuntime({
		db: opts.db ?? makeDb(),
		clock: opts.clock ?? (() => T0),
		fetch: net.fetch,
		keys: opts.keys ?? fakeKeys(LIVE).port,
		channel: opts.channel === undefined ? null : opts.channel,
		reactiveGuard: opts.reactiveGuard ?? (() => false),
		loadFixtures
	});
	return { rt, loadFixtures, calls: net.calls };
}

// ---------------------------------------------------------------------------------------------
// Mode selection and gateway lifecycle
// ---------------------------------------------------------------------------------------------

describe('mode selection', () => {
	it('starts with no mode, then no key → sample/no-key with a sample gateway', async () => {
		const { rt, loadFixtures } = makeRuntime({ keys: fakeKeys(NO_KEY).port });
		expect(rt.mode).toBeNull();
		expect(rt.gateway).toBeNull();
		await started(rt);
		expect(rt.mode).toEqual({ source: 'sample', reason: 'no-key' });
		expect(rt.gateway?.source).toBe('sample');
		expect(loadFixtures).toHaveBeenCalledTimes(1);
	});

	it('a readable key + default preference → rentcast/live, fixtures never loaded', async () => {
		const { rt, loadFixtures } = makeRuntime();
		await started(rt);
		expect(rt.mode).toEqual({ source: 'rentcast', reason: 'live' });
		expect(rt.gateway?.source).toBe('rentcast');
		expect(loadFixtures).not.toHaveBeenCalled();
	});

	it('a key change to locked rebuilds as sample/locked', async () => {
		const keys = fakeKeys(LIVE);
		const { rt } = makeRuntime({ keys: keys.port });
		await started(rt);
		const live = rt.gateway;
		keys.set({ key: null, state: 'locked' });
		await vi.waitFor(() => expect(rt.mode).toEqual({ source: 'sample', reason: 'locked' }));
		expect(rt.gateway?.source).toBe('sample');
		expect(rt.gateway).not.toBe(live);
	});

	it('loads fixtures once across repeated sample rebuilds', async () => {
		const keys = fakeKeys(NO_KEY);
		const { rt, loadFixtures } = makeRuntime({ keys: keys.port });
		await started(rt);
		keys.set({ key: null, state: 'locked' });
		await vi.waitFor(() => expect(rt.mode?.reason).toBe('locked'));
		expect(loadFixtures).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------------------------
// Preference, cap and cross-tab sync
// ---------------------------------------------------------------------------------------------

describe('preference, cap and cross-tab sync', () => {
	it('source and cap changes reach the other tab; seq counts every remote message', async () => {
		const [dbA, dbB] = sharedDbs();
		const bus = fakeBus();
		const a = await started(makeRuntime({ db: dbA, channel: bus.channel() }).rt);
		const b = await started(makeRuntime({ db: dbB, channel: bus.channel() }).rt);
		expect(b.mode?.source).toBe('rentcast');
		expect(b.lastRemoteChange).toBeNull();

		await a.setSourcePreference('sample');
		expect(a.mode).toEqual({ source: 'sample', reason: 'chosen' });
		expect(await createPrefsRepo(dbA, () => T0).readSource()).toBe('sample');
		await vi.waitFor(() => expect(b.lastRemoteChange).toEqual({ type: 'source-changed', seq: 1 }));
		expect(b.mode).toEqual({ source: 'sample', reason: 'chosen' });
		expect(b.gateway?.source).toBe('sample');
		expect(a.lastRemoteChange).toBeNull(); // a sender never hears itself

		await a.saveCap(25);
		expect(await createLedgerRepo(dbA, () => T0).readCap()).toBe(25);
		expect(a.usage?.cap).toBe(25);
		await vi.waitFor(() => expect(b.lastRemoteChange).toEqual({ type: 'cap-changed', seq: 2 }));
		expect(b.usage?.cap).toBe(25);
		expect(bus.posted).toEqual([{ type: 'source-changed' }, { type: 'cap-changed' }]);
	});

	it('saveCap(0) rejects with RangeError and broadcasts nothing', async () => {
		const bus = fakeBus();
		const { rt } = makeRuntime({ channel: bus.channel() });
		await started(rt);
		await expect(rt.saveCap(0)).rejects.toBeInstanceOf(RangeError);
		expect(bus.posted).toEqual([]);
	});

	it('works without a channel (BroadcastChannel unavailable)', async () => {
		const { rt } = makeRuntime({ channel: null });
		await started(rt);
		await rt.setSourcePreference('sample');
		await rt.saveCap(10);
		expect(rt.mode?.reason).toBe('chosen');
		expect(rt.usage?.cap).toBe(10);
	});
});

// ---------------------------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------------------------

describe('usage', () => {
	it('reflects the ledger after a spend and carries the meter state', async () => {
		const { rt, calls } = makeRuntime();
		await started(rt);
		expect(rt.usage).toMatchObject({ countedTowardCap: 0, cap: 40, state: 'ok' });
		await rt.saveCap(1);
		await rt.requestSpend(rentals('74201'));
		expect(calls).toHaveLength(1);
		expect(rt.usage).toMatchObject({ countedTowardCap: 1, cap: 1, state: 'at' });
	});
});

// ---------------------------------------------------------------------------------------------
// Over-cap prompt (per call, never remembered)
// ---------------------------------------------------------------------------------------------

describe('over-cap prompt', () => {
	async function atCap() {
		const { rt, calls } = makeRuntime();
		await started(rt);
		await rt.saveCap(1);
		await rt.requestSpend(rentals('74201'));
		expect(calls).toHaveLength(1);
		return { rt, calls };
	}

	it('prompts instead of failing; confirm spends exactly one call with a fresh grant', async () => {
		const { rt, calls } = await atCap();
		const p = rt.requestSpend(rentals('74203'));
		await vi.waitFor(() => expect(rt.capPrompt).not.toBeNull());
		expect(rt.capPrompt).toMatchObject({ used: 1, cap: 1 });
		expect(rt.capPrompt?.requestKey).toEqual(expect.any(String));
		expect(calls).toHaveLength(1);

		await rt.confirmCapPrompt();
		expect(calls).toHaveLength(2);
		const result = await p;
		expect(result.provenance.source).toBe('rentcast');
		expect(rt.capPrompt).toBeNull();
		expect(rt.usage?.countedTowardCap).toBe(2);
	});

	it('the next over-cap call prompts again; cancelling rejects dismissed with no fetch', async () => {
		const { rt, calls } = await atCap();
		const first = rt.requestSpend(rentals('74203'));
		await vi.waitFor(() => expect(rt.capPrompt).not.toBeNull());
		await rt.confirmCapPrompt();
		await first;
		expect(calls).toHaveLength(2);

		const second = rt.requestSpend(rentals('70201'));
		await vi.waitFor(() => expect(rt.capPrompt).not.toBeNull());
		expect(rt.capPrompt).toMatchObject({ used: 2, cap: 1 });
		rt.cancelCapPrompt();
		const err = await second.catch((e: unknown) => e);
		expect(isGatewayError(err)).toBe(true);
		expect(err).toMatchObject({ kind: 'BudgetCapReached', detail: 'dismissed', used: 2, cap: 1 });
		expect(rt.capPrompt).toBeNull();
		expect(calls).toHaveLength(2);
	});

	it('refresh past the cap goes through the same prompt', async () => {
		const { rt, calls } = await atCap();
		const p = rt.requestSpend(rentals('74201'), 'refresh');
		await vi.waitFor(() => expect(rt.capPrompt).not.toBeNull());
		expect(calls).toHaveLength(1);
		await rt.confirmCapPrompt();
		await p;
		expect(calls).toHaveLength(2);
	});

	it('non-cap errors reject directly without a prompt', async () => {
		const { rt } = makeRuntime({ fetch: spyFetch(() => jsonResponse(401, {})).fetch });
		await started(rt);
		const err = await rt.requestSpend(rentals('74201')).catch((e: unknown) => e);
		expect(err).toMatchObject({ kind: 'InvalidKey' });
		expect(rt.capPrompt).toBeNull();
	});

	it('cancel and confirm with no prompt are no-ops', async () => {
		const { rt, calls } = makeRuntime();
		await started(rt);
		rt.cancelCapPrompt();
		await rt.confirmCapPrompt();
		expect(calls).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------------------------
// Key test
// ---------------------------------------------------------------------------------------------

describe('testKey', () => {
	it('no saved key → bad-format/empty, nothing sent', async () => {
		const { rt, calls } = makeRuntime({ keys: fakeKeys(NO_KEY).port });
		await started(rt);
		expect(await rt.testKey()).toEqual({ outcome: 'bad-format', formatError: 'empty', at: T0 });
		expect(calls).toHaveLength(0);
	});

	it('a well-formed key answered 404 → valid at the clock', async () => {
		const net = spyFetch(() => jsonResponse(404, {}));
		const { rt } = makeRuntime({
			keys: fakeKeys({ key: 'k'.repeat(32), state: 'available' }).port,
			fetch: net.fetch,
			clock: () => T0 + 5
		});
		await started(rt);
		expect(await rt.testKey()).toEqual({ outcome: 'valid', at: T0 + 5 });
		expect(net.calls).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------------------------
// Reactive guard
// ---------------------------------------------------------------------------------------------

describe('reactive guard', () => {
	it('requestSpend and the runtime-built gateway refuse to spend in a tracking context', async () => {
		const { rt, calls } = makeRuntime({ reactiveGuard: () => true });
		await started(rt);
		await expect(rt.requestSpend(rentals('74201'))).rejects.toBeInstanceOf(ReactiveSpendError);
		await expect(rt.gateway!.get(rentals('74201'))).rejects.toBeInstanceOf(ReactiveSpendError);
		await expect(rt.gateway!.peek(rentals('74201'))).resolves.toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it('the sample gateway built by the runtime is guarded too', async () => {
		const { rt } = makeRuntime({ keys: fakeKeys(NO_KEY).port, reactiveGuard: () => true });
		await started(rt);
		const req: DataRequest = rentals('74201');
		await expect(rt.gateway!.get(req)).rejects.toBeInstanceOf(ReactiveSpendError);
	});
});

// ---------------------------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------------------------

describe('cleanup', () => {
	it('unsubscribes the key listener and closes the channel', async () => {
		const keys = fakeKeys(LIVE);
		const bus = fakeBus();
		const ch = bus.channel();
		const { rt } = makeRuntime({ keys: keys.port, channel: ch });
		const stop = await rt.start();
		expect(keys.listeners.size).toBe(1);
		stop();
		expect(keys.listeners.size).toBe(0);
		expect(ch.state.closed).toBe(true);
		keys.set({ key: null, state: 'locked' });
		await new Promise((r) => setTimeout(r, 20));
		expect(rt.mode?.source).toBe('rentcast');
	});

	it('cleanup dismisses a parked prompt', async () => {
		const { rt } = makeRuntime();
		const stop = await rt.start();
		await rt.saveCap(1);
		await rt.requestSpend(rentals('74201'));
		const p = rt.requestSpend(rentals('74203'));
		await vi.waitFor(() => expect(rt.capPrompt).not.toBeNull());
		stop();
		await expect(p).rejects.toMatchObject({ kind: 'BudgetCapReached', detail: 'dismissed' });
	});
});
