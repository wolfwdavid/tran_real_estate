// SSR tests for the Phase 9 additive print contracts (09-08): PrintReport `preparedLine` and the
// ChartFigure print variant (Body 16/600 h2 title, fixed 672-unit viewBox that scales to the sheet).
// The Phase 7 shell itself is covered by PrintReport.ssr.test.ts.
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import ChartFigure from '../markets/ChartFigure.svelte';
import PrintReport from './PrintReport.svelte';

const clean = (body: string) =>
	body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.replace(/&#39;|&apos;/g, "'");

const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));

const report = {
	title: 'Market Snapshot: ZIP 94110',
	preparedAt: new Date('2026-03-05T12:00:00Z'),
	sample: true,
	provenance: 'Market figures come from RentCast.',
	disclaimer: 'Not a CMA or appraisal.',
	disclaimerFull: 'Verify every figure before you rely on it.',
	backHref: '/agent/studio/snapshot/',
	backLabel: 'Back to Studio',
	children: snippet('<section aria-labelledby="s-a"><h2 id="s-a">Market</h2></section>')
};

const DEFAULT_LINE = 'Prepared Mar 5, 2026 with Tran Real Estate Tools';
const AGENT_LINE = 'Prepared Mar 5, 2026 by Avery Sample, Sample Realty';

describe('PrintReport preparedLine', () => {
	test('absent: the Phase 7 default prepared line', () => {
		const html = clean(render(PrintReport, { props: report }).body);
		expect(html).toContain(DEFAULT_LINE);
	});

	test('present: the caller line replaces the default', () => {
		const html = clean(
			render(PrintReport, { props: { ...report, preparedLine: AGENT_LINE } }).body
		);
		expect(html).toContain(AGENT_LINE);
		expect(html).not.toContain(DEFAULT_LINE);
		const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
		expect(header).toContain(AGENT_LINE);
	});
});

describe('ChartFigure print contract', () => {
	const figure = {
		id: 'rent-94110',
		title: 'Rent trend by bedroom count',
		state: 'ready' as const,
		summary: 'Median rent in ZIP 94110.',
		caveat: 'Medians come from listings RentCast saw each month.',
		table: { caption: 'Rent trend', columns: ['Month', 'Rent'], rows: [] },
		plot: snippet('<div data-plot></div>')
	};
	const out = (props: Record<string, unknown>) =>
		clean(render(ChartFigure, { props: { ...figure, ...props } }).body);

	test('print: the title is an h2 in Body 16/600', () => {
		const h2 = /<h2([^>]*)>Rent trend by bedroom count<\/h2>/.exec(out({ print: true }));
		expect(h2).not.toBeNull();
		const cls = /class="([^"]*)"/.exec(h2![1]!)![1]!;
		expect(cls.split(' ')).toEqual(expect.arrayContaining(['text-base', 'font-semibold']));
		expect(cls).not.toContain('text-heading');
		expect(cls).not.toContain('font-display');
	});

	test('print: the plot sits in a fixed 672-unit viewBox at full width, height auto', () => {
		const html = out({ print: true });
		const svg = /<svg([^>]*data-print-plot[^>]*)>/.exec(html)![1]!;
		expect(svg).toContain('viewBox="0 0 672 ');
		expect(svg).toContain('viewBox="0 0 672 320"');
		const cls = /class="([^"]*)"/.exec(svg)![1]!.split(' ');
		expect(cls).toEqual(expect.arrayContaining(['w-full', 'h-auto']));
		expect(svg).not.toContain('style=');
		expect(html).toMatch(/<foreignObject[^>]*width="672"[^>]*height="320"[^>]*>.*data-plot/);
		expect(out({ print: true, height: 240 })).toContain('viewBox="0 0 672 240"');
	});

	test('screen (default): Phase 7 heading and plot box unchanged', () => {
		const html = out({});
		expect(html).toMatch(
			/<h2[^>]*class="font-display text-heading font-semibold text-balance text-foreground"[^>]*>Rent trend/
		);
		expect(html).not.toContain('data-print-plot');
		expect(html).not.toContain('viewBox="0 0 672');
		expect(html).toMatch(/<div class="h-64 md:h-80 relative w-full max-w-full">\s*<div data-plot>/);
	});
});
