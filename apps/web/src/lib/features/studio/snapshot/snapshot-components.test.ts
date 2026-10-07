// SSR tests for the Market Snapshot builder components (09-16). svelte/server renders each
// component to a string in the node project; onMount and $effect never run there, so nothing in
// these renders can read or spend. Click-driven behaviour is tested through the pure helpers the
// components export from their module scripts.
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { EMPTY_PROFILE_INPUT, type ProfileInput } from '@tran/core/agent/types';
import { longDate, monthYear, NOT_AVAILABLE } from '@tran/core/format';
import { GatewayError } from '@tran/core/request';
import {
	snapshotFigureValues,
	type AggregatedSample,
	type SnapshotMetrics
} from '@tran/core/studio';
import { SAMPLE_AGENT_PROFILE } from '$lib/features/shared/agent-profile';
import { SNAPSHOT_SECTION_KEYS } from '$lib/storage/studio/types';
import {
	SAMPLE_FETCHED_AT,
	SAMPLE_MARKET_STATS,
	SAMPLE_SNAPSHOT_RECORD
} from '../fixtures/sample-snapshot';
import ListingsSummaryTable from './ListingsSummaryTable.svelte';
import SnapshotKeyFigures from './SnapshotKeyFigures.svelte';
import SnapshotSectionToggles, {
	ALWAYS_INCLUDED,
	brandFallbackNotes,
	DATA_SECTION_KEYS,
	DEFAULT_INCLUDE,
	EHO_SENTENCE,
	SECTIONS_REQUIRED,
	validateSections
} from './SnapshotSectionToggles.svelte';
import type { SnapshotData } from './snapshot-data';
import ZipPicker, {
	ANOTHER,
	chooseZip,
	loadChosenZip,
	loadedAnnouncement,
	SAMPLE_ZIP_OPTIONS,
	toEstimate,
	ZIP_INVALID,
	ZIP_REQUIRED,
	type ZipOption
} from './ZipPicker.svelte';

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
		expect(textOf(out)).not.toContain(NOT_AVAILABLE);
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
		expect(dds[0]).toEqual([NOT_AVAILABLE, "Not in RentCast's data for this ZIP"]);
		expect(dds[2]).toEqual([NOT_AVAILABLE, "Not in RentCast's data for this ZIP"]);
		expect(textOf(out)).not.toContain('$0');
	});

	test('rent change without a window is missing too', () => {
		const out = html(SnapshotKeyFigures, {
			metrics: { ...METRICS, rentChangePct: null, rentChangeFrom: null, rentChangeTo: null }
		});
		const dd = [...out.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => all(m[1], 'span'))[3];
		expect(dd).toEqual([NOT_AVAILABLE, "Not in RentCast's data for this ZIP"]);
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
			NOT_AVAILABLE
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

/** A data path whose every method is a spy: SSR and invalid input must never touch it. */
function spyData() {
	return {
		snapshotZipCost: vi.fn(),
		loadZipData: vi.fn(),
		listingsSummaryCost: vi.fn(),
		loadListingsSummary: vi.fn()
	} as unknown as SnapshotData & Record<keyof SnapshotData, ReturnType<typeof vi.fn>>;
}

function expectNothingRead(data: ReturnType<typeof spyData>): void {
	expect(data.snapshotZipCost).not.toHaveBeenCalled();
	expect(data.loadZipData).not.toHaveBeenCalled();
	expect(data.listingsSummaryCost).not.toHaveBeenCalled();
	expect(data.loadListingsSummary).not.toHaveBeenCalled();
}

/** U+00B7, the separator inside cost labels. */
const DOT = String.fromCharCode(0xb7);
const NOW = Date.parse('2026-10-07T12:00:00.000Z');
const WATCHED: ZipOption[] = [
	{
		zip: '00198',
		placeName: null,
		savedAt: NOW - 2 * 60 * 60 * 1000,
		cost: { calls: 0, cached: true, sample: false },
		sample: false
	},
	{
		zip: '00199',
		placeName: null,
		savedAt: null,
		cost: { calls: 1, cached: false, sample: false },
		sample: false
	}
];

const buttonText = (out: string) =>
	[...out.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => textOf(m[1]));
const labelsOf = (out: string) => all(out, 'label');

describe('ZipPicker (SSR)', () => {
	test('watched ZIPs: radio rows with provenance and cost, then Another ZIP code', () => {
		const data = spyData();
		const out = html(ZipPicker, {
			onLoaded: () => {},
			sampleMode: false,
			data,
			options: WATCHED,
			now: NOW
		});
		expect(all(out, 'legend')).toEqual(['ZIP code']);
		const radios = [...out.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]);
		expect(radios).toHaveLength(3);
		expect(radios.every((r) => !/\schecked/.test(r))).toBe(true);
		expect(labelsOf(out)).toEqual([
			`ZIP 00198 Saved 2 hours ago (0 calls ${DOT} cached)`,
			'ZIP 00199 Not saved in this browser (1 call)',
			'Another ZIP code'
		]);
		// The input appears only once Another ZIP code is chosen.
		expect(textOf(out)).not.toContain('ZIP code to load');
		expect(buttonText(out)).toEqual(['Load ZIP data']);
		expect(out).not.toContain('data-sample-chip');
		expectNothingRead(data);
	});

	test('no watched ZIPs: the labelled numeric input and the helper show directly', () => {
		const data = spyData();
		const out = html(ZipPicker, { onLoaded: () => {}, sampleMode: false, data, options: [] });
		expect(out).not.toContain('<fieldset');
		const label = out.match(/<label[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/label>/);
		expect(textOf(label?.[2] ?? '')).toBe('ZIP code to load');
		const input = out.match(new RegExp(`<input[^>]*id="${label?.[1]}"[^>]*>`))?.[0] ?? '';
		expect(input).toContain('inputmode="numeric"');
		expect(input).toContain('maxlength="5"');
		const helperId = input.match(/aria-describedby="([^"]+)"/)?.[1] ?? '';
		const helper = out.match(new RegExp(`<p[^>]*id="${helperId}"[^>]*>([\\s\\S]*?)</p>`));
		expect(textOf(helper?.[1] ?? '')).toBe(
			'ZIP codes you watch in the investor portal show up here, and loading them again costs nothing while their data is saved.'
		);
		expect(buttonText(out)).toEqual(['Load ZIP data']);
		expectNothingRead(data);
	});

	test('sample mode: fixture ZIP rows with Sample chips, the sample note and its Settings link', () => {
		const data = spyData();
		const out = html(ZipPicker, { onLoaded: () => {}, sampleMode: true, data, options: WATCHED });
		const radios = [...out.matchAll(/<input[^>]*type="radio"[^>]*>/g)];
		expect(radios).toHaveLength(SAMPLE_ZIP_OPTIONS.length);
		expect(SAMPLE_ZIP_OPTIONS.map((o) => o.zip)).toEqual([
			'74201',
			'74203',
			'70201',
			'70204',
			'85801',
			'85806'
		]);
		expect(out.match(/data-sample-chip/g)).toHaveLength(6);
		expect(labelsOf(out)[0]).toBe(
			`ZIP 74201 Harlow Springs, OK Sample data (0 calls ${DOT} sample data)`
		);
		expect(textOf(out)).not.toContain('Another ZIP code');
		expect(textOf(out)).not.toContain('ZIP 00198');
		expect(textOf(out)).toContain(
			'Sample data covers a few made-up ZIP codes. Add a RentCast key in Settings to use any ZIP code.'
		);
		const link = out.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
		expect(textOf(link?.[2] ?? '')).toBe('Add a RentCast key');
		expect(link?.[1]).toBe('/settings/#api-keys');
		expect(buttonText(out)).toEqual([`Load ZIP data (0 calls ${DOT} sample data)`]);
		expectNothingRead(data);
	});
});

describe('ZipPicker choice and load (pure)', () => {
	test('validation messages', () => {
		expect(chooseZip(ANOTHER, '123', true)).toEqual({ ok: false, message: ZIP_INVALID });
		expect(chooseZip(null, '', true)).toEqual({ ok: false, message: ZIP_REQUIRED });
		expect(chooseZip(null, '123', false)).toEqual({ ok: false, message: ZIP_INVALID });
		expect(chooseZip(null, '00199', false)).toEqual({ ok: true, zip: '00199' });
		expect(chooseZip('00198', '', true)).toEqual({ ok: true, zip: '00198' });
		expect(chooseZip(ANOTHER, ' 00199 ', true)).toEqual({ ok: true, zip: '00199' });
		expect(ZIP_INVALID).toBe('Enter a 5-digit ZIP code.');
		expect(ZIP_REQUIRED).toBe('Choose a ZIP code.');
	});

	test('invalid input never reaches the gateway', async () => {
		const data = spyData();
		expect(await loadChosenZip(data, ANOTHER, '123', true)).toEqual({
			kind: 'invalid',
			message: ZIP_INVALID
		});
		expect(await loadChosenZip(data, null, '', true)).toEqual({
			kind: 'invalid',
			message: ZIP_REQUIRED
		});
		expectNothingRead(data);
	});

	test('a valid choice spends through loadZipData once and carries the ZIP', async () => {
		const data = spyData();
		const zipData = {
			stats: SAMPLE_MARKET_STATS,
			fetchedAt: SAMPLE_FETCHED_AT,
			source: 'sample' as const,
			placeName: 'Harlow Springs, OK'
		};
		data.loadZipData.mockResolvedValue(zipData);
		const outcome = await loadChosenZip(data, '74201', '', true);
		expect(outcome).toEqual({ kind: 'loaded', result: { ...zipData, zip: '74201' } });
		expect(data.loadZipData).toHaveBeenCalledTimes(1);
		expect(data.loadZipData).toHaveBeenCalledWith('74201');
		expect(data.snapshotZipCost).not.toHaveBeenCalled();
	});

	test('"Not now" on the cap prompt is quiet; other gateway errors are returned', async () => {
		const data = spyData();
		data.loadZipData.mockRejectedValueOnce(
			new GatewayError({ kind: 'BudgetCapReached', detail: 'dismissed' })
		);
		expect(await loadChosenZip(data, '00199', '', true)).toEqual({ kind: 'dismissed' });
		const outside = new GatewayError({ kind: 'NoResults', detail: 'outside-sample-coverage' });
		data.loadZipData.mockRejectedValueOnce(outside);
		expect(await loadChosenZip(data, null, '00199', false)).toEqual({
			kind: 'error',
			error: outside
		});
		data.loadZipData.mockRejectedValueOnce(new TypeError('boom'));
		await expect(loadChosenZip(data, '00199', '', true)).rejects.toThrow('boom');
	});

	test('announcement and cost label mapping', () => {
		const rent = snapshotFigureValues(SAMPLE_SNAPSHOT_RECORD.metrics).medianRent;
		const base = {
			zip: '74201',
			stats: SAMPLE_MARKET_STATS,
			fetchedAt: SAMPLE_FETCHED_AT,
			placeName: null
		};
		expect(loadedAnnouncement({ ...base, source: 'sample' })).toBe(
			`ZIP 74201 loaded. Median rent ${rent} from sample data.`
		);
		expect(loadedAnnouncement({ ...base, source: 'rentcast' })).toBe(
			`ZIP 74201 loaded. Median rent ${rent}.`
		);
		expect(toEstimate(null)).toBeNull();
		expect(toEstimate({ calls: 0, cached: true, sample: false })).toEqual({
			calls: 0,
			reason: 'cached'
		});
		expect(toEstimate({ calls: 0, cached: false, sample: true })).toEqual({
			calls: 0,
			reason: 'sample'
		});
		expect(toEstimate({ calls: 1, cached: false, sample: false })).toEqual({
			calls: 1,
			reason: 'network'
		});
	});
});

const checkboxes = (out: string) =>
	[...out.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => /\schecked/.test(m[0]));

describe('SnapshotSectionToggles (SSR)', () => {
	const props = (over: Record<string, unknown> = {}) => ({
		value: { ...DEFAULT_INCLUDE, sections: [...DEFAULT_INCLUDE.sections] },
		zip: '00199',
		profile: SAMPLE_AGENT_PROFILE as ProfileInput,
		onListings: () => {},
		data: spyData(),
		...over
	});

	test('report sections, the opt-in summary, branding and statements', () => {
		const p = props();
		const out = html(SnapshotSectionToggles, p);
		expect(all(out, 'legend')).toEqual(['Report sections', 'Branding and statements']);
		const labels = labelsOf(out);
		expect(labels.slice(0, 6)).toEqual([
			'Key figures',
			'Rent trend chart',
			'Price-to-rent chart',
			'Rent by bedroom table',
			'Days on market and inventory table',
			'Market notes'
		]);
		expect(labels.slice(6)).toEqual([
			'Active listings summary (1 call)',
			'Include the Equal Housing Opportunity statement',
			'Include "Prepared with Tran Real Estate Tools" at the bottom'
		]);
		const text = textOf(out);
		for (const d of [
			'The main numbers at a glance.',
			'Median rent by bedroom count, month by month.',
			'How list prices compare with a year of rent.',
			"Median rent and how many listings it's based on.",
			'How long listings stay up and how many there are.',
			'A few short paragraphs, drafted with AI from these numbers, that you review.',
			"Counts, price ranges, and medians by bedroom count. No addresses or photos, so the report never advertises another agent's listing.",
			`Equal Housing Opportunity. ${EHO_SENTENCE}`,
			ALWAYS_INCLUDED
		]) {
			expect(text).toContain(d);
		}
		expect(EHO_SENTENCE).toBe(
			'We are pledged to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the Nation.'
		);
		expect(ALWAYS_INCLUDED).toBe(
			'Always included: the market-information label, your name, brokerage and license details, where the data came from, and the date.'
		);
		// Six sections checked, the summary unchecked, both statements checked.
		expect(checkboxes(out)).toEqual([true, true, true, true, true, true, false, true, true]);
		// The summary's kind chips and load button stay hidden until it is checked.
		expect(text).not.toContain('Homes for sale');
		expect(buttonText(out)).toEqual([]);
		expect(out).toContain('data-testid="brand-preview"');
		const link = out.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
		expect(textOf(link?.[2] ?? '')).toBe('Edit logo and colors in your profile');
		expect(link?.[1]).toBe('/agent/profile/');
		expect(text).not.toContain(SECTIONS_REQUIRED);
		expectNothingRead(p.data);
	});

	test('no data section checked shows the validation message', () => {
		const out = html(
			SnapshotSectionToggles,
			props({ value: { ...DEFAULT_INCLUDE, sections: ['marketNotes'] } })
		);
		expect(textOf(out)).toContain('Choose at least one section with market data.');
		expect(checkboxes(out).slice(0, 6)).toEqual([false, false, false, false, false, true]);
	});

	test('summary included: Homes for sale chip chosen and the outline load button', () => {
		const p = props({ value: { ...DEFAULT_INCLUDE, listingsKind: 'sale' } });
		const out = html(SnapshotSectionToggles, p);
		expect(checkboxes(out)[6]).toBe(true);
		const chips = [...out.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]);
		expect(chips).toHaveLength(2);
		expect(/\schecked/.test(chips[0])).toBe(true);
		expect(/\schecked/.test(chips[1])).toBe(false);
		expect(labelsOf(out)).toContain('Homes for sale');
		expect(labelsOf(out)).toContain('Rentals');
		expect(buttonText(out)).toEqual(['Load listings summary']);
		// SSR runs no onMount: not even the free cost preview is read.
		expectNothingRead(p.data);
	});

	test('no profile yet: the preview still renders with Tran colors and no fallback notes', () => {
		const out = html(SnapshotSectionToggles, props({ profile: null }));
		expect(out).toContain('data-testid="brand-preview"');
		expect(brandFallbackNotes(null)).toEqual([]);
	});
});

describe('SnapshotSectionToggles helpers (pure)', () => {
	test('validateSections: market notes alone is not a data section', () => {
		expect(validateSections([])).toBe(SECTIONS_REQUIRED);
		expect(validateSections(['marketNotes'])).toBe(SECTIONS_REQUIRED);
		for (const k of DATA_SECTION_KEYS) expect(validateSections([k, 'marketNotes'])).toBeNull();
		expect(validateSections([...SNAPSHOT_SECTION_KEYS])).toBeNull();
		expect(DATA_SECTION_KEYS).toEqual([
			'keyFigures',
			'rentTrend',
			'priceToRent',
			'rentByBedroom',
			'domInventory'
		]);
	});

	test('defaults: every section, both statements, no summary', () => {
		expect(DEFAULT_INCLUDE).toEqual({
			sections: [...SNAPSHOT_SECTION_KEYS],
			eho: true,
			tranFooter: true,
			listingsKind: null
		});
	});

	test('brand fallback notes name the Tran color', () => {
		expect(brandFallbackNotes({ ...EMPTY_PROFILE_INPUT })).toEqual([
			"No primary color chosen. Reports use Tran's terracotta.",
			"No accent color chosen. Reports use Tran's sand."
		]);
		expect(
			brandFallbackNotes({
				...EMPTY_PROFILE_INPUT,
				brandPrimary: '#ffff00',
				brandAccent: '#f6e3d8'
			})
		).toEqual(["Primary color is too low in contrast. Reports will use Tran's terracotta."]);
	});
});
