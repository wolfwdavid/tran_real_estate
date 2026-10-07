import { describe, expect, it } from 'vitest';
import type {
	Listing,
	MarketBreakdown,
	MarketHistoryPoint,
	MarketSide,
	MarketStats
} from '../listings/types.js';
import {
	AGGREGATED_SAMPLE_KEYS,
	BEDROOM_AGGREGATE_KEYS,
	aggregateListings,
	bedroomLabel,
	buildSnapshotMetrics,
	type SnapshotMetrics
} from './snapshot-metrics.js';

// Hand-authored fixture S: fictional ZIP 00199. All values are made up.

const bd = (bedrooms: number, median: number, totalListings: number): MarketBreakdown => ({
	bedrooms,
	propertyType: null,
	average: null,
	median,
	min: null,
	max: null,
	totalListings
});

const side = (over: Partial<MarketSide>): MarketSide => ({
	average: null,
	median: null,
	min: null,
	max: null,
	averagePerSquareFoot: null,
	averageDaysOnMarket: null,
	medianDaysOnMarket: null,
	newListings: null,
	totalListings: null,
	byBedrooms: [],
	byPropertyType: [],
	history: [],
	lastUpdatedDate: null,
	...over
});

/** 12 months 2025-03 .. 2026-02, deliberately out of order; 1800 first, 1850 last. */
function rentalHistory(): MarketHistoryPoint[] {
	const months = [
		'2025-09',
		'2026-02',
		'2025-03',
		'2025-12',
		'2025-05',
		'2025-04',
		'2026-01',
		'2025-07',
		'2025-06',
		'2025-11',
		'2025-08',
		'2025-10'
	];
	return months.map((month) => ({
		month,
		average: null,
		median: month === '2025-03' ? 1800 : month === '2026-02' ? 1850 : 1825,
		totalListings: 60
	}));
}

function fixtureS(): MarketStats {
	return {
		zipCode: '00199',
		sale: side({
			median: 333000,
			medianDaysOnMarket: 41,
			averageDaysOnMarket: 47,
			totalListings: 120,
			newListings: 18,
			lastUpdatedDate: '2026-03-01T00:00:00.000Z'
		}),
		rental: side({
			median: 1850,
			medianDaysOnMarket: 23,
			averageDaysOnMarket: 26,
			totalListings: 64,
			newListings: 15,
			byBedrooms: [
				bd(5, 3400, 1),
				bd(2, 1850, 22),
				bd(0, 1250, 8),
				bd(4, 2900, 3),
				bd(1, 1500, 20),
				bd(3, 2300, 10)
			],
			history: rentalHistory(),
			lastUpdatedDate: '2026-03-02T00:00:00.000Z'
		})
	};
}

function everyValueFiniteOrNull(m: SnapshotMetrics): void {
	const nums: unknown[] = [
		m.medianRent,
		m.medianPrice,
		m.priceToRent,
		m.rentChangePct,
		m.months,
		m.saleDom,
		m.rentalDom,
		m.saleTotal,
		m.saleNew,
		m.rentalTotal,
		m.rentalNew,
		...m.rentByBedroom.flatMap((b) => [b.beds, b.median, b.listings])
	];
	for (const v of nums) {
		expect(v === null || (typeof v === 'number' && Number.isFinite(v))).toBe(true);
		if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
	}
}

describe('buildSnapshotMetrics', () => {
	it('computes every figure from fixture S', () => {
		const m = buildSnapshotMetrics(fixtureS());
		expect(m.zip).toBe('00199');
		expect(m.lastUpdated).toBe('2026-03-02T00:00:00.000Z');
		expect(m.medianRent).toBe(1850);
		expect(m.medianPrice).toBe(333000);
		expect(m.priceToRent).toBe(15);
		expect(m.rentChangePct).toBe(2.8);
		expect(m.rentChangeFrom).toBe('2025-03');
		expect(m.rentChangeTo).toBe('2026-02');
		expect(m.months).toBe(12);
		expect(m.saleDom).toBe(41);
		expect(m.rentalDom).toBe(23);
		expect(m.saleTotal).toBe(120);
		expect(m.saleNew).toBe(18);
		expect(m.rentalTotal).toBe(64);
		expect(m.rentalNew).toBe(15);
		everyValueFiniteOrNull(m);
	});

	it('lists rent by bedroom ascending and collapses 4+ into one listing-weighted row', () => {
		const m = buildSnapshotMetrics(fixtureS());
		expect(m.rentByBedroom).toEqual([
			{ beds: 0, median: 1250, listings: 8 },
			{ beds: 1, median: 1500, listings: 20 },
			{ beds: 2, median: 1850, listings: 22 },
			{ beds: 3, median: 2300, listings: 10 },
			{ beds: 4, median: 2900, listings: 4 }
		]);
	});

	it('uses the median of the collapsed rows, never a simple average', () => {
		const s = fixtureS();
		s.rental!.byBedrooms = [bd(4, 2900, 1), bd(5, 3400, 5), bd(6, 5000, 1)];
		const row = buildSnapshotMetrics(s).rentByBedroom.find((b) => b.beds === 4);
		// 7 listings: the middle (4th) listing sits in the 3400 row. A plain average would be 3767.
		expect(row).toEqual({ beds: 4, median: 3400, listings: 7 });
	});

	it('keeps a lone 5-bedroom row as the 4+ row', () => {
		const s = fixtureS();
		s.rental!.byBedrooms = [bd(5, 3400, 2)];
		expect(buildSnapshotMetrics(s).rentByBedroom).toEqual([{ beds: 4, median: 3400, listings: 2 }]);
	});

	it('returns null rental figures when rental data is missing', () => {
		const s = fixtureS();
		s.rental = null;
		const m = buildSnapshotMetrics(s);
		expect(m.medianRent).toBeNull();
		expect(m.priceToRent).toBeNull();
		expect(m.rentChangePct).toBeNull();
		expect(m.rentChangeFrom).toBeNull();
		expect(m.rentChangeTo).toBeNull();
		expect(m.rentalDom).toBeNull();
		expect(m.rentalTotal).toBeNull();
		expect(m.rentByBedroom).toEqual([]);
		expect(m.medianPrice).toBe(333000);
		everyValueFiniteOrNull(m);
	});

	it('returns null sale figures when sale data is missing', () => {
		const s = fixtureS();
		s.sale = null;
		const m = buildSnapshotMetrics(s);
		expect(m.medianPrice).toBeNull();
		expect(m.priceToRent).toBeNull();
		expect(m.saleDom).toBeNull();
		expect(m.saleTotal).toBeNull();
		expect(m.saleNew).toBeNull();
		everyValueFiniteOrNull(m);
	});

	it('has no rent change with fewer than 2 months of history', () => {
		const s = fixtureS();
		s.rental!.history = [{ month: '2026-02', average: null, median: 1850, totalListings: 60 }];
		const m = buildSnapshotMetrics(s);
		expect(m.rentChangePct).toBeNull();
		expect(m.rentChangeFrom).toBeNull();
		expect(m.months).toBe(1);
		s.rental!.history = [];
		expect(buildSnapshotMetrics(s).rentChangePct).toBeNull();
		expect(buildSnapshotMetrics(s).months).toBe(0);
	});

	it('never yields NaN, 0-division or Infinity from zero or junk inputs', () => {
		const s = fixtureS();
		s.rental!.median = 0;
		s.rental!.history = [
			{ month: '2025-03', average: null, median: 0, totalListings: 1 },
			{ month: '2026-02', average: null, median: 1850, totalListings: 1 }
		];
		s.sale!.medianDaysOnMarket = Number.NaN;
		s.sale!.totalListings = Number.POSITIVE_INFINITY;
		s.rental!.byBedrooms = [bd(2, Number.NaN, 3)];
		const m = buildSnapshotMetrics(s);
		expect(m.medianRent).toBeNull();
		expect(m.priceToRent).toBeNull();
		expect(m.rentChangePct).toBeNull();
		expect(m.saleDom).toBeNull();
		expect(m.saleTotal).toBeNull();
		expect(m.rentByBedroom).toEqual([{ beds: 2, median: null, listings: 3 }]);
		everyValueFiniteOrNull(m);
	});

	it('rounds days on market to whole days and price-to-rent to 1 decimal', () => {
		const s = fixtureS();
		s.sale!.medianDaysOnMarket = 40.6;
		s.sale!.median = 340000;
		const m = buildSnapshotMetrics(s);
		expect(m.saleDom).toBe(41);
		expect(m.priceToRent).toBe(15.3); // 340000 / 22200 = 15.315...
	});
});

describe('bedroomLabel', () => {
	it('labels every bedroom count', () => {
		expect(bedroomLabel(0)).toBe('Studio');
		expect(bedroomLabel(1)).toBe('1 bedroom');
		expect(bedroomLabel(2)).toBe('2 bedrooms');
		expect(bedroomLabel(3)).toBe('3 bedrooms');
		expect(bedroomLabel(4)).toBe('4+ bedrooms');
		expect(bedroomLabel(6)).toBe('4+ bedrooms');
	});
});

// Seven synthetic listings with every identifying field filled, so the test can prove none leaks.
function listing(n: number, over: Partial<Listing>): Listing {
	return {
		id: `example-listing-id-${n}`,
		kind: 'sale',
		formattedAddress: `${n} Example Way, Sampletown, ZZ 00199`,
		addressLine1: `${n} Example Way`,
		addressLine2: null,
		city: 'Sampletown',
		state: 'ZZ',
		zipCode: '00199',
		latitude: 1,
		longitude: 1,
		propertyType: 'Condo',
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900,
		yearBuilt: 1990,
		hoaFee: null,
		price: 1000,
		status: 'Active',
		listingType: 'Standard',
		listedDate: '2026-01-01',
		removedDate: null,
		lastSeenDate: '2026-03-01',
		daysOnMarket: 10,
		mlsName: 'ExampleMLS',
		mlsNumber: `EX-MLS-${9000 + n}`,
		agent: {
			name: `Agent Placeholder${n}`,
			phone: `555-01${String(n).padStart(2, '0')}`,
			email: `agent${n}@example.com`,
			website: null
		},
		office: {
			name: `Office Placeholder${n}`,
			phone: null,
			email: `office${n}@example.com`,
			website: null
		},
		history: [],
		...over
	};
}

function sevenListings(): Listing[] {
	return [
		listing(1, { bedrooms: 2, price: 1500, daysOnMarket: 10 }),
		listing(2, { bedrooms: 2, price: 2100, daysOnMarket: 30 }),
		listing(3, { bedrooms: 2, price: 1700, daysOnMarket: 20 }),
		listing(4, { bedrooms: 2, price: 2000, daysOnMarket: null }),
		listing(5, { bedrooms: 1, price: 1250.4, daysOnMarket: 5 }),
		listing(6, { bedrooms: 4, price: 3000, daysOnMarket: 8 }),
		listing(7, { bedrooms: 5, price: 3600, daysOnMarket: 12 })
	];
}

describe('aggregateListings', () => {
	it('carries exactly the whitelisted keys and nothing listing-identifying', () => {
		const ls = sevenListings();
		const out = aggregateListings(ls, 'sale', '2026-03-05');
		expect(Object.keys(out)).toEqual([...AGGREGATED_SAMPLE_KEYS]);
		expect(out.byBedroom.length).toBeGreaterThan(0);
		for (const row of out.byBedroom) expect(Object.keys(row)).toEqual([...BEDROOM_AGGREGATE_KEYS]);
		const json = JSON.stringify(out);
		for (const l of ls) {
			expect(json).not.toContain(l.formattedAddress);
			expect(json).not.toContain(l.addressLine1 as string);
			expect(json).not.toContain(l.id);
			expect(json).not.toContain(l.mlsNumber as string);
			expect(json).not.toContain(l.agent?.name as string);
			expect(json).not.toContain(l.agent?.email as string);
			expect(json).not.toContain(l.office?.name as string);
		}
		expect(json).not.toContain('Example Way');
		expect(json).not.toContain('ExampleMLS');
		expect(json).not.toContain('example.com');
	});

	it('aggregates counts, ranges, medians and median days on market by bedroom', () => {
		const out = aggregateListings(sevenListings(), 'sale', '2026-03-05');
		expect(out.kind).toBe('sale');
		expect(out.seenAt).toBe('2026-03-05');
		expect(out.total).toBe(7);
		expect(out.byBedroom).toEqual([
			{ beds: 1, count: 1, min: 1250, max: 1250, median: 1250, medianDom: 5 },
			{ beds: 2, count: 4, min: 1500, max: 2100, median: 1850, medianDom: 20 },
			{ beds: 4, count: 2, min: 3000, max: 3600, median: 3300, medianDom: 10 }
		]);
	});

	it('rounds the median to whole dollars', () => {
		const out = aggregateListings(
			[listing(1, { price: 1500 }), listing(2, { price: 1701 })],
			'sale',
			'2026-03-05'
		);
		expect(out.byBedroom[0].median).toBe(1601); // 1600.5 -> 1601
	});

	it('skips listings without a usable price and listings of the other kind', () => {
		const out = aggregateListings(
			[
				listing(1, { price: 1500 }),
				listing(2, { price: Number.NaN }),
				listing(3, { price: 0 }),
				listing(4, { price: 1900, kind: 'rental' })
			],
			'sale',
			'2026-03-05'
		);
		expect(out.total).toBe(1);
		expect(out.byBedroom).toEqual([
			{ beds: 2, count: 1, min: 1500, max: 1500, median: 1500, medianDom: 10 }
		]);
	});

	it('counts listings with unknown bedrooms in the total but in no bedroom row', () => {
		const out = aggregateListings(
			[listing(1, { price: 1500 }), listing(2, { price: 1600, bedrooms: null })],
			'sale',
			'2026-03-05'
		);
		expect(out.total).toBe(2);
		expect(out.byBedroom.map((r) => r.count)).toEqual([1]);
	});

	it('returns an empty summary for no listings', () => {
		expect(aggregateListings([], 'rental', '2026-03-05')).toEqual({
			kind: 'rental',
			seenAt: '2026-03-05',
			total: 0,
			byBedroom: []
		});
	});
});
