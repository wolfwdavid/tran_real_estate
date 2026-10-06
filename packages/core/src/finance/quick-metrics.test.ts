import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { pct, ratio } from '../format/index.js';
import type { MarketStatsInput } from '../markets/types.js';
import { mulBps } from './money.js';
import { meetsTargets, quickBasisLine, quickMetrics, type QuickMetrics } from './quick-metrics.js';

// Synthetic fixture: fictional ZIP 79999.
const STATS: MarketStatsInput = {
	zipCode: '79999',
	rentalData: {
		medianRent: 1750,
		history: {
			'2026-08': {
				medianRent: 1700,
				totalListings: 120,
				dataByBedrooms: [{ bedrooms: 3, medianRent: 1850, totalListings: 40 }]
			},
			'2026-09': {
				medianRent: 1725,
				totalListings: 125,
				dataByBedrooms: [
					{ bedrooms: 2, medianRent: 1500, totalListings: 50 },
					{ bedrooms: 3, medianRent: 1900, totalListings: 42 }
				]
			}
		}
	}
};

const LISTING = { priceCents: 28_900_000, bedrooms: 3 };

describe('quickMetrics', () => {
	it('computes rent-to-price, GRM and estimated cap rate from the ZIP bedroom median', () => {
		const q = quickMetrics(LISTING, STATS);
		expect(q).not.toBeNull();
		const m = q as QuickMetrics;
		expect(m.rentCents).toBe(190_000);
		expect(m.rentToPricePct).toBeCloseTo((190_000 * 100) / 28_900_000, 12);
		expect(pct(m.rentToPricePct as number, 2)).toBe('0.66%');
		expect(m.grm).toBeCloseTo(28_900_000 / (190_000 * 12), 12);
		expect(ratio(m.grm as number, 1)).toBe('12.7');
		const est = ((190_000 - mulBps(190_000, 4000)) * 12 * 100) / 28_900_000;
		expect(m.estCapRatePct).toBeCloseTo(est, 12);
		expect(pct(m.estCapRatePct as number, 1)).toBe('4.7%');
		expect(m).toMatchObject({
			basis: 'bedrooms',
			month: '2026-09',
			listings: 42,
			expenseBps: 4000
		});
	});

	it('honors a custom expense assumption', () => {
		const q = quickMetrics(LISTING, STATS, 5000) as QuickMetrics;
		expect(q.expenseBps).toBe(5000);
		expect(q.estCapRatePct).toBeCloseTo((95_000 * 12 * 100) / 28_900_000, 12);
	});

	it('is null when the ZIP stats are not available or hold no rent', () => {
		expect(quickMetrics(LISTING, null)).toBeNull();
		expect(quickMetrics(LISTING, { zipCode: '79999' })).toBeNull();
		expect(quickMetrics(LISTING, { zipCode: '79999', rentalData: { history: {} } })).toBeNull();
	});

	it('returns null ratios, never NaN, for a zero price', () => {
		const q = quickMetrics({ priceCents: 0, bedrooms: 3 }, STATS) as QuickMetrics;
		expect(q.rentCents).toBe(190_000);
		expect(q.rentToPricePct).toBeNull();
		expect(q.grm).toBeNull();
		expect(q.estCapRatePct).toBeNull();
	});

	it('falls back to the overall median when no bedroom median exists', () => {
		const q = quickMetrics({ priceCents: 28_900_000, bedrooms: 6 }, STATS) as QuickMetrics;
		expect(q).toMatchObject({ basis: 'all', rentCents: 172_500, month: '2026-09', listings: 125 });
		const n = quickMetrics({ priceCents: 28_900_000, bedrooms: null }, STATS) as QuickMetrics;
		expect(n.basis).toBe('all');
	});

	it('rounds the median to whole dollars', () => {
		const s: MarketStatsInput = { zipCode: '79999', rentalData: { medianRent: 1899.6 } };
		expect((quickMetrics(LISTING, s) as QuickMetrics).rentCents).toBe(190_000);
	});

	it('property: never NaN or Infinity', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: -1_000_000, max: 10_000_000_000 }),
				fc.option(fc.integer({ min: 0, max: 8 }), { nil: null }),
				fc.option(fc.double({ min: -10, max: 100_000, noNaN: true }), { nil: null }),
				fc.integer({ min: 0, max: 10_000 }),
				(priceCents, bedrooms, rent, bps) => {
					const s: MarketStatsInput = { zipCode: '79999', rentalData: { medianRent: rent } };
					const q = quickMetrics({ priceCents, bedrooms }, s, bps);
					if (q === null) return;
					for (const v of [q.rentCents, q.rentToPricePct, q.grm, q.estCapRatePct]) {
						if (v !== null) expect(Number.isFinite(v)).toBe(true);
					}
				}
			)
		);
	});
});

describe('meetsTargets', () => {
	const q = quickMetrics(LISTING, STATS) as QuickMetrics;

	it('is true when no targets are set', () => {
		expect(meetsTargets(q, { minCapRatePct: null, minRentToPricePct: null })).toBe(true);
		expect(meetsTargets(null, { minCapRatePct: null, minRentToPricePct: null })).toBe(true);
	});

	it('checks each set target', () => {
		expect(meetsTargets(q, { minCapRatePct: 6, minRentToPricePct: null })).toBe(false);
		expect(meetsTargets(q, { minCapRatePct: null, minRentToPricePct: 0.6 })).toBe(true);
		expect(meetsTargets(q, { minCapRatePct: 4, minRentToPricePct: 0.6 })).toBe(true);
		expect(meetsTargets(q, { minCapRatePct: 4, minRentToPricePct: 0.7 })).toBe(false);
	});

	it('counts a value exactly at the target as meeting it', () => {
		const exact = { minCapRatePct: q.estCapRatePct, minRentToPricePct: q.rentToPricePct };
		expect(meetsTargets(q, exact)).toBe(true);
	});

	it('is null when a target is set but the metrics are unavailable', () => {
		expect(meetsTargets(null, { minCapRatePct: 6, minRentToPricePct: null })).toBeNull();
		const zero = quickMetrics({ priceCents: 0, bedrooms: 3 }, STATS) as QuickMetrics;
		expect(meetsTargets(zero, { minCapRatePct: 6, minRentToPricePct: null })).toBeNull();
	});
});

describe('quickBasisLine', () => {
	const q = quickMetrics(LISTING, STATS) as QuickMetrics;

	it('names the basis, month, listings and expense assumption', () => {
		expect(quickBasisLine(q, 3)).toBe(
			"Quick metrics use the ZIP's median rent for 3-bedroom homes, $1,900 a month as of Sep 2026 (42 listings), and set aside 40% of rent for expenses. Deep analyze looks up estimates for this exact home."
		);
	});

	it('uses "all homes" for the overall fallback and omits missing month or listings', () => {
		const all: QuickMetrics = { ...q, basis: 'all', month: null, listings: null };
		expect(quickBasisLine(all, 6)).toBe(
			"Quick metrics use the ZIP's median rent for all homes, $1,900 a month, and set aside 40% of rent for expenses. Deep analyze looks up estimates for this exact home."
		);
		expect(quickBasisLine({ ...q, listings: null }, 3)).toContain('a month as of Sep 2026, and');
		expect(quickBasisLine({ ...q, month: null }, 3)).toContain('a month (42 listings), and');
	});

	it('words studios and 4+ bedroom buckets', () => {
		expect(quickBasisLine(q, 0)).toContain('median rent for studios,');
		expect(quickBasisLine(q, 5)).toContain('median rent for homes with 4 or more bedrooms,');
		expect(quickBasisLine({ ...q, listings: 1 }, 3)).toContain('(1 listing)');
	});
});
