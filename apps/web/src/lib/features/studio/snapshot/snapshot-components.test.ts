// SSR tests for the Market Snapshot builder components (09-16). svelte/server renders each
// component to a string in the node project; onMount and $effect never run there, so nothing in
// these renders can read or spend. Click-driven behaviour is tested through the pure helpers the
// components export from their module scripts.
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { describe, expect, test } from 'vitest';
import { longDate, monthYear } from '@tran/core/format';
import {
	snapshotFigureValues,
	type AggregatedSample,
	type SnapshotMetrics
} from '@tran/core/studio';
import { SAMPLE_SNAPSHOT_RECORD } from '../fixtures/sample-snapshot';
import ListingsSummaryTable from './ListingsSummaryTable.svelte';
import SnapshotKeyFigures from './SnapshotKeyFigures.svelte';

const strip = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
/** Visible text with tags dropped and whitespace collapsed. */
const textOf = (h: string) =>
	strip(h)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each case passes its component's props
const html = <P extends Record<string, any>>(C: Component<P>, props: P) =>
	strip(render(C, { props }).body);

const all = (h: string, tag: string) =>
	[...h.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => textOf(m[1]));

const METRICS: SnapshotMetrics = SAMPLE_SNAPSHOT_RECORD.metrics;

describe('SnapshotKeyFigures (SSR)', () => {
	test('terms, values from snapshotFigureValues and the definition lines, in order', () => {
		const out = html(SnapshotKeyFigures, { metrics: METRICS });
		const v = snapshotFigureValues(METRICS);
		expect(out).toMatch(/^<dl/);
		expect(all(out, 'dt')).toEqual([
			'Median rent',
			'Median list price',
			'Price-to-rent ratio',
			'Rent change',
			'Median days on market',
			'Homes for sale'
		]);
		const dds = [...out.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => all(m[1], 'span'));
		expect(dds.map((d) => d[0])).toEqual([
			v.medianRent,
			v.medianPrice,
			v.priceToRent,
			v.rentChange,
			v.saleDom,
			v.saleTotal
		]);
		expect(dds.map((d) => d[1])).toEqual([
			'Middle asking rent across rental listings.',
			'Middle asking price across homes for sale.',
			'Median list price divided by a year of median rent.',
			`Change in median rent from ${monthYear(METRICS.rentChangeFrom ?? '')} to ${monthYear(METRICS.rentChangeTo ?? '')}.`,
			`Homes for sale: ${v.saleDom}. Rentals: ${v.rentalDom}.`,
			`Active listings, with ${v.saleNew} new last month.`
		]);
		// Sample figures are all present: no dash and no missing line anywhere.
		expect(textOf(out)).not.toContain('—');
		expect(textOf(out)).not.toContain("Not in RentCast's data");
		// Screen grid: 1 / 2 / 3 columns; no print class.
		expect(out).toContain('sm:grid-cols-2');
		expect(out).toContain('lg:grid-cols-3');
		expect(out).not.toContain('print-keep');
	});

	test('a missing figure shows a dash and the missing line, never $0', () => {
		const out = html(SnapshotKeyFigures, {
			metrics: { ...METRICS, medianRent: null, priceToRent: null }
		});
		const dds = [...out.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => all(m[1], 'span'));
		expect(dds[0]).toEqual(['—', "Not in RentCast's data for this ZIP"]);
		expect(dds[2]).toEqual(['—', "Not in RentCast's data for this ZIP"]);
		expect(textOf(out)).not.toContain('$0');
	});

	test('rent change without a window is missing too', () => {
		const out = html(SnapshotKeyFigures, {
			metrics: { ...METRICS, rentChangePct: null, rentChangeFrom: null, rentChangeTo: null }
		});
		const dd = [...out.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => all(m[1], 'span'))[3];
		expect(dd).toEqual(['—', "Not in RentCast's data for this ZIP"]);
	});

	test('print: two columns and print-keep', () => {
		const out = html(SnapshotKeyFigures, { metrics: METRICS, print: true });
		const dl = out.match(/<dl[^>]*>/)?.[0] ?? '';
		expect(dl).toContain('print-keep');
		expect(dl).toContain('grid-cols-2');
		expect(dl).not.toContain('lg:grid-cols-3');
	});
});

const SALE: AggregatedSample = {
	kind: 'sale',
	seenAt: '2026-10-01T12:00:00.000Z',
	total: 9,
	byBedroom: [
		{ beds: 0, count: 1, min: 1500, max: 1500, median: 1500, medianDom: 9 },
		{ beds: 2, count: 3, min: 1700, max: 2000, median: 1850, medianDom: 17 },
		{ beds: 4, count: 5, min: 2400, max: 3100, median: 2650, medianDom: null }
	]
};

describe('ListingsSummaryTable (SSR)', () => {
	test('caption, the five column headers and bedroom row headers', () => {
		const out = html(ListingsSummaryTable, { sample: SALE, zip: '00199' });
		const caption = `Active homes for sale in ZIP 00199 that RentCast saw on ${longDate(new Date(SALE.seenAt))}: 9 listings. Counts and ranges only. Individual listings aren't shown.`;
		expect(all(out, 'caption')).toEqual([caption]);
		// The focusable scroll wrapper is named by the caption.
		const wrapper = out.match(/^<div[^>]*>/)?.[0] ?? '';
		expect(wrapper).toContain('tabindex="0"');
		expect(wrapper).toContain('overflow-x-auto');
		expect(textOf(wrapper.match(/aria-label="([^"]*)"/)?.[1] ?? '')).toBe(caption);

		const cols = [...out.matchAll(/<th[^>]*scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
			textOf(m[1])
		);
		expect(cols).toEqual([
			'Bedrooms',
			'Listings',
			'Price range',
			'Median',
			'Median days on market'
		]);
		const rows = [...out.matchAll(/<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
			textOf(m[1])
		);
		expect(rows).toEqual(['Studio', '2 bedrooms', '4+ bedrooms']);
		expect(all(out, 'td')).toEqual([
			'1',
			'$1,500',
			'$1,500',
			'9',
			'3',
			'$1,700 to $2,000',
			'$1,850',
			'17',
			'5',
			'$2,400 to $3,100',
			'$2,650',
			'—'
		]);
	});

	test('rentals caption', () => {
		const out = html(ListingsSummaryTable, {
			sample: { ...SALE, kind: 'rental' },
			zip: '00199'
		});
		expect(all(out, 'caption')[0]).toMatch(/^Active rentals in ZIP 00199 that RentCast saw on /);
	});

	test('never an image or a link, even when the input carries extra fields', () => {
		const leaky = {
			...SALE,
			formattedAddress: '1 Example Way',
			photos: ['x.jpg'],
			byBedroom: SALE.byBedroom.map((r) => ({ ...r, listingAgent: 'Someone', url: '/x' }))
		} as unknown as AggregatedSample;
		const out = html(ListingsSummaryTable, { sample: leaky, zip: '00199' });
		expect(out).not.toContain('<img');
		expect(out).not.toContain('href');
		expect(out).not.toContain('Example Way');
		expect(out).not.toContain('Someone');
	});
});
