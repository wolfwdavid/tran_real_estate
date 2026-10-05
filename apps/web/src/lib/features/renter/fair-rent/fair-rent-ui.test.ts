// SSR tests for the fair-rent check's result wording (06-17, RENT-06). svelte/server renders the
// presentational pieces to a string; no gateway, network or storage. They prove the sentence reads
// as a neutral comparison with the right figures, and that no output judges the price.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { MarketSide } from '@tran/core/listings';
import ZipMedianResult from './ZipMedianResult.svelte';

/** Words that would judge the price or imply a valuation; none may appear in rendered output. */
const JUDGMENT = /\b(overpriced|underpriced|deal|appraisal|value)\b/i;

const text = (h: string) =>
	h
		.replace(/<!--[\s\S]*?-->/g, '')
		// Block tags separate words; inline tags (the bold figures) add no whitespace of their own.
		.replace(/<\/?(?:p|div|section|h\d|table|caption|tr|td|th)\b[^>]*>/g, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();

function side(overrides: Partial<MarketSide> = {}): MarketSide {
	return {
		average: 2050,
		median: 1900,
		min: 900,
		max: 4200,
		averagePerSquareFoot: 1.6,
		averageDaysOnMarket: 30,
		newListings: 12,
		totalListings: 120,
		byBedrooms: [bucket(0, 1100, 30), bucket(1, 1500, 40), bucket(2, 2000, 24), bucket(3, 2400, 9)],
		byPropertyType: [],
		history: [],
		lastUpdatedDate: '2026-09-30T00:00:00.000Z',
		...overrides
	};
}

function bucket(bedrooms: number, median: number, totalListings: number) {
	return {
		bedrooms,
		propertyType: null,
		average: median,
		median,
		min: null,
		max: null,
		totalListings
	};
}

function renderResult(price: number, bedrooms: number | null, rental: MarketSide = side()) {
	const { body } = render(ZipMedianResult, {
		props: { row: { price, bedrooms }, rental, zip: '74201' }
	});
	return text(body);
}

describe('ZipMedianResult', () => {
	it('states the percent above the median for the bedroom count, with the caveat', () => {
		const out = renderResult(2160, 2);
		expect(out).toContain(
			'$2,160 is 8% above the median rent of $2,000 for 2-bedroom rentals in 74201.'
		);
		expect(out).toContain(
			"Based on 24 rental listings in RentCast's data for 74201, as of Sep 2026."
		);
		expect(out).not.toContain('small sample');
	});

	it('states the percent below the median', () => {
		expect(renderResult(1700, 2)).toContain(
			'$1,700 is 15% below the median rent of $2,000 for 2-bedroom rentals in 74201.'
		);
	});

	it('reads "about the same as" under a 2% difference (1.5%)', () => {
		const out = renderResult(2030, 2);
		expect(out).toContain(
			'$2,030 is about the same as the median rent of $2,000 for 2-bedroom rentals in 74201.'
		);
		expect(out).not.toMatch(/% (above|below)/);
	});

	it('appends the small-sample sentence when the bucket has 9 listings', () => {
		const out = renderResult(2500, 3);
		expect(out).toContain(
			"Based on 9 rental listings in RentCast's data for 74201, as of Sep 2026. That's a small sample, so treat this as a rough guide."
		);
	});

	it('uses the studio wording for 0 bedrooms', () => {
		expect(renderResult(1100, 0)).toContain(
			'$1,100 is about the same as the median rent of $1,100 for studios in 74201.'
		);
	});

	it('labels the top bucket used for a count above every bucket', () => {
		expect(renderResult(2400, 6)).toContain('for 3-bedroom rentals in 74201.');
	});

	it('omits the as-of date when RentCast gives none', () => {
		expect(renderResult(2000, 2, side({ lastUpdatedDate: null }))).toContain(
			"Based on 24 rental listings in RentCast's data for 74201."
		);
	});

	it('shows the no-bedroom-data lines with the all-rentals median', () => {
		const rental = side({ byBedrooms: [bucket(1, 1500, 40), bucket(3, 2400, 9)] });
		const out = renderResult(2000, 2, rental);
		expect(out).toBe(
			'RentCast has no 2-bedroom rent data for 74201. The median for all rentals in 74201 is $1,900.'
		);
	});

	it('never judges the price in any state', () => {
		const outputs = [
			renderResult(2160, 2),
			renderResult(1700, 2),
			renderResult(2030, 2),
			renderResult(2500, 3),
			renderResult(1100, 0),
			renderResult(2000, 2, side({ byBedrooms: [] }))
		];
		for (const out of outputs) expect(out).not.toMatch(JUDGMENT);
	});
});
