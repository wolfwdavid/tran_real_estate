// SSR tests for the shared print shell (07-19, INV-06; Phase 9 reuses it): print-hidden toolbar,
// the sheet with its header disclaimer and sample label, the caller's sections, Data sources and
// the closing Important block.
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import PrintReport from './PrintReport.svelte';

const clean = (body: string) =>
	body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.replace(/&#39;|&apos;/g, "'");

const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));

const base = {
	title: 'Investment memo: Sample deal',
	subtitle: '12 Example St',
	preparedAt: new Date(Date.UTC(2026, 9, 4, 15)),
	provenance: 'All figures were entered by the person who prepared this memo.',
	disclaimer: 'Not investment, legal, or tax advice.',
	disclaimerFull: 'Verify every figure before you rely on it.',
	backHref: '/investor/memo/?id=x',
	backLabel: 'Back to memo',
	children: snippet('<section aria-labelledby="s-memo"><h2 id="s-memo">Memo</h2></section>')
};

const SAMPLE_SENTENCE =
	'Sample data: the property, the estimates, and the figures in this printout are made up.';

describe('PrintReport (sample)', () => {
	const html = clean(render(PrintReport, { props: { ...base, sample: true } }).body);

	test('toolbar is print-hidden with the back link, the print button and the help line', () => {
		const toolbar = html.slice(html.indexOf('data-print-hidden'), html.indexOf('<article'));
		expect(toolbar).toContain('href="/investor/memo/?id=x"');
		expect(toolbar).toContain('Back to memo');
		expect(toolbar).toMatch(/<button[^>]*type="button"[^>]*>.*Print or save as PDF/);
		expect(toolbar).toContain(
			"In the print dialog, choose Save as PDF as the destination. This toolbar won't appear on the page."
		);
	});

	test('sheet is an article labelled by the h1', () => {
		expect(html).toMatch(/<article[^>]*aria-labelledby="report-title"[^>]*class="[^"]*print-sheet/);
		expect(html).toMatch(/<h1[^>]*id="report-title"[^>]*>Investment memo: Sample deal<\/h1>/);
		expect(html).toContain('12 Example St');
		expect(html).toContain('Prepared Oct 4, 2026 with Tran Real Estate Tools');
	});

	test('header carries the short disclaimer, the Sample data chip and the sample sentence', () => {
		const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
		expect(header).toContain('Not investment, legal, or tax advice.');
		expect(header).toContain('data-provenance-chip="sample"');
		expect(header).toContain('Sample data');
		expect(header).toContain(SAMPLE_SENTENCE);
	});

	test('children, then Data sources, then the Important block, in order', () => {
		const memo = html.indexOf('>Memo</h2>');
		const sources = html.indexOf('>Data sources</h2>');
		const important = html.indexOf('>Important</h2>');
		expect(memo).toBeGreaterThan(-1);
		expect(sources).toBeGreaterThan(memo);
		expect(important).toBeGreaterThan(sources);
		expect(html).toContain('All figures were entered by the person who prepared this memo.');
		expect(html).toMatch(/class="[^"]*print-disclaimer[^"]*"/);
		expect(html.slice(important)).toContain('Verify every figure before you rely on it.');
	});

	test('no inline style attributes (hash-mode CSP locks style-src-attr)', () => {
		expect(html).not.toMatch(/\sstyle="/);
	});
});

describe('PrintReport (live data, brand and footer)', () => {
	const html = clean(
		render(PrintReport, {
			props: {
				...base,
				sample: false,
				brand: snippet('<span data-test-brand>Agent Co</span>'),
				footerNote: snippet('<span data-test-footer>Made with Tran</span>')
			}
		}).body
	);

	test('no sample chip or sentence', () => {
		expect(html).not.toContain('data-provenance-chip');
		expect(html).not.toContain(SAMPLE_SENTENCE);
	});

	test('brand renders in the header and footerNote after the Important block', () => {
		const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
		expect(header).toContain('data-test-brand');
		expect(html.indexOf('data-test-footer')).toBeGreaterThan(html.indexOf('>Important</h2>'));
	});
});

describe('print.css', () => {
	const css = readFileSync(new URL('./print.css', import.meta.url), 'utf8');
	test('page margins, page counter and print rules', () => {
		expect(css).toContain('@page { margin: 0.75in; }');
		expect(css).toContain('counter(pages)');
		expect(css).toContain('[data-print-hidden] { display: none !important; }');
		expect(css).toContain('thead { display: table-header-group; }');
	});
});
