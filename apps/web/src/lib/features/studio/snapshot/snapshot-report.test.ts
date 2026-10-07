// SSR tests for the Market Snapshot printout (09-18): the report copy, the brand band and the
// whole report body rendered from the frozen sample record. svelte/server runs no onMount and no
// LayerChart plot, so these prove the text, the order and the not-removable parts; the real
// browser print layout is proven by tests/e2e/snapshot-print.spec.ts.
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import type { SnapshotRecord, SnapshotSectionKey } from '$lib/storage/studio/types';
import { SAMPLE_SNAPSHOT_RECORD } from '../fixtures/sample-snapshot';
import BrandBand, { bandColors } from './BrandBand.svelte';
import SnapshotReport from './SnapshotReport.svelte';
import {
	dataSourcesSentence,
	EHO_STATEMENT,
	EHO_TITLE,
	fullLabel,
	NOTES_AI_NOTE,
	preparedLine,
	SAMPLE_FOOTER,
	SAMPLE_SENTENCE,
	SHORT_LABEL,
	snapshotDocumentTitle,
	TRAN_FOOTER
} from './report-copy';

const strip = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
const textOf = (h: string) =>
	strip(h)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();

const report = (record: SnapshotRecord, logoUrl: string | null = null) =>
	strip(render(SnapshotReport, { props: { record, logoUrl } }).body);

const withOptions = (o: Partial<SnapshotRecord['options']>): SnapshotRecord => ({
	...SAMPLE_SNAPSHOT_RECORD,
	options: { ...SAMPLE_SNAPSHOT_RECORD.options, ...o }
});

const withAgent = (a: Partial<SnapshotRecord['agent']>): SnapshotRecord['agent'] => ({
	...SAMPLE_SNAPSHOT_RECORD.agent,
	...a
});

const h2s = (html: string) =>
	[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => textOf(m[1]));

/** Computed font role classes of the element carrying `attr`. */
const classOf = (html: string, attr: string) =>
	new RegExp(`<p[^>]*class="([^"]*)"[^>]*${attr}`).exec(html)?.[1] ??
	new RegExp(`<p[^>]*${attr}[^>]*class="([^"]*)"`).exec(html)?.[1] ??
	'';

describe('report copy', () => {
	test('the short label and the verbatim statements', () => {
		expect(SHORT_LABEL).toBe(
			'Market information only. Not a comparative market analysis or a professional valuation of any property.'
		);
		expect(EHO_STATEMENT).toMatch(/^We are pledged to the letter and spirit of U\.S\. policy/);
		expect(TRAN_FOOTER).toBe('Prepared with Tran Real Estate Tools.');
		expect(SAMPLE_FOOTER).toBe('Sample data, not a real market.');
	});

	test('fullLabel without and with market notes', () => {
		const plain = fullLabel('2026-03-05', null);
		expect(plain).toMatch(
			/^This report summarizes listing-based market statistics from RentCast as of Mar 5, 2026\./
		);
		expect(plain).toContain(
			'It is not a comparative market analysis, a professional valuation of any property, or investment, legal, or tax advice.'
		);
		expect(plain.endsWith('can be wrong.')).toBe(true);
		const notes = fullLabel('2026-03-05', { agentName: 'Avery Sample' });
		expect(notes.endsWith('reviewed by Avery Sample.')).toBe(true);
	});

	test('dataSourcesSentence on the sample record', () => {
		const s = dataSourcesSentence(SAMPLE_SNAPSHOT_RECORD);
		expect(s).toMatch(
			/^Market statistics from RentCast, retrieved Oct 1, 2026, based on listings RentCast saw in ZIP 74201\./
		);
		expect(s).toContain(
			'The active listings summary uses 12 RentCast for-sale listings seen Oct 1, 2026.'
		);
		expect(s).toContain('Market notes are sample output written in advance.');
		expect(s).toContain('All figures and agent details in this sample report are made up.');
	});

	test('dataSourcesSentence names the provider and model of real notes, none without notes', () => {
		const live: SnapshotRecord = {
			...SAMPLE_SNAPSHOT_RECORD,
			sample: false,
			listingsSample: null,
			narrative: {
				text: 'Rents rose.',
				artifactId: 'a1',
				provider: 'anthropic',
				model: 'claude-sonnet-5',
				sampleOutput: false
			}
		};
		const s = dataSourcesSentence(live);
		expect(s).toContain('Market notes drafted with');
		expect(s).toContain('claude-sonnet-5.');
		expect(s).not.toContain('made up');
		expect(s).not.toContain('active listings summary');
		const noNotes = dataSourcesSentence({
			...live,
			options: { ...live.options, sections: ['keyFigures'] }
		});
		expect(noNotes).not.toContain('Market notes');
	});

	test('preparedLine and the document title', () => {
		expect(preparedLine('2026-10-01T12:00:00.000Z', 'Avery Sample', 'Sample Realty')).toBe(
			'Prepared Oct 1, 2026 by Avery Sample, Sample Realty'
		);
		expect(snapshotDocumentTitle(SAMPLE_SNAPSHOT_RECORD)).toBe(
			'Market Snapshot - ZIP 74201 - 2026-10-01'
		);
	});
});

describe('BrandBand', () => {
	test('failing colors fall back to the Tran tokens', () => {
		const agent = withAgent({ brandPrimary: '#FFFF00', brandAccent: '#000000' });
		expect(bandColors(agent)).toEqual({ primary: '#A4452A', accent: '#F6E3D8' });
		const html = strip(render(BrandBand, { props: { agent } }).body);
		expect(html).toContain('--brand-primary-effective: #A4452A');
		expect(html).toContain('--brand-accent-effective: #F6E3D8');
	});

	test('a passing primary is kept; anything not #RRGGBB falls back', () => {
		expect(bandColors(withAgent({ brandPrimary: '#1F4E79', brandAccent: '' })).primary).toBe(
			'#1F4E79'
		);
		for (const bad of ['1F4E79', '#1F4', 'red', '#1F4E79; color: red', 'url(x)']) {
			expect(bandColors(withAgent({ brandPrimary: bad, brandAccent: bad }))).toEqual({
				primary: '#A4452A',
				accent: '#F6E3D8'
			});
		}
	});

	test('brokerage in Heading 24/600 over the agent line in Body 16/600; logo only with a URL', () => {
		const html = strip(render(BrandBand, { props: { agent: SAMPLE_SNAPSHOT_RECORD.agent } }).body);
		expect(classOf(html, 'data-band-brokerage')).toContain('text-heading');
		expect(classOf(html, 'data-band-brokerage')).toContain('font-display');
		expect(textOf(html)).toContain('Sample Realty');
		expect(classOf(html, 'data-band-agent')).toContain('text-base');
		expect(classOf(html, 'data-band-agent')).toContain('font-semibold');
		expect(textOf(html)).toContain('Avery Sample, Licensed Real Estate Salesperson');
		expect(html).not.toContain('<img');

		const withLogo = strip(
			render(BrandBand, {
				props: { agent: SAMPLE_SNAPSHOT_RECORD.agent, logoUrl: 'blob:http://x/1' }
			}).body
		);
		expect(withLogo).toContain('alt="Sample Realty logo"');
		expect(withLogo).toContain('src="blob:http://x/1"');
	});

	test('team variant: "{Team} at {Brokerage}"', () => {
		const agent = withAgent({
			disclosure: { ...SAMPLE_SNAPSHOT_RECORD.agent.disclosure, teamName: 'Harlow Team' }
		});
		const html = strip(render(BrandBand, { props: { agent } }).body);
		expect(textOf(html)).toContain('Harlow Team at Sample Realty');
	});
});

describe('SnapshotReport (sample record)', () => {
	const html = report(SAMPLE_SNAPSHOT_RECORD);
	const text = textOf(html);

	test('labels, title, prepared line and sample marking', () => {
		expect(text).toContain(SHORT_LABEL);
		expect(text).toContain('Market Snapshot: ZIP 74201');
		expect(text).toContain('Harlow Springs, OK');
		expect(text).toContain('Prepared Oct 1, 2026 by Avery Sample, Sample Realty');
		expect(text).toContain(SAMPLE_SENTENCE);
		expect(text).not.toContain('the property, the estimates');
		expect(text).toContain(SAMPLE_FOOTER);
		expect(text).toContain(TRAN_FOOTER);
		expect(text).toContain(EHO_TITLE);
		expect(text).toContain(EHO_STATEMENT);
		expect(text).toContain(NOTES_AI_NOTE('Avery Sample'));
		expect(text).toContain(
			'This report summarizes listing-based market statistics from RentCast as of Oct 1, 2026.'
		);
		expect(text).toContain('reviewed by Avery Sample.');
	});

	test('section h2s in report order', () => {
		expect(h2s(html)).toEqual([
			'Key figures',
			'Rent trend by bedroom count',
			'Price-to-rent ratio',
			'Rent by bedroom',
			'Days on market and inventory',
			'Active listings summary',
			'Market notes',
			'Prepared by',
			'Data sources',
			'Important'
		]);
	});

	test('Prepared by: composeDisclosure print lines, brokerage first, license line', () => {
		const block = /<section[^>]*data-prepared-by[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
		const t = textOf(block);
		expect(t).toMatch(
			/^Prepared by Sample Realty Avery Sample, Licensed Real Estate Salesperson License #SAMPLE-0001 \(TX\)/
		);
		expect(t).toContain('Office (555) 555-0100');
		expect(t).toContain('Mobile (555) 555-0199');
		expect(t).toContain('avery@example.com');
		expect(classOf(block, 'data-prepared-brokerage')).toContain('font-semibold');
		expect(classOf(block, 'data-prepared-agent')).not.toContain('font-semibold');
		expect(classOf(block, 'data-prepared-license')).toContain('text-label');
		expect(block).toContain('print-keep');
	});

	test('tables: Rent by bedroom and Days on market and inventory', () => {
		for (const h of [
			'Bedrooms',
			'Median rent',
			'Listings counted',
			'Median days on market',
			'Active listings',
			'New listings'
		]) {
			expect(html).toMatch(new RegExp(`<th scope="col"[^>]*>${h}</th>`));
		}
		expect(html).toMatch(/<th scope="row"[^>]*>Homes for sale<\/th>/);
		expect(html).toMatch(/<th scope="row"[^>]*>Rentals<\/th>/);
		expect(html).toMatch(/<th scope="row"[^>]*>Studio<\/th>/);
		expect(html).toMatch(/<th scope="row"[^>]*>4\+ bedrooms<\/th>/);
		expect(text).toContain('$1,100');
	});

	test('the agent brand reaches only the custom properties, charts render in print', () => {
		expect(html).toContain('--brand-primary-effective: #A4452A');
		expect(html).toContain('--brand-accent-effective: #F6E3D8');
		expect(html).toContain('data-print-plot');
		expect(html).not.toContain('<details');
	});
});

describe('SnapshotReport options', () => {
	test('EHO and Tran footer off: both absent; the not-removable parts stay', () => {
		const text = textOf(report(withOptions({ eho: false, tranFooter: false })));
		expect(text).not.toContain(EHO_TITLE);
		expect(text).not.toContain(TRAN_FOOTER);
		expect(text).toContain(SHORT_LABEL);
		expect(text).toContain('Prepared by');
		expect(text).toContain('Data sources');
		expect(text).toContain('as of Oct 1, 2026');
		expect(text).toContain(SAMPLE_FOOTER);
	});

	test('a non-sample record without the Tran footer has no footer note at all', () => {
		const html = report({
			...SAMPLE_SNAPSHOT_RECORD,
			sample: false,
			options: { ...SAMPLE_SNAPSHOT_RECORD.options, tranFooter: false }
		});
		expect(html).not.toContain('data-sample-footer');
		expect(html).not.toContain('data-tran-footer');
		expect(html).not.toContain('data-provenance-chip="sample"');
	});

	test('key figures only: no chart, no notes', () => {
		const html = report(withOptions({ sections: ['keyFigures'] as SnapshotSectionKey[] }));
		const heads = h2s(html);
		expect(heads).not.toContain('Rent trend by bedroom count');
		expect(heads).not.toContain('Market notes');
		expect(heads).toContain('Key figures');
		expect(heads).toContain('Prepared by');
		expect(textOf(html)).not.toContain('reviewed by Avery Sample');
	});
});
