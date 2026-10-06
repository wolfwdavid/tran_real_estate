// Investor overview counts (07-20): the three live lines on /investor/ and the zero-call proof.
// The counts read real repositories over fake-indexeddb with a live gateway whose get/refresh and
// the runtime's requestSpend are spied, so "0 calls" means nothing could have spent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataRequest } from '@tran/core/request';
import type { TranDb } from '$lib/storage/db';
// Test-only harnesses from the data layer (same precedent as the buy-box repo tests).
// eslint-disable-next-line no-restricted-imports
import { jsonResponse, makeDb, spyFetch, T0 } from '$lib/data/testing/harness';
// eslint-disable-next-line no-restricted-imports
import { makeGateway } from '$lib/data/testing/gateway-harness';
// eslint-disable-next-line no-restricted-imports
import { runDueSearches } from '$lib/data/scheduler';
import { createWatchedZipsRepo } from '$lib/features/shared/markets/watchedZipsRepo';
import { formToDealData } from '../analyzer/deal-data';
import { sampleDealCopy } from '../analyzer/sample-deal';
import { createBuyBoxRepo, emptyBuyBox, type BuyBoxInput } from '../buybox/buyBoxRepo';
import { createInvestorPort, savedSearchRepo, type InvestorRuntime } from '../data/investor-port';
import { createDealsRepo } from '../deals/dealsRepo';
import type { DealData } from '../deals/schema';
import {
	OVERVIEW_LOADING,
	overviewCounts,
	overviewLines,
	type OverviewCounts
} from './overview-counts';

const DAY = 24 * 3_600_000;

const open: TranDb[] = [];
afterEach(() => {
	for (const db of open.splice(0)) db.close();
});

interface Row {
	id: string;
	price: number;
}

const saleRow = (r: Row) => ({
	id: r.id,
	price: r.price,
	status: 'Active',
	zipCode: '79999',
	formattedAddress: `${r.id} Example Way, Harlow Springs, TX 79999`,
	addressLine1: `${r.id} Example Way`,
	city: 'Harlow Springs',
	state: 'TX',
	propertyType: 'Single Family',
	bedrooms: 3,
	bathrooms: 2,
	listedDate: '2026-10-01T00:00:00.000Z'
});

/** A live gateway over fake-indexeddb, every spend path spied. */
function world() {
	const clock = { now: T0 };
	const tick = () => clock.now;
	let rows: Row[] = [{ id: 's1', price: 250_000 }];
	const spy = spyFetch(() => jsonResponse(200, rows.map(saleRow)));
	const db = makeDb();
	open.push(db);
	const g = makeGateway({ fetch: spy.fetch, clock: tick, cap: 40, db });
	const get = vi.spyOn(g.gateway, 'get');
	const refresh = vi.spyOn(g.gateway, 'refresh');
	const requestSpend = vi.fn((req: DataRequest) => g.gateway.get(req, { intent: 'user' }));
	const runtime = { gateway: g.gateway, mode: null, requestSpend } as unknown as InvestorRuntime;
	const phase4 = savedSearchRepo({ db, clock: tick });
	const buyBoxes = createBuyBoxRepo({
		db: () => db,
		phase4: () => phase4,
		port: createInvestorPort(runtime),
		clock: tick
	});
	const deals = createDealsRepo(db, { now: () => new Date(clock.now) });
	const zips = createWatchedZipsRepo(db, tick);
	const appOpen = () =>
		runDueSearches({ gateway: g.gateway, repo: phase4, clock: tick, confirm: async () => true });
	const sources = {
		listDeals: () => deals.listDeals(),
		listWatchedZips: () => zips.listWatchedZips(),
		buyBoxes
	};
	/** Every way a call could have been spent. */
	const spends = () => ({
		fetch: spy.calls.length,
		get: get.mock.calls.length,
		refresh: refresh.mock.calls.length,
		requestSpend: requestSpend.mock.calls.length
	});
	const setRows = (next: Row[]) => {
		rows = next;
	};
	return { clock, db, deals, zips, buyBoxes, appOpen, sources, spends, setRows };
}

function dealData(name: string): DealData {
	const { form, sources } = sampleDealCopy();
	const data = formToDealData({ ...form, name }, sources);
	if (!data) throw new Error('sample deal is not ready');
	return data;
}

function box(name = 'Harlow starter homes'): BuyBoxInput {
	const b = emptyBuyBox();
	return { ...b, name, criteria: { ...b.criteria, location: '79999' } };
}

const counts = (o: Partial<OverviewCounts> = {}): OverviewCounts => ({
	deals: 0,
	buyBoxes: 0,
	newMatches: 0,
	watchedZips: 0,
	...o
});

describe('overviewLines', () => {
	it('reads the empty state for every card', () => {
		expect(overviewLines(counts())).toEqual({
			deals: 'None saved yet',
			buyBoxes: 'No buy boxes yet',
			markets: '0 of 5 ZIP codes watched'
		});
	});

	it('counts saved deals and watched ZIPs; boxes with nothing new read "No new matches"', () => {
		expect(overviewLines(counts({ deals: 3, buyBoxes: 2, watchedZips: 5 }))).toEqual({
			deals: '3 saved',
			buyBoxes: 'No new matches',
			markets: '5 of 5 ZIP codes watched'
		});
	});

	it('names the new matches since the last visit (singular and plural)', () => {
		expect(overviewLines(counts({ buyBoxes: 2, newMatches: 4 })).buyBoxes).toBe(
			'4 new matches since your last visit'
		);
		expect(overviewLines(counts({ buyBoxes: 1, newMatches: 1 })).buyBoxes).toBe(
			'1 new match since your last visit'
		);
		expect(overviewLines(counts({ deals: 1 })).deals).toBe('1 saved');
	});

	it('exports the shared loading line', () => {
		expect(OVERVIEW_LOADING).toBe('Loading your investor data…');
	});
});

describe('overviewCounts', () => {
	it('is all zeros on an empty database, at 0 calls', async () => {
		const w = world();
		expect(await overviewCounts(w.sources)).toEqual(counts());
		expect(w.spends()).toEqual({ fetch: 0, get: 0, refresh: 0, requestSpend: 0 });
	});

	it('counts live deals only (a tombstoned deal is gone) and live watched ZIPs', async () => {
		const w = world();
		await w.deals.createDeal(dealData('Kept deal'));
		const gone = await w.deals.createDeal(dealData('Deleted deal'));
		await w.deals.deleteDeal(gone.id);
		await w.zips.watchZip('74201');
		await w.zips.watchZip('79999');
		await w.zips.unwatchZip('79999');

		expect(await overviewCounts(w.sources)).toEqual(counts({ deals: 1, watchedZips: 1 }));
		expect(w.spends()).toEqual({ fetch: 0, get: 0, refresh: 0, requestSpend: 0 });
	});

	it('sums new buy-box matches from the cache without spending', async () => {
		const w = world();
		const v = await w.buyBoxes.createBuyBox(box());
		await w.buyBoxes.createBuyBox(box('Second box'));
		w.clock.now = T0 + 1000;
		await w.appOpen();
		w.clock.now = T0 + 2000;
		await w.buyBoxes.markSeen(v.id);

		// A later on-open run brings one new listing: new for the seen box only.
		w.setRows([
			{ id: 's1', price: 250_000 },
			{ id: 's2', price: 260_000 }
		]);
		w.clock.now = T0 + 1000 + DAY;
		await w.appOpen();

		const before = w.spends();
		expect(await w.buyBoxes.newMatchCount(v.id)).toBe(1);
		const c = await overviewCounts(w.sources);
		expect(c.buyBoxes).toBe(2);
		// The never-seen box has no "last visit" yet, so it contributes 0 (Phase 4 rule).
		expect(c.newMatches).toBe(1);
		expect(w.spends()).toEqual(before);
	});

	it('a box whose cache read fails counts 0 instead of failing the overview', async () => {
		const w = world();
		await w.zips.watchZip('74201');
		const sources = {
			...w.sources,
			buyBoxes: {
				listBuyBoxes: async () => [{ id: 'a' }, { id: 'b' }] as never,
				newMatchCount: async (id: string) => {
					if (id === 'a') throw new Error('cache unavailable');
					return 3;
				}
			}
		};
		expect(await overviewCounts(sources)).toEqual(
			counts({ buyBoxes: 2, newMatches: 3, watchedZips: 1 })
		);
	});
});
