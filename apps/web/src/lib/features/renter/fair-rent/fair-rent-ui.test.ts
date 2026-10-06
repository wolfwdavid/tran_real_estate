// SSR tests for the fair-rent check's result wording (06-17, RENT-06). svelte/server renders the
// presentational pieces to a string; no gateway, network or storage. They prove the sentence reads
// as a neutral comparison with the right figures, and that no output judges the price.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Comparable, MarketSide, RentEstimate } from '@tran/core/listings';
import RentEstimateResult from './RentEstimateResult.svelte';
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

const SUBJECT = {
	id: 'SAMPLE-74201-R900',
	formattedAddress: '12 Fictional Ln, Harlow Springs, OK 74201',
	price: 2000
};

function comp(i: number, distance: number | null, overrides: Partial<Comparable> = {}): Comparable {
	return {
		id: `C-${i}`,
		formattedAddress: `${100 + i} Example St, Harlow Springs, OK 74201`,
		price: 1800 + i * 10,
		distance,
		daysOld: 3,
		correlation: 0.9,
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900 + i,
		propertyType: 'Condo',
		...overrides
	};
}

function est(overrides: Partial<RentEstimate> = {}): RentEstimate {
	return {
		kind: 'rent',
		estimate: 2080,
		low: 1900,
		high: 2260,
		subjectAddress: SUBJECT.formattedAddress,
		comparables: [comp(1, 0.4), comp(2, 0.2), comp(3, 1.1), comp(4, 0.9)],
		...overrides
	};
}

function renderEstimate(price: number, estimate: RentEstimate = est(), sample = false) {
	const { body } = render(RentEstimateResult, {
		props: { row: { ...SUBJECT, price }, estimate, sample }
	});
	return { html: body, out: text(body) };
}

describe('RentEstimateResult', () => {
	it('shows the estimate, the likely range and a within-range sentence', () => {
		const { out } = renderEstimate(2000);
		expect(out).toContain('Estimate: $2,080 a month');
		expect(out).toContain('Likely range: $1,900 to $2,260');
		expect(out).toContain('The asking rent of $2,000 is within the estimated range.');
		expect(out).toContain(
			'Estimates can be wrong. Use them as one input when you talk to the listing contact.'
		);
		expect(out).not.toContain('Low confidence');
	});

	it('states the dollar distance above or below the range', () => {
		expect(renderEstimate(2400).out).toContain(
			'The asking rent of $2,400 is $140 above the estimated range.'
		);
		expect(renderEstimate(1750).out).toContain(
			'The asking rent of $1,750 is $150 below the estimated range.'
		);
	});

	it('renders the decorative range bar with both captions, hidden from assistive tech', () => {
		const { html } = renderEstimate(2400);
		expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-rent-range-bar/);
		const bar = text(html.slice(html.indexOf('data-rent-range-bar')));
		expect(bar).toContain('Asking $2,400');
		expect(bar).toContain('Estimate $2,080');
	});

	it('omits the range lines and bar when RentCast gives no range', () => {
		const { out, html } = renderEstimate(2000, est({ low: null, high: null }));
		expect(out).toContain('Estimate: $2,080 a month');
		expect(out).not.toContain('Likely range');
		expect(html).not.toContain('data-rent-range-bar');
	});

	it('shows the low-confidence badge for 2 comparables, and singular for 1', () => {
		const two = renderEstimate(2000, est({ comparables: [comp(1, 0.5), comp(2, 0.3)] })).out;
		expect(two).toContain('Low confidence: 2 comparables');
		expect(two).toContain(
			'RentCast found few similar rentals nearby, so this estimate could be well off.'
		);
		expect(renderEstimate(2000, est({ comparables: [comp(1, 0.5)] })).out).toContain(
			'Low confidence: 1 comparable'
		);
	});

	it('drops the subject listing before counting comparables', () => {
		const withSubject = [
			comp(1, 0.5),
			comp(2, 0.3),
			comp(0, 0, { id: SUBJECT.id, formattedAddress: SUBJECT.formattedAddress })
		];
		const { out } = renderEstimate(2000, est({ comparables: withSubject }));
		expect(out).toContain('Low confidence: 2 comparables');
		expect(out).not.toContain('12 Fictional Ln');
	});

	it('lists at most 10 comparables, nearest first, as text with formatted cells', () => {
		const many = Array.from({ length: 14 }, (_, i) => comp(i + 1, (14 - i) / 10));
		const { html, out } = renderEstimate(2000, est({ comparables: many }));
		const distances = [...html.matchAll(/data-distance="([\d.]+)"/g)].map((m) => Number(m[1]));
		expect(distances).toHaveLength(10);
		expect(distances).toEqual([...distances].sort((a, b) => a - b));
		expect(out).toContain('Similar rentals RentCast compared');
		expect(out).toContain('Rental Rent Distance Size');
		expect(out).toContain('114 Example St 2 bd · 1 ba $1,940 0.1 mi 914 sq ft');
		expect(html).not.toMatch(/<a\b/);
	});

	it('replaces the table with a line when there are no comparables', () => {
		const { out, html } = renderEstimate(2000, est({ comparables: [] }));
		expect(out).toContain("RentCast didn't return comparable rentals for this estimate.");
		expect(out).toContain('Low confidence: 0 comparables');
		expect(html).not.toContain('<table');
	});

	it('puts the Sample chip in the comparables caption row in sample mode', () => {
		const caption = (h: string) => text(h.slice(h.indexOf('<caption'), h.indexOf('</caption>')));
		expect(caption(renderEstimate(2000, est(), true).html)).toContain('Sample data');
		expect(caption(renderEstimate(2000, est(), false).html)).not.toContain('Sample data');
	});

	it('never judges the price in any state', () => {
		for (const price of [1750, 2000, 2400]) {
			expect(renderEstimate(price).out).not.toMatch(JUDGMENT);
			expect(renderEstimate(price, est({ comparables: [comp(1, 0.2)] })).out).not.toMatch(JUDGMENT);
		}
	});
});
