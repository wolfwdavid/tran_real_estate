// Buy-box matches (07-14, INV-04): local filter boundaries, newest-first order, new flags, zero-call
// quick metrics from cached ZIP stats grouped by the user's targets, and a spy port proving
// loadMatches only peeks.
import { describe, expect, it, vi } from 'vitest';
import type { MarketStatsInput } from '@tran/core/markets';
import type { InvestorDataPort, SaleListing } from '../data/investor-port';
import { emptyBuyBox, type BuyBoxCriteria, type BuyBoxInput, type BuyBoxView } from './buyBoxRepo';
import { buildMatches, filterListings, loadMatches } from './matches';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const DAY = 86_400_000;
const PROV = { source: 'sample' as const, fetchedAt: T0, stale: false };

function sale(id: string, o: Partial<SaleListing> = {}): SaleListing {
	return {
		id,
		address: `${id} Example Way, Harlow Springs, TX 79999`,
		zip: '79999',
		priceCents: 20_000_000,
		bedrooms: 3,
		bathrooms: 2,
		squareFeet: 1400,
		daysOnMarket: 10,
		hoaMonthlyCents: null,
		propertyType: 'Single Family',
		listedAt: T0 - DAY,
		...o
	};
}

const crit = (o: Partial<BuyBoxCriteria> = {}): BuyBoxCriteria => ({
	...emptyBuyBox().criteria,
	location: '79999',
	...o
});

const ids = (ls: readonly { id: string }[]) => ls.map((l) => l.id);

/** $1,500 median rent: est. NOI = 1500 * 0.6 * 12 = $10,800 a year. */
const stats = (zip: string): MarketStatsInput => ({
	zipCode: zip,
	rentalData: { medianRent: 1500 }
});

describe('filterListings', () => {
	const ls = [
		sale('cheap', { priceCents: 9_999_999 }),
		sale('min', { priceCents: 10_000_000 }),
		sale('max', { priceCents: 30_000_000 }),
		sale('dear', { priceCents: 30_000_001 })
	];

	it('price range is inclusive; null bounds are open', () => {
		const c = crit({ minPriceCents: 10_000_000, maxPriceCents: 30_000_000 });
		expect(ids(filterListings(ls, c)).sort()).toEqual(['max', 'min']);
		expect(filterListings(ls, crit({ minPriceCents: 10_000_000 }))).toHaveLength(3);
		expect(filterListings(ls, crit({ maxPriceCents: 30_000_000 }))).toHaveLength(3);
		expect(filterListings(ls, crit())).toHaveLength(4);
	});

	it('bedrooms: >= minBeds; Any keeps unknown bedrooms, a minimum excludes them', () => {
		const bs = [
			sale('b2', { bedrooms: 2 }),
			sale('b3', { bedrooms: 3 }),
			sale('b5', { bedrooms: 5 }),
			sale('bn', { bedrooms: null })
		];
		expect(ids(filterListings(bs, crit({ minBeds: 0 }))).sort()).toEqual(['b2', 'b3', 'b5', 'bn']);
		expect(ids(filterListings(bs, crit({ minBeds: 3 }))).sort()).toEqual(['b3', 'b5']);
		expect(ids(filterListings(bs, crit({ minBeds: 4 })))).toEqual(['b5']);
	});

	it('property types: [] keeps all; a list keeps only those types (unknown type excluded)', () => {
		const ts = [
			sale('sf'),
			sale('co', { propertyType: 'Condo' }),
			sale('th', { propertyType: 'Townhouse' }),
			sale('nt', { propertyType: null })
		];
		expect(filterListings(ts, crit())).toHaveLength(4);
		expect(ids(filterListings(ts, crit({ propertyTypes: ['Condo'] })))).toEqual(['co']);
		expect(ids(filterListings(ts, crit({ propertyTypes: ['Condo', 'Townhouse'] }))).sort()).toEqual(
			['co', 'th']
		);
	});

	it('sorts by listedAt descending with unknown dates last', () => {
		const ds = [
			sale('old', { listedAt: T0 - 5 * DAY }),
			sale('none', { listedAt: null }),
			sale('new', { listedAt: T0 }),
			sale('mid', { listedAt: T0 - 2 * DAY })
		];
		expect(ids(filterListings(ds, crit()))).toEqual(['new', 'mid', 'old', 'none']);
	});
});

function boxOf(targets: BuyBoxInput['targets'], o: Partial<BuyBoxCriteria> = {}): BuyBoxInput {
	return { ...emptyBuyBox(), name: 'Box', criteria: crit(o), targets };
}

describe('buildMatches', () => {
	// $174,000 -> est. cap 6.21%; $230,000 -> 4.70%.
	const a1 = sale('a1', { priceCents: 17_400_000, listedAt: T0 });
	const a2 = sale('a2', { priceCents: 23_000_000, listedAt: T0 - DAY });
	const b1 = sale('b1', { zip: '79998', listedAt: T0 - 2 * DAY });
	const b2 = sale('b2', { zip: '79998', listedAt: T0 - 3 * DAY });
	const all = [b2, a2, b1, a1];
	const statsA = new Map([['79999', stats('79999')]]);

	it('cached ZIP A gets quick metrics; uncached ZIP B gets nulls and is listed once', () => {
		const m = buildMatches(
			boxOf({ minCapRatePct: null, minRentToPricePct: null }),
			all,
			new Set(),
			statsA
		);
		expect(m.zipsNeedingStats).toEqual(['79998']);
		const byId = new Map(m.meeting.map((r) => [r.listing.id, r]));
		expect(byId.get('a1')!.quick!.estCapRatePct).toBeCloseTo(6.2069, 3);
		expect(byId.get('a1')!.quick!.rentCents).toBe(150_000);
		expect(byId.get('a1')!.meets).toBe(true);
		expect(byId.get('b1')).toMatchObject({ quick: null, meets: null });
		expect(byId.get('b2')).toMatchObject({ quick: null, meets: null });
	});

	it('an explicit null map entry also counts as not loaded', () => {
		const m = buildMatches(
			boxOf({ minCapRatePct: null, minRentToPricePct: null }),
			[b1],
			new Set(),
			new Map([['79998', null]])
		);
		expect(m.zipsNeedingStats).toEqual(['79998']);
	});

	it('target cap 6: 4.7 goes below, 6.2 meets, unknown stays with the matches', () => {
		const m = buildMatches(
			boxOf({ minCapRatePct: 6, minRentToPricePct: null }),
			all,
			new Set(),
			statsA
		);
		expect(ids(m.meeting.map((r) => r.listing))).toEqual(['a1', 'b1', 'b2']);
		expect(ids(m.below.map((r) => r.listing))).toEqual(['a2']);
		expect(m.below[0]!.quick!.estCapRatePct).toBeCloseTo(4.6957, 3);
		expect(m.below[0]!.meets).toBe(false);
	});

	it('the 1% rule (rent-to-price) groups the same way; exactly at target meets', () => {
		// $1,500 / $150,000 = 1.00%.
		const at = sale('at', { priceCents: 15_000_000 });
		const under = sale('under', { priceCents: 15_000_100 });
		const m = buildMatches(
			boxOf({ minCapRatePct: null, minRentToPricePct: 1 }),
			[at, under],
			new Set(),
			statsA
		);
		expect(ids(m.meeting.map((r) => r.listing))).toEqual(['at']);
		expect(ids(m.below.map((r) => r.listing))).toEqual(['under']);
	});

	it('no targets: every row is in meeting', () => {
		const m = buildMatches(
			boxOf({ minCapRatePct: null, minRentToPricePct: null }),
			all,
			new Set(),
			statsA
		);
		expect(m.below).toEqual([]);
		expect(m.meeting).toHaveLength(4);
	});

	it('applies the criteria and keeps newest first', () => {
		const m = buildMatches(
			boxOf({ minCapRatePct: null, minRentToPricePct: null }, { maxPriceCents: 20_000_000 }),
			all,
			new Set(),
			statsA
		);
		expect(ids(m.meeting.map((r) => r.listing))).toEqual(['a1', 'b1', 'b2']);
	});

	it('uses the box expense assumption', () => {
		const box = { ...boxOf({ minCapRatePct: null, minRentToPricePct: null }), expenseBps: 5000 };
		const [row] = buildMatches(box, [a1], new Set(), statsA).meeting;
		// 1500 * 0.5 * 12 / 174,000
		expect(row!.quick!.estCapRatePct).toBeCloseTo(5.1724, 3);
		expect(row!.quick!.expenseBps).toBe(5000);
	});

	it('isNew reflects newIds', () => {
		const m = buildMatches(
			boxOf({ minCapRatePct: null, minRentToPricePct: null }),
			all,
			new Set(['a2', 'b1']),
			statsA
		);
		expect(m.meeting.filter((r) => r.isNew).map((r) => r.listing.id)).toEqual(['a2', 'b1']);
	});
});

function view(o: Partial<BuyBoxView> = {}): BuyBoxView {
	return {
		...boxOf({ minCapRatePct: 6, minRentToPricePct: null }),
		id: 'box-1',
		lastRunAt: T0,
		lastSeenAt: T0,
		createdAt: T0,
		updatedAt: T0,
		...o
	};
}

function spyPorts(listings: SaleListing[] | undefined, truncated = false) {
	const investor = {
		peekSaleListings: vi.fn(async () =>
			listings ? { listings, truncated, provenance: PROV } : undefined
		),
		saleListings: vi.fn(),
		rentEstimate: vi.fn(),
		valueEstimate: vi.fn(),
		peekRent: vi.fn(),
		peekValue: vi.fn(),
		estimateCost: vi.fn()
	};
	const markets = {
		peek: vi.fn(async (zip: string) =>
			zip === '79999' ? { stats: stats(zip), provenance: PROV } : undefined
		),
		load: vi.fn(),
		estimateCost: vi.fn()
	};
	const spending = () =>
		[investor.saleListings, investor.rentEstimate, investor.valueEstimate, markets.load].map(
			(s) => s.mock.calls.length
		);
	return { investor, markets, spending };
}

describe('loadMatches (peek only, 0 calls)', () => {
	it('peeks the listings once and each distinct ZIP once; spends nothing', async () => {
		const p = spyPorts([
			sale('a1', { priceCents: 17_400_000 }),
			sale('a2', { priceCents: 23_000_000 }),
			sale('b1', { zip: '79998' }),
			sale('b2', { zip: '79998' })
		]);
		const r = await loadMatches(view(), {
			investor: p.investor as unknown as InvestorDataPort,
			markets: p.markets,
			newIds: new Set(['a1'])
		});
		expect(p.investor.peekSaleListings).toHaveBeenCalledTimes(1);
		expect(p.investor.peekSaleListings).toHaveBeenCalledWith('79999');
		expect(p.markets.peek.mock.calls.map((c) => c[0]).sort()).toEqual(['79998', '79999']);
		expect(p.spending()).toEqual([0, 0, 0, 0]);
		expect(r).toMatchObject({ zipsNeedingStats: ['79998'], truncated: false, checked: true });
		expect(ids(r.meeting.map((m) => m.listing)).sort()).toEqual(['a1', 'b1', 'b2']);
		expect(ids(r.below.map((m) => m.listing))).toEqual(['a2']);
		expect(r.meeting.find((m) => m.listing.id === 'a1')!.isNew).toBe(true);
	});

	it('never checked and nothing cached: checked false, empty groups, no ZIP peeks', async () => {
		const p = spyPorts(undefined);
		const r = await loadMatches(view({ lastRunAt: null }), {
			investor: p.investor as unknown as InvestorDataPort,
			markets: p.markets
		});
		expect(r).toEqual({
			meeting: [],
			below: [],
			zipsNeedingStats: [],
			truncated: false,
			checked: false
		});
		expect(p.markets.peek).not.toHaveBeenCalled();
		expect(p.spending()).toEqual([0, 0, 0, 0]);
	});

	it('cached listings count as checked even before the first run (shared location)', async () => {
		const p = spyPorts([sale('a1')]);
		const r = await loadMatches(view({ lastRunAt: null }), {
			investor: p.investor as unknown as InvestorDataPort,
			markets: p.markets
		});
		expect(r.checked).toBe(true);
	});

	it('passes truncated through from the cached listings result', async () => {
		const p = spyPorts([sale('a1')], true);
		const r = await loadMatches(view(), {
			investor: p.investor as unknown as InvestorDataPort,
			markets: p.markets
		});
		expect(r.truncated).toBe(true);
	});

	it('a cached ZIP error reads as not loaded and is never fetched', async () => {
		const p = spyPorts([sale('a1')]);
		p.markets.peek.mockRejectedValueOnce(new Error('NoResults'));
		const r = await loadMatches(view(), {
			investor: p.investor as unknown as InvestorDataPort,
			markets: p.markets
		});
		expect(r.zipsNeedingStats).toEqual(['79999']);
		expect(r.meeting[0]).toMatchObject({ quick: null, meets: null });
		expect(p.spending()).toEqual([0, 0, 0, 0]);
	});
});
