// Check-on-open alerts scheduler call counts (DATA-03, roadmap success criterion 3): opening the app
// with 5 due saved searches runs each at most once per 24 hours, sequentially, never past the cap,
// and two tabs together still make exactly 5 calls. Injected clock, fresh fake-indexeddb databases
// and fetch spies only; never fake timers (RESEARCH Pitfall 1).
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countNewSince, DUE_AFTER_MS } from '@tran/core/alerts';
import estimates from './fixtures/estimates.json';
import markets from './fixtures/markets.json';
import meta from './fixtures/meta.json';
import metros from './fixtures/metros.json';
import rentalsJson from './fixtures/rentals.json';
import sales from './fixtures/sales.json';
import type { FixtureSet } from './fixtures/fixture-fetch';
import { createSampleGateway, type DataGateway } from './gateway';
import { createLedgerRepo, type LedgerRepo } from './ledger-repo';
import { createDataDb, type DataDb } from './platform';
import { createSavedSearchRepo, type SavedSearchRepo } from './saved-search-repo';
import { browserLock, noLock, runDueSearches, type ConfirmInput, type LockPort } from './scheduler';
import { jsonResponse, makeDb, spyFetch, T0 } from './testing/harness';
import { listingRow, listingRows, makeGateway } from './testing/gateway-harness';

const HOUR = 3_600_000;
const ZIPS = ['74201', '74202', '74203', '74204', '74205'];

const FIXTURES = {
	meta,
	metros,
	rentals: rentalsJson,
	sales,
	estimates,
	markets
} as unknown as FixtureSet;

const open: DataDb[] = [];
afterEach(() => {
	for (const db of open.splice(0)) db.close();
});

const zipOf = (url: string) => new URL(url).searchParams.get('zipCode');

/** RentCast stand-in: 3 rows per ZIP plus any extra rows added by a test. */
function rentcast() {
	const extra = new Map<string, Record<string, unknown>[]>();
	const status = new Map<string, number>();
	const spy = spyFetch((url) => {
		const zip = url.searchParams.get('zipCode') ?? '';
		const s = status.get(zip);
		if (s !== undefined) return jsonResponse(s, s === 404 ? [] : { message: 'down' });
		return jsonResponse(200, [...listingRows(3, zip), ...(extra.get(zip) ?? [])]);
	});
	return { spy, extra, status };
}

async function seedUsage(ledger: LedgerRepo, used: number) {
	for (let i = 0; i < used; i++) {
		await ledger.settle(
			await ledger.reserve({ endpoint: 'rental-listings', key: `seed-${i}`, intent: 'user' }),
			200
		);
	}
}

const search = (zip: string) => ({
	portal: 'renter' as const,
	name: `Rentals in ${zip}`,
	endpoint: 'rental-listings' as const,
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});

/** One "tab": a live gateway and a saved-search repo over `db`, sharing the test clock. */
async function world(opts: { cap?: number; used?: number; zips?: string[]; db?: DataDb } = {}) {
	const clock = { now: T0 };
	const tick = () => clock.now;
	const rc = rentcast();
	const g = makeGateway({ fetch: rc.spy.fetch, clock: tick, cap: opts.cap ?? 40, db: opts.db });
	open.push(g.db);
	await g.ready;
	await seedUsage(g.ledger, opts.used ?? 0);
	const repo = createSavedSearchRepo(g.db, tick);
	const ids: string[] = [];
	for (const zip of opts.zips ?? ZIPS) ids.push((await repo.create(search(zip))).id);
	const confirm = vi.fn<(input: ConfirmInput) => Promise<boolean>>(async () => true);
	const run = (over: Partial<Parameters<typeof runDueSearches>[0]> = {}) =>
		runDueSearches({ gateway: g.gateway, repo, clock: tick, confirm, ...over });
	return { ...g, clock, tick, rc, repo, ids, confirm, run };
}

const lastRunAts = async (repo: SavedSearchRepo) => (await repo.list()).map((r) => r.lastRunAt);

describe('5 due saved searches on open', () => {
	it('runs each exactly once after one confirmation (more than 3 due)', async () => {
		const w = await world();
		const res = await w.run();
		expect(w.confirm).toHaveBeenCalledTimes(1);
		const input = w.confirm.mock.calls[0]![0];
		expect(input.run).toHaveLength(5);
		expect(input.due).toHaveLength(5);
		expect(input.calls).toBe(5);
		expect(input.used).toBe(0);
		expect(input.cap).toBe(40);
		expect(w.rc.spy.calls).toHaveLength(5);
		expect(new Set(w.rc.spy.calls.map((c) => zipOf(c.url)))).toEqual(new Set(ZIPS));
		expect(res).toMatchObject({ skipped: null, due: 5, waiting: [], newListings: 0 });
		expect([...res.ran].sort()).toEqual([...w.ids].sort());
		expect(await lastRunAts(w.repo)).toEqual([T0, T0, T0, T0, T0]);
		expect((await w.repo.list()).every((r) => r.claimedAt === null)).toBe(true);
	});

	it('a second pass at once, or 23 h later, spends 0; 24 h later all 5 are due again', async () => {
		const w = await world();
		await w.run();
		w.confirm.mockClear();

		const again = await w.run();
		expect(w.rc.spy.calls).toHaveLength(5);
		expect(w.confirm).not.toHaveBeenCalled();
		expect(again).toMatchObject({ due: 0, ran: [], waiting: [], skipped: null });

		w.clock.now = T0 + 23 * HOUR;
		expect((await w.run()).due).toBe(0);
		expect(w.rc.spy.calls).toHaveLength(5);
		expect(w.confirm).not.toHaveBeenCalled();

		w.clock.now = T0 + 24 * HOUR;
		expect(T0 + 24 * HOUR).toBe(T0 + DUE_AFTER_MS);
		const day2 = await w.run();
		expect(day2.due).toBe(5);
		expect(day2.ran).toHaveLength(5);
		expect(w.rc.spy.calls).toHaveLength(10);
		expect(w.confirm).toHaveBeenCalledTimes(1);
		expect(await lastRunAts(w.repo)).toEqual(Array(5).fill(T0 + 24 * HOUR));
	});

	it('3 due runs without asking', async () => {
		const w = await world({ zips: ZIPS.slice(0, 3) });
		const res = await w.run();
		expect(w.confirm).not.toHaveBeenCalled();
		expect(w.rc.spy.calls).toHaveLength(3);
		expect(res.ran).toHaveLength(3);
	});

	it('declining spends nothing and leaves every lastRunAt unchanged', async () => {
		const w = await world();
		w.confirm.mockResolvedValue(false);
		const res = await w.run();
		expect(w.rc.spy.calls).toHaveLength(0);
		expect(res.skipped).toBe('declined');
		expect(res.ran).toEqual([]);
		expect([...res.waiting].sort()).toEqual([...w.ids].sort());
		expect(await lastRunAts(w.repo)).toEqual([null, null, null, null, null]);
		expect((await w.repo.list()).every((r) => r.claimedAt === null)).toBe(true);
		expect((await w.gateway.usage()).countedTowardCap).toBe(0);
	});
});

describe('the cap', () => {
	it('at used: 38 of 40 runs the 2 oldest, leaves 3 waiting, and never throws', async () => {
		const w = await world({ used: 38 });
		// Distinct ages: ZIPS[4] is the oldest, ZIPS[0] the newest.
		for (const [i, id] of w.ids.entries()) {
			await w.db.savedSearches.update(id, { lastRunAt: T0 - DUE_AFTER_MS - i * HOUR });
		}
		const res = await w.run();
		expect(w.confirm).toHaveBeenCalledTimes(1);
		expect(w.confirm.mock.calls[0]![0].run).toHaveLength(2);
		expect(w.confirm.mock.calls[0]![0].calls).toBe(2);
		expect(w.rc.spy.calls.map((c) => zipOf(c.url))).toEqual(['74205', '74204']);
		expect(res.ran).toEqual([w.ids[4], w.ids[3]]);
		expect(res.waiting).toEqual([w.ids[2], w.ids[1], w.ids[0]]);
		expect(res.skipped).toBeNull();
		const usage = await w.gateway.usage();
		expect(usage.countedTowardCap).toBe(40);
	});

	it('at the cap runs none, does not ask, and reports all 5 waiting', async () => {
		const w = await world({ used: 40 });
		const res = await w.run();
		expect(w.rc.spy.calls).toHaveLength(0);
		expect(w.confirm).not.toHaveBeenCalled();
		expect(res.skipped).toBe('cap');
		expect(res.waiting).toHaveLength(5);
		expect(res.ran).toEqual([]);
		expect(await lastRunAts(w.repo)).toEqual([null, null, null, null, null]);
	});

	it('BudgetCapReached mid-run (another tab spent the last calls) stops cleanly', async () => {
		const w = await world({ used: 37 });
		const other = createLedgerRepo(w.db, w.tick);
		const realGet = w.gateway.get.bind(w.gateway);
		let first = true;
		vi.spyOn(w.gateway, 'get').mockImplementation(async (req, o) => {
			if (first) {
				first = false;
				await seedUsage(other, 2); // the other tab: 39 of 40 after this
			}
			return realGet(req, o);
		});
		const res = await w.run();
		expect(w.confirm.mock.calls[0]![0].run).toHaveLength(3);
		expect(w.rc.spy.calls).toHaveLength(1);
		expect(res.ran).toHaveLength(1);
		expect(res.waiting).toHaveLength(4);
		expect(res.skipped).toBe('cap');
		const rows = await w.repo.list();
		expect(rows.filter((r) => r.lastRunAt === T0)).toHaveLength(1);
		expect(rows.every((r) => r.claimedAt === null)).toBe(true);
		expect((await w.gateway.usage()).countedTowardCap).toBe(40);
	});

	it('two due searches with the same ZIP share one call', async () => {
		const w = await world({ zips: ['74201', '74201'] });
		const res = await w.run();
		expect(w.rc.spy.calls).toHaveLength(1);
		expect(res.ran).toHaveLength(2);
		expect(await lastRunAts(w.repo)).toEqual([T0, T0]);
	});

	it("uses gateway.get with intent 'scheduler' only: never a grant, never refresh", async () => {
		const w = await world();
		const get = vi.spyOn(w.gateway, 'get');
		const refresh = vi.spyOn(w.gateway, 'refresh');
		const grant = vi.spyOn(w.gateway, 'grantOverCap');
		await w.run();
		expect(get).toHaveBeenCalledTimes(5);
		for (const call of get.mock.calls) expect(call[1]).toEqual({ intent: 'scheduler' });
		expect(refresh).not.toHaveBeenCalled();
		expect(grant).not.toHaveBeenCalled();
		const ledger = await w.db.ledger.toArray();
		expect(ledger.every((r) => r.intent === 'scheduler' && r.overCap === false)).toBe(true);
	});
});

describe('two tabs', () => {
	async function twoTabs() {
		const indexedDB = new IDBFactory();
		const name = `sched-${crypto.randomUUID()}`;
		const dbA = createDataDb({ name, indexedDB, IDBKeyRange });
		const dbB = createDataDb({ name, indexedDB, IDBKeyRange });
		const a = await world({ db: dbA });
		await dbB.open();
		open.push(dbB);
		const b = await world({ db: dbB, zips: [] });
		return { a, b };
	}

	it('two schedulers started together over the same 5 due searches make exactly 5 fetches', async () => {
		for (let i = 0; i < 5; i++) {
			const { a, b } = await twoTabs();
			const [ra, rb] = await Promise.all([a.run(), b.run()]);
			expect(a.rc.spy.calls.length + b.rc.spy.calls.length).toBe(5);
			expect(ra.ran.length + rb.ran.length).toBe(5);
			expect(new Set([...ra.ran, ...rb.ran]).size).toBe(5);
			expect(await lastRunAts(a.repo)).toEqual(Array(5).fill(T0));
		}
	});

	it("a held lock (another tab is already checking) skips as 'busy' with 0 fetches", async () => {
		const w = await world();
		const busy: LockPort = { run: async () => null };
		const res = await w.run({ lock: busy });
		expect(res).toMatchObject({ skipped: 'busy', ran: [], due: 0 });
		expect(w.rc.spy.calls).toHaveLength(0);
		expect(w.confirm).not.toHaveBeenCalled();
	});

	it('noLock runs the pass; browserLock falls back to it without navigator.locks', async () => {
		expect(await noLock.run(async () => 7)).toBe(7);
		expect(await browserLock().run(async () => 8)).toBe(8);
	});

	it('browserLock asks navigator.locks for tran-alerts with ifAvailable', async () => {
		const request = vi.fn(
			async (_n: string, _o: LockOptions, cb: (lock: Lock | null) => Promise<unknown>) => cb(null)
		);
		vi.stubGlobal('navigator', { locks: { request } });
		try {
			expect(await browserLock().run(async () => 9)).toBeNull();
			expect(request.mock.calls[0]![0]).toBe('tran-alerts');
			expect(request.mock.calls[0]![1]).toEqual({ ifAvailable: true });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('sample mode', () => {
	it('runs on fixtures: 0 live fetches, never asks, snapshots written', async () => {
		const db = makeDb();
		open.push(db);
		const clock = () => T0;
		const live = spyFetch(() => jsonResponse(200, listingRows(3)));
		const gateway: DataGateway = createSampleGateway({
			fixtures: FIXTURES,
			ledger: createLedgerRepo(db, clock),
			clock,
			probeFetch: live.fetch
		});
		const repo = createSavedSearchRepo(db, clock);
		const zips = ['74201', '74203', '70201', '70204', '85801'];
		for (const zip of zips) await repo.create(search(zip));
		const confirm = vi.fn(async () => true);
		const res = await runDueSearches({ gateway, repo, clock, confirm });
		expect(live.calls).toHaveLength(0);
		expect(confirm).not.toHaveBeenCalled();
		expect(res.ran).toHaveLength(5);
		for (const row of await repo.list()) {
			const snap = await repo.snapshot(row.id);
			expect(Object.keys(snap!.items).length).toBeGreaterThan(0);
			expect(row.lastRunAt).toBe(T0);
		}
		expect(await db.ledger.count()).toBe(0);
		expect(await db.apiCache.count()).toBe(0);
	});
});

describe('diff and errors', () => {
	it('first run is a baseline; a later run with one more listing reports 1 new', async () => {
		const w = await world({ zips: ['74201'] });
		const first = await w.run();
		expect(first.newListings).toBe(0);
		const [row] = await w.repo.list();
		expect(Object.keys((await w.repo.snapshot(row!.id))!.items)).toHaveLength(3);

		w.clock.now = T0 + DUE_AFTER_MS;
		w.rc.extra.set('74201', [listingRow('SAMPLE-74201-NEW1', '74201', 1700)]);
		const second = await w.run();
		expect(second.newListings).toBe(1);
		const snap = (await w.repo.snapshot(row!.id))!;
		expect(snap.items['SAMPLE-74201-NEW1']!.firstSeenAt).toBe(T0 + DUE_AFTER_MS);
		const seen = (await w.repo.list())[0]!.lastSeenAt;
		expect(seen).toBe(T0);
		expect(countNewSince(snap, seen)).toBe(1);

		await w.repo.markSeen(row!.id);
		expect(countNewSince(snap, (await w.repo.list())[0]!.lastSeenAt)).toBe(0);
	});

	it('NoResults stores an empty, non-truncated snapshot and counts as run', async () => {
		const w = await world({ zips: ['74201'] });
		w.rc.status.set('74201', 404);
		const res = await w.run();
		expect(res.ran).toHaveLength(1);
		const [row] = await w.repo.list();
		expect(row!.lastRunAt).toBe(T0);
		const snap = (await w.repo.snapshot(row!.id))!;
		expect(snap.items).toEqual({});
		expect(snap.truncated).toBe(false);
	});

	it('NetworkError releases the claim and leaves lastRunAt unchanged; the rest still run', async () => {
		const w = await world({ zips: ['74201', '74202'] });
		w.rc.status.set('74201', 500);
		const res = await w.run();
		expect(w.rc.spy.calls).toHaveLength(2);
		const rows = await w.repo.list();
		const failed = rows.find((r) => r.params.zipCode === '74201')!;
		const ok = rows.find((r) => r.params.zipCode === '74202')!;
		expect(failed.lastRunAt).toBeNull();
		expect(failed.claimedAt).toBeNull();
		expect(ok.lastRunAt).toBe(T0);
		expect(res.ran).toEqual([ok.id]);
		expect(res.failed).toEqual([failed.id]);
		expect(await w.repo.snapshot(failed.id)).toBeUndefined();
	});

	it('only listings searches are scheduled', async () => {
		const w = await world({ zips: ['74201'] });
		await w.db.savedSearches.update(w.ids[0]!, { endpoint: 'markets' });
		const res = await w.run();
		expect(res.due).toBe(0);
		expect(w.rc.spy.calls).toHaveLength(0);
	});
});
