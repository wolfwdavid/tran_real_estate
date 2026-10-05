// The RentCast "Test key (0 calls)" hook (DATA-05, success criterion 5): the Phase 3 tester
// registration and the reactive, key-bound result the RentCast key card renders.
//
// Node `web` project: `.svelte.ts` compiles in SSR mode here, so `rentCastKeyTest.current` is a
// plain value and can be asserted directly. fake-indexeddb + fetch spies; never fake timers.
import { afterEach, describe, expect, it } from 'vitest';
import { loadFixtureSet } from './fixtures/load';
import { enableRentCastKeyTest, rentCastKeyTest } from './key-test.svelte';
import { createLedgerRepo } from './ledger-repo';
import type { RentCastKeyTestOutcome } from './platform';
import { createDataRuntime, type DataRuntime, type KeyPort } from './runtime.svelte';
import { jsonResponse, makeDb, spyFetch, T0 } from './testing/harness';

const GOOD_KEY = 'k'.repeat(32);

type Tester = (key: string) => Promise<RentCastKeyTestOutcome>;

function fakeHooks() {
	const registered: Tester[] = [];
	const keyListeners = new Set<() => void>();
	let unregistered = 0;
	return {
		registered,
		keyListeners,
		get unregistered() {
			return unregistered;
		},
		register: (fn: Tester) => {
			registered.push(fn);
			return () => {
				unregistered++;
			};
		},
		onKeyChange: (cb: () => void) => {
			keyListeners.add(cb);
			return () => keyListeners.delete(cb);
		},
		fireKeyChange: () => {
			for (const l of [...keyListeners]) l();
		}
	};
}

const keys: KeyPort = {
	get: () => GOOD_KEY,
	state: () => 'available',
	onChange: () => () => undefined
};

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup(status: number | 'throw', mode: 'live' | 'sample' = 'live') {
	const db = makeDb();
	const net = spyFetch(() => {
		if (status === 'throw') throw new TypeError('Failed to fetch');
		return jsonResponse(status, status === 200 ? [{ id: 'x' }] : {});
	});
	const rt: DataRuntime = createDataRuntime({
		db,
		clock: () => T0,
		fetch: net.fetch,
		keys:
			mode === 'live'
				? keys
				: { get: () => null, state: () => 'none', onChange: () => () => undefined },
		channel: null,
		reactiveGuard: () => false,
		loadFixtures: loadFixtureSet
	});
	cleanups.push(await rt.start());
	const hooks = fakeHooks();
	const stop = enableRentCastKeyTest(rt, {
		register: hooks.register,
		onKeyChange: hooks.onKeyChange,
		clock: () => T0 + 7
	});
	cleanups.push(stop);
	return { rt, db, net, hooks, stop };
}

describe('enableRentCastKeyTest', () => {
	it('registers exactly one tester and returns a cleanup that unregisters it', async () => {
		const { hooks, stop } = await setup(404);
		expect(hooks.registered).toHaveLength(1);
		expect(hooks.keyListeners.size).toBe(1);
		stop();
		expect(hooks.unregistered).toBe(1);
		expect(hooks.keyListeners.size).toBe(0);
	});

	it('404 → valid, one probe request, result recorded at the clock', async () => {
		const { hooks, net } = await setup(404);
		expect(rentCastKeyTest.current).toBeNull();
		await expect(hooks.registered[0]!(GOOD_KEY)).resolves.toBe('valid');
		expect(rentCastKeyTest.current).toEqual({ outcome: 'valid', at: T0 + 7 });
		expect(net.calls).toHaveLength(1);
		expect(net.calls[0]!.url).toContain('api.rentcast.io');
	});

	it('401 → invalid; 403 → restricted', async () => {
		const a = await setup(401);
		await expect(a.hooks.registered[0]!(GOOD_KEY)).resolves.toBe('invalid');
		expect(rentCastKeyTest.current?.outcome).toBe('invalid');

		const b = await setup(403);
		await expect(b.hooks.registered[0]!(GOOD_KEY)).resolves.toBe('restricted');
		expect(rentCastKeyTest.current?.outcome).toBe('restricted');
	});

	it('tests the key it is given (the vault key), not a stale mirror', async () => {
		const { hooks, net } = await setup(404);
		const other = 'z'.repeat(32);
		await hooks.registered[0]!(other);
		expect(net.calls[0]!.headers['x-api-key']).toBe(other);
	});

	it('a bad-format key records bad-format/whitespace, sends nothing, and reports invalid to Phase 3', async () => {
		const { hooks, net } = await setup(404);
		await expect(hooks.registered[0]!('abc def')).resolves.toBe('invalid');
		expect(rentCastKeyTest.current).toEqual({
			outcome: 'bad-format',
			formatError: 'whitespace',
			at: T0 + 7
		});
		expect(net.calls).toHaveLength(0);
	});

	it('a network failure records unverified', async () => {
		const { hooks } = await setup('throw');
		await expect(hooks.registered[0]!(GOOD_KEY)).resolves.toBe('unverified');
		expect(rentCastKeyTest.current?.outcome).toBe('unverified');
	});

	it('a key change resets the result to null', async () => {
		const { hooks } = await setup(404);
		await hooks.registered[0]!(GOOD_KEY);
		expect(rentCastKeyTest.current).not.toBeNull();
		hooks.fireKeyChange();
		expect(rentCastKeyTest.current).toBeNull();
	});

	it('a key change during a test drops that test result', async () => {
		const { hooks } = await setup(404);
		const p = hooks.registered[0]!(GOOD_KEY);
		hooks.fireKeyChange();
		await p;
		expect(rentCastKeyTest.current).toBeNull();
	});

	it('cleanup clears the result', async () => {
		const { hooks, stop } = await setup(404);
		await hooks.registered[0]!(GOOD_KEY);
		stop();
		expect(rentCastKeyTest.current).toBeNull();
	});

	it('200 → valid-billed, one counted key-test ledger row, usage refreshed', async () => {
		const { rt, db, hooks } = await setup(200);
		await expect(hooks.registered[0]!(GOOD_KEY)).resolves.toBe('valid-billed');
		expect(rentCastKeyTest.current?.outcome).toBe('valid-billed');
		const rows = await db.table('ledger').toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ intent: 'key-test' });
		const usage = await createLedgerRepo(db, () => T0).usage();
		expect(usage.countedTowardCap).toBe(1);
		expect(rt.usage?.countedTowardCap).toBe(1);
	});

	it('probes RentCast in sample mode too (a key test always targets RentCast)', async () => {
		const { hooks, net } = await setup(404, 'sample');
		await expect(hooks.registered[0]!(GOOD_KEY)).resolves.toBe('valid');
		expect(net.calls).toHaveLength(1);
	});
});
