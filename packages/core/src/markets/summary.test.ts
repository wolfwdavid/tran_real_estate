import { describe, expect, it } from 'vitest';
import {
	fewListingsSuffix,
	priceToRentSummary,
	rentTrendSummary,
	timeRangeLine
} from './summary.js';
import { monthRange } from './series.js';
import type { PriceToRent, RentTrend } from './types.js';

const MONTHS = monthRange(['2024-10', '2026-09']);

function trend(): RentTrend {
	const n = MONTHS.length;
	const studio: (number | null)[] = Array.from({ length: n }, () => null);
	const two: (number | null)[] = Array.from({ length: n }, () => null);
	studio[0] = 1100;
	studio[10] = 1140;
	studio[n - 1] = 1180;
	two[0] = 1450;
	two[n - 1] = 1620;
	return {
		months: MONTHS,
		series: [
			{ key: 'studio', label: 'Studio', points: studio, counts: studio.map(() => null) },
			{ key: '2', label: '2 bedrooms', points: two, counts: two.map(() => null) }
		]
	};
}

describe('timeRangeLine', () => {
	it('names the first and last month', () => {
		expect(MONTHS).toHaveLength(24);
		expect(timeRangeLine(MONTHS)).toBe('Monthly medians, Oct 2024 to Sep 2026');
	});

	it('is empty without months', () => {
		expect(timeRangeLine([])).toBe('');
	});
});

describe('rentTrendSummary', () => {
	it('names each drawn series with its first and last point', () => {
		expect(rentTrendSummary('79999', trend())).toBe(
			'Median rent in ZIP 79999. Studio: $1,100 in Oct 2024, $1,180 in Sep 2026. 2 bedrooms: $1,450 in Oct 2024, $1,620 in Sep 2026.'
		);
	});

	it('uses the first and last NON-null points and their months', () => {
		const t = trend();
		t.series[1].points[0] = null;
		t.series[1].points[3] = 1500;
		t.series[1].points[23] = null;
		t.series[1].points[20] = 1599.5;
		expect(rentTrendSummary('79999', t)).toBe(
			'Median rent in ZIP 79999. Studio: $1,100 in Oct 2024, $1,180 in Sep 2026. 2 bedrooms: $1,500 in Jan 2025, $1,600 in Jun 2026.'
		);
	});

	it('ends with (sample data) in sample mode', () => {
		const s = rentTrendSummary('79999', trend(), { sample: true });
		expect(s.endsWith('$1,620 in Sep 2026. (sample data)')).toBe(true);
	});

	it('is just the prefix when no series is drawn', () => {
		expect(rentTrendSummary('79999', { months: MONTHS, series: [] })).toBe(
			'Median rent in ZIP 79999.'
		);
	});
});

describe('priceToRentSummary', () => {
	const p: PriceToRent = {
		months: MONTHS,
		points: MONTHS.map((_, i) => (i === 0 ? 16.43 : i === 23 ? 17.08 : i === 5 ? null : 16.8))
	};

	it('reports the first and last ratio with one decimal', () => {
		expect(priceToRentSummary('79999', p)).toBe(
			'Price-to-rent ratio in ZIP 79999: 16.4 in Oct 2024, 17.1 in Sep 2026.'
		);
	});

	it('appends (sample data) after the final period', () => {
		expect(priceToRentSummary('79999', p, { sample: true })).toBe(
			'Price-to-rent ratio in ZIP 79999: 16.4 in Oct 2024, 17.1 in Sep 2026. (sample data)'
		);
	});

	it('has no figures when there is no data', () => {
		expect(priceToRentSummary('79999', { months: MONTHS, points: MONTHS.map(() => null) })).toBe(
			'Price-to-rent ratio in ZIP 79999.'
		);
	});
});

describe('fewListingsSuffix', () => {
	it('marks medians from fewer than 5 listings', () => {
		expect(fewListingsSuffix(3)).toBe(' (few listings: 3)');
		expect(fewListingsSuffix(4)).toBe(' (few listings: 4)');
		expect(fewListingsSuffix(5)).toBe('');
		expect(fewListingsSuffix(null)).toBe('');
	});
});
