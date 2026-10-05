// The on-open saved-search check behind the public port (DATA-03): the (app) layout calls
// checkSavedSearchesOnOpen once after runtime.start(). It runs through the runtime's current
// gateway, so sample mode is free and live mode stays inside the cap. Injected clock, fresh
// fake-indexeddb databases and fetch spies only; never fake timers (RESEARCH Pitfall 1).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSavedSearchesOnOpen, savedSearchRepo } from './alerts';
import { loadFixtureSet } from './fixtures/load';
import type { DataDb, RentCastKeyState } from './platform';
import { createDataRuntime, type DataRuntime, type KeyPort } from './runtime.svelte';
import { noLock, type ConfirmInput } from './scheduler';
import { jsonResponse, makeDb, spyFetch, T0, TEST_KEY } from './testing/harness';
import { listingRows } from './testing/gateway-harness';

const keys = (state: RentCastKeyState): KeyPort => ({
	get: () => (state === 'available' ? TEST_KEY : null),
	state: () => state,
	onChange: () => () => undefined
});

const search = (zip: string) => ({
	portal: 'renter' as const,
	name: `Rentals in ${zip}`,
	endpoint: 'rental-listings' as const,
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup(state: RentCastKeyState, zips: string[], opts: { start?: boolean } = {}) {
	const db: DataDb = makeDb();
	const clock = () => T0;
	const net = spyFetch((url) =>
		jsonResponse(200, listingRows(2, url.searchParams.get('zipCode') ?? '74201'))
	);
	const rt: DataRuntime = createDataRuntime({
		db,
		clock,
		fetch: net.fetch,
		keys: keys(state),
		channel: null,
		reactiveGuard: () => false,
		loadFixtures: loadFixtureSet
	});
	if (opts.start !== false) cleanups.push(await rt.start());
	const repo = savedSearchRepo({ db, clock });
	for (const zip of zips) await repo.create(search(zip));
	const deps = { db, clock, lock: noLock };
	return { rt, db, clock, calls: net.calls, repo, deps };
}

describe('checkSavedSearchesOnOpen', () => {
	it('returns undefined before the runtime has started (no mode yet), spending nothing', async () => {
		const { rt, calls, deps } = await setup('available', ['74201'], { start: false });
		const confirm = vi.fn(async () => true);
		expect(rt.mode).toBeNull();
		expect(await checkSavedSearchesOnOpen(rt, confirm, deps)).toBeUndefined();
		expect(confirm).not.toHaveBeenCalled();
		expect(calls).toHaveLength(0);
	});

	it('returns undefined when the mode is rentcast but there is no gateway', async () => {
		const { calls, deps } = await setup('available', ['74201'], { start: false });
		const fake = {
			mode: { source: 'rentcast', reason: 'live' },
			gateway: null
		} as unknown as DataRuntime;
		const confirm = vi.fn(async () => true);
		expect(await checkSavedSearchesOnOpen(fake, confirm, deps)).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it('live with 2 due: runs both without asking and returns the scheduler result', async () => {
		const { rt, calls, deps } = await setup('available', ['74201', '74202']);
		const confirm = vi.fn(async () => true);
		const res = await checkSavedSearchesOnOpen(rt, confirm, deps);
		expect(confirm).not.toHaveBeenCalled();
		expect(res).toBeDefined();
		expect(res!.ran).toHaveLength(2);
		expect(res!.skipped).toBeNull();
		expect(res!.due).toBe(2);
		expect(calls).toHaveLength(2);
	});

	it('live with 5 due: asks once; declining spends nothing and reports declined', async () => {
		const zips = ['74201', '74202', '74203', '74204', '74205'];
		const { rt, calls, deps } = await setup('available', zips);
		const confirm = vi.fn<(input: ConfirmInput) => Promise<boolean>>(async () => false);
		const res = await checkSavedSearchesOnOpen(rt, confirm, deps);
		expect(confirm).toHaveBeenCalledOnce();
		const input = confirm.mock.calls[0]![0];
		expect(input.due).toHaveLength(5);
		expect(input.run).toHaveLength(5);
		expect(input.calls).toBe(5);
		expect(input.cap).toBe(40);
		expect(res!.skipped).toBe('declined');
		expect(res!.ran).toHaveLength(0);
		expect(calls).toHaveLength(0);
	});

	it('reports progress before each search it runs', async () => {
		const zips = ['74201', '74202', '74203', '74204', '74205'];
		const { rt, calls, deps } = await setup('available', zips);
		const progress: [number, number][] = [];
		const res = await checkSavedSearchesOnOpen(rt, async () => true, {
			...deps,
			onProgress: (i, k) => progress.push([i, k])
		});
		expect(res!.ran).toHaveLength(5);
		expect(calls).toHaveLength(5);
		expect(progress).toEqual([
			[1, 5],
			[2, 5],
			[3, 5],
			[4, 5],
			[5, 5]
		]);
	});

	it('sample with 5 due: never asks and makes 0 live fetches', async () => {
		const zips = ['74201', '74203', '70201', '70204', '85801'];
		const { rt, calls, deps, db } = await setup('none', zips);
		expect(rt.mode?.source).toBe('sample');
		const confirm = vi.fn(async () => true);
		const res = await checkSavedSearchesOnOpen(rt, confirm, deps);
		expect(confirm).not.toHaveBeenCalled();
		expect(calls).toHaveLength(0);
		expect(res!.ran).toHaveLength(5);
		expect(await db.ledger.count()).toBe(0);
	});
});

describe('savedSearchRepo', () => {
	it('returns a working repository over the injected database', async () => {
		const db = makeDb();
		const repo = savedSearchRepo({ db, clock: () => T0 });
		const row = await repo.create(search('74201'));
		const rows = await repo.list();
		expect(rows.map((r) => r.id)).toEqual([row.id]);
		expect(rows[0]!.name).toBe('Rentals in 74201');
		expect(rows[0]!.lastRunAt).toBeNull();
	});
});
