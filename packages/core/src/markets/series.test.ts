import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	currentStats,
	hasEnoughData,
	monthRange,
	priceToRentSeries,
	rentTrendSeries,
	zipMedianRentForBeds
} from './series.js';
import type { BedroomStat, MarketStatsInput, RentalMonth, SaleMonth } from './types.js';

// Synthetic fixture: fictional ZIP 79999, 24 months Oct 2024 .. Sep 2026.
const ZIP = '79999';

function months24(): string[] {
	const out: string[] = [];
	let y = 2024;
	let m = 10;
	for (let i = 0; i < 24; i++) {
		out.push(`${y}-${String(m).padStart(2, '0')}`);
		m++;
		if (m === 13) {
			m = 1;
			y++;
		}
	}
	return out;
}

function fixture24(): MarketStatsInput {
	const rental: Record<string, RentalMonth> = {};
	const sale: Record<string, SaleMonth> = {};
	months24().forEach((k, i) => {
		rental[k] = {
			medianRent: 1400 + i * 10,
			totalListings: 40 + i,
			dataByBedrooms: [
				{ bedrooms: 0, medianRent: 1100 + i * 4, totalListings: 6 },
				{ bedrooms: 2, medianRent: 1450 + i * 7, totalListings: 20 }
			]
		};
		sale[k] = { medianPrice: 290000 + i * 1000, totalListings: 30 };
	});
	return {
		zipCode: ZIP,
		rentalData: {
			medianRent: 1630,
			totalListings: 63,
			lastUpdatedDate: '2026-09-28T00:00:00.000Z',
			history: rental
		},
		saleData: { medianPrice: 313000, lastUpdatedDate: '2026-09-27T00:00:00.000Z', history: sale }
	};
}

const bed = (
	bedrooms: number,
	medianRent: number | null,
	totalListings: number | null = 10
): BedroomStat => ({
	bedrooms,
	medianRent,
	totalListings
});

describe('monthRange', () => {
	it('fills a gap month and crosses the year boundary', () => {
		expect(monthRange(['2025-01', '2024-11', '2025-02'])).toEqual([
			'2024-11',
			'2024-12',
			'2025-01',
			'2025-02'
		]);
	});

	it('returns [] for no keys and ignores malformed keys', () => {
		expect(monthRange([])).toEqual([]);
		expect(monthRange(['bogus', '2025-13', '2025-03'])).toEqual(['2025-03']);
	});

	it('property: continuous, strictly ascending, inclusive of min and max', () => {
		const ym = fc
			.tuple(fc.integer({ min: 2000, max: 2040 }), fc.integer({ min: 1, max: 12 }))
			.map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`);
		fc.assert(
			fc.property(fc.array(ym, { minLength: 1, maxLength: 12 }), (keys) => {
				const r = monthRange(keys);
				const sorted = [...keys].sort();
				expect(r[0]).toBe(sorted[0]);
				expect(r[r.length - 1]).toBe(sorted[sorted.length - 1]);
				for (const k of keys) expect(r).toContain(k);
				for (let i = 1; i < r.length; i++) {
					const [py, pm] = r[i - 1].split('-').map(Number);
					const [cy, cm] = r[i].split('-').map(Number);
					// exactly one month later: no gaps, no repeats, monotonic
					expect(cy * 12 + cm - (py * 12 + pm)).toBe(1);
				}
			})
		);
	});
});

describe('rentTrendSeries', () => {
	it('builds 24 continuous months and drops empty bedroom series', () => {
		const t = rentTrendSeries(fixture24());
		expect(t.months).toHaveLength(24);
		expect(t.months[0]).toBe('2024-10');
		expect(t.months[23]).toBe('2026-09');
		expect(t.series.map((s) => s.key)).toEqual(['studio', '2']);
		expect(t.series[0].label).toBe('Studio');
		expect(t.series[1].label).toBe('2 bedrooms');
		expect(t.series[0].points[0]).toBe(1100);
		expect(t.series[1].points[23]).toBe(1450 + 23 * 7);
		expect(t.series[0].counts[0]).toBe(6);
	});

	it('leaves a missing month as null, never 0', () => {
		const stats: MarketStatsInput = {
			zipCode: ZIP,
			rentalData: {
				history: {
					'2024-11': { dataByBedrooms: [bed(1, 1200), bed(3, 1900)] },
					'2025-01': { dataByBedrooms: [bed(1, 1210), bed(3, 1910)] },
					'2025-02': { dataByBedrooms: [bed(1, 1220), bed(3, 1920)] }
				}
			}
		};
		const t = rentTrendSeries(stats);
		expect(t.months).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
		for (const s of t.series) {
			expect(s.points[1]).toBeNull();
			expect(s.counts[1]).toBeNull();
			expect(s.points).not.toContain(0);
		}
	});

	it('omits a series whose points are all null over the whole range', () => {
		const stats: MarketStatsInput = {
			zipCode: ZIP,
			rentalData: {
				history: {
					'2025-01': { dataByBedrooms: [bed(1, 1200), bed(2, null)] },
					'2025-02': { dataByBedrooms: [bed(1, 1210), bed(2, null)] }
				}
			}
		};
		const t = rentTrendSeries(stats);
		expect(t.series.map((s) => s.key)).toEqual(['1']);
	});

	it('maps bedrooms 0..4 to studio, 1, 2, 3, 4plus', () => {
		const stats: MarketStatsInput = {
			zipCode: ZIP,
			rentalData: {
				history: {
					'2025-01': {
						dataByBedrooms: [bed(0, 900), bed(1, 1000), bed(2, 1100), bed(3, 1200), bed(4, 1300)]
					}
				}
			}
		};
		const t = rentTrendSeries(stats);
		expect(t.series.map((s) => [s.key, s.points[0]])).toEqual([
			['studio', 900],
			['1', 1000],
			['2', 1100],
			['3', 1200],
			['4plus', 1300]
		]);
	});

	it('4plus is the listings-weighted mean of 4 and 5+ when every count is known', () => {
		const stats: MarketStatsInput = {
			zipCode: ZIP,
			rentalData: {
				history: { '2025-01': { dataByBedrooms: [bed(4, 2000, 3), bed(5, 3001, 1)] } }
			}
		};
		const s = rentTrendSeries(stats).series[0];
		expect(s.key).toBe('4plus');
		// (2000*3 + 3001*1) / 4 = 2250.25 -> 2250
		expect(s.points[0]).toBe(2250);
		expect(s.counts[0]).toBe(4);
	});

	it('4plus uses the 4-bedroom entry alone when any count is missing', () => {
		const stats: MarketStatsInput = {
			zipCode: ZIP,
			rentalData: {
				history: { '2025-01': { dataByBedrooms: [bed(4, 2000, 3), bed(5, 3000, null)] } }
			}
		};
		const s = rentTrendSeries(stats).series[0];
		expect(s.points[0]).toBe(2000);
		expect(s.counts[0]).toBe(3);
	});

	it('returns empty months and series without rental history', () => {
		expect(rentTrendSeries({ zipCode: ZIP })).toEqual({ months: [], series: [] });
		expect(rentTrendSeries({ zipCode: ZIP, rentalData: null })).toEqual({ months: [], series: [] });
	});

	it('property: points align to months and never hold 0 or NaN for absent data', () => {
		const monthArb = fc.integer({ min: 0, max: 35 });
		fc.assert(
			fc.property(fc.uniqueArray(monthArb, { minLength: 1, maxLength: 20 }), (idx) => {
				const history: Record<string, RentalMonth> = {};
				for (const i of idx) {
					const y = 2024 + Math.floor(i / 12);
					const m = (i % 12) + 1;
					history[`${y}-${String(m).padStart(2, '0')}`] = { dataByBedrooms: [bed(2, 1500 + i)] };
				}
				const t = rentTrendSeries({ zipCode: ZIP, rentalData: { history } });
				const span = Math.max(...idx) - Math.min(...idx) + 1;
				expect(t.months).toHaveLength(span);
				const s = t.series[0];
				expect(s.points).toHaveLength(span);
				expect(s.counts).toHaveLength(span);
				expect(s.points.filter((p) => p !== null)).toHaveLength(idx.length);
				for (const p of s.points) expect(p === null || (Number.isFinite(p) && p > 0)).toBe(true);
			})
		);
	});
});

describe('priceToRentSeries', () => {
	it('is median price / (median rent * 12) per month', () => {
		const p = priceToRentSeries({
			zipCode: ZIP,
			rentalData: { history: { '2025-01': { medianRent: 1500 } } },
			saleData: { history: { '2025-01': { medianPrice: 300000 } } }
		});
		expect(p.months).toEqual(['2025-01']);
		expect(p.points[0]).toBeCloseTo(300000 / 18000, 10);
		expect(p.points[0]).toBeCloseTo(16.6667, 4);
	});

	it('is null when either value is missing or rent is 0, over the union of months', () => {
		const p = priceToRentSeries({
			zipCode: ZIP,
			rentalData: {
				history: {
					'2025-01': { medianRent: 1500 },
					'2025-02': { medianRent: 0 },
					'2025-04': { medianRent: 1600 }
				}
			},
			saleData: {
				history: {
					'2025-01': { medianPrice: 300000 },
					'2025-02': { medianPrice: 300000 },
					'2025-03': { medianPrice: 310000 },
					'2025-04': { medianPrice: null }
				}
			}
		});
		expect(p.months).toEqual(['2025-01', '2025-02', '2025-03', '2025-04']);
		expect(p.points[0]).not.toBeNull();
		expect(p.points[1]).toBeNull();
		expect(p.points[2]).toBeNull();
		expect(p.points[3]).toBeNull();
	});

	it('the ratio is not inverted (price over annual rent, > 1 for realistic inputs)', () => {
		const p = priceToRentSeries(fixture24());
		expect(p.points).toHaveLength(24);
		expect(p.points[0]).toBeCloseTo(290000 / (1400 * 12), 10);
	});
});

describe('hasEnoughData', () => {
	it('needs one series with at least 2 non-null points', () => {
		expect(
			hasEnoughData([
				[null, 1500],
				[null, null]
			])
		).toBe(false);
		expect(hasEnoughData([[1400, null, 1500]])).toBe(true);
		expect(hasEnoughData([])).toBe(false);
		expect(hasEnoughData([[1400], [1500]])).toBe(false);
	});
});

describe('currentStats', () => {
	it('reads the top-level medians and the price-to-rent ratio', () => {
		const c = currentStats(fixture24());
		expect(c).toEqual({
			medianRent: 1630,
			medianPrice: 313000,
			priceToRent: 313000 / (1630 * 12),
			listings: 63,
			lastUpdated: '2026-09-28T00:00:00.000Z'
		});
	});

	it('falls back to the sale date and never returns NaN', () => {
		const c = currentStats({
			zipCode: ZIP,
			rentalData: { medianRent: 0, lastUpdatedDate: null },
			saleData: { medianPrice: 300000, lastUpdatedDate: '2026-09-01' }
		});
		expect(c.priceToRent).toBeNull();
		expect(c.lastUpdated).toBe('2026-09-01');
		expect(c.listings).toBeNull();
		const empty = currentStats({ zipCode: ZIP });
		expect(empty).toEqual({
			medianRent: null,
			medianPrice: null,
			priceToRent: null,
			listings: null,
			lastUpdated: null
		});
	});
});

describe('zipMedianRentForBeds', () => {
	const stats: MarketStatsInput = {
		zipCode: ZIP,
		rentalData: {
			medianRent: 1700,
			history: {
				'2025-01': { medianRent: 1500, dataByBedrooms: [bed(3, 1800, 12)] },
				'2025-03': { medianRent: 1550, dataByBedrooms: [bed(2, 1500, 9)] },
				'2025-02': { medianRent: 1520, dataByBedrooms: [bed(3, 1850, 11), bed(4, 2100, 4)] }
			}
		}
	};

	it('uses the latest month with that bedroom count', () => {
		expect(zipMedianRentForBeds(stats, 3)).toEqual({
			rentDollars: 1850,
			basis: 'bedrooms',
			month: '2025-02',
			listings: 11
		});
	});

	it('beds >= 4 match the 4plus rule', () => {
		expect(zipMedianRentForBeds(stats, 6)).toEqual({
			rentDollars: 2100,
			basis: 'bedrooms',
			month: '2025-02',
			listings: 4
		});
	});

	it('falls back to the latest overall monthly median, then to the top level', () => {
		expect(zipMedianRentForBeds(stats, 1)).toEqual({
			rentDollars: 1550,
			basis: 'all',
			month: '2025-03',
			listings: null
		});
		expect(zipMedianRentForBeds(stats, null)?.basis).toBe('all');
		expect(
			zipMedianRentForBeds({ zipCode: ZIP, rentalData: { medianRent: 1700, totalListings: 30 } }, 2)
		).toEqual({ rentDollars: 1700, basis: 'all', month: null, listings: 30 });
	});

	it('returns null when no rent exists anywhere', () => {
		expect(zipMedianRentForBeds({ zipCode: ZIP }, 2)).toBeNull();
		expect(zipMedianRentForBeds({ zipCode: ZIP, rentalData: { history: {} } }, 2)).toBeNull();
	});
});
