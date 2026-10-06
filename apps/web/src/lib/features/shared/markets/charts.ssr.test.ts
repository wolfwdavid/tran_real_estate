// SSR structural tests for the shared market charts (07-11). LayerChart's <Chart> renders nothing
// on the server (ssr=false), so these prove every text alternative and state exists independently
// of the client-only plot. The live SVG is verified in the 07-13 dashboard E2E.
import type { Component } from 'svelte';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import ChartFigure from './ChartFigure.svelte';
import SeriesMarker from './SeriesMarker.svelte';
import { SERIES_STYLE } from './series-style';

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const strip = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	return render(component, { props }).body.replace(/<!--[\s\S]*?-->/g, '');
}

const provenance = createRawSnippet((args: () => { print: boolean }) => ({
	render: () =>
		args().print
			? '<div data-prov>As of Oct 1, 2026</div>'
			: '<div data-prov>As of Oct 1, 2026 <button>Refresh (1 call)</button></div>'
}));
const gatewayError = createRawSnippet(() => ({
	render: () => '<div data-gateway-error>RentCast could not be reached.</div>'
}));
const plot = createRawSnippet(() => ({ render: () => '<div data-plot></div>' }));

const legend = (['studio', '2'] as const).map((k) => ({
	key: k,
	label: k === 'studio' ? 'Studio' : '2 bedrooms',
	...SERIES_STYLE[k]
}));

const base = {
	id: 'rent-94110',
	title: 'Rent trend by bedroom count',
	timeRange: 'Monthly medians, Oct 2025 to Dec 2025',
	legend,
	summary: 'Median rent in ZIP 94110. Studio: $1,450 in Oct 2025, $1,500 in Dec 2025.',
	caveat: 'Medians come from listings RentCast saw each month.',
	table: {
		caption: 'Rent trend by bedroom count, Oct 2025 to Dec 2025',
		columns: ['Month', 'Studio', '2 bedrooms'],
		rows: [
			{ label: 'Oct 2025', cells: ['$1,450', '$2,400'] },
			{ label: 'Nov 2025', cells: ['No data', '$2,410 (few listings: 3)'] },
			{ label: 'Dec 2025', cells: ['$1,500', '$2,450'] }
		]
	},
	provenance,
	error: gatewayError,
	plot
};

describe('ChartFigure ready', () => {
	const out = html(ChartFigure, { ...base, state: 'ready' });

	test('names and describes the figure by its title and summary', () => {
		expect(out).toMatch(
			/<figure[^>]*aria-labelledby="rent-94110-title"[^>]*aria-describedby="rent-94110-summary"/
		);
		expect(out).toMatch(/<h2[^>]*id="rent-94110-title"[^>]*>Rent trend by bedroom count<\/h2>/);
		expect(out).toMatch(/<p[^>]*id="rent-94110-summary"[^>]*>Median rent in ZIP 94110\./);
	});

	test('shows provenance with Refresh, the time line, caveat and plot', () => {
		expect(out).toContain('Refresh (1 call)');
		expect(strip(out)).toContain('Monthly medians, Oct 2025 to Dec 2025');
		expect(strip(out)).toContain('Medians come from listings RentCast saw each month.');
		expect(out).toContain('data-plot');
	});

	test('renders a visible legend with an aria-hidden line sample per series', () => {
		const ul = /<ul[^>]*aria-label="Legend"[^>]*>([\s\S]*?)<\/ul>/.exec(out);
		expect(ul).not.toBeNull();
		const items = ul![1].match(/<li[\s\S]*?<\/li>/g) ?? [];
		expect(items).toHaveLength(2);
		expect(items[0]).toMatch(/<svg[^>]*aria-hidden="true"[^>]*width="32"[^>]*height="12"/);
		expect(items[0]).toContain('stroke-dasharray="2 4"');
		expect(items[0]).toContain('stroke-muted-foreground');
		expect(strip(items[0])).toBe('Studio');
		expect(items[1]).not.toContain('stroke-dasharray');
		expect(items[1]).toContain('stroke-primary');
	});

	test('puts every value in a captioned table behind "Show data table"', () => {
		expect(out).toMatch(/<details[\s\S]*<summary[^>]*>[\s\S]*Show data table[\s\S]*<\/summary>/);
		expect(out).toMatch(
			/<div[^>]*role="region"[^>]*tabindex="0"[^>]*aria-label="Rent trend by bedroom count, Oct 2025 to Dec 2025"/
		);
		expect(out).toMatch(
			/<caption[^>]*>Rent trend by bedroom count, Oct 2025 to Dec 2025<\/caption>/
		);
		expect(out).toMatch(/<th[^>]*scope="col"[^>]*>Month<\/th>/);
		expect(out).toMatch(/<th[^>]*scope="row"[^>]*>Nov 2025<\/th>/);
		expect(out).toMatch(/<td[^>]*class="[^"]*text-right[^"]*tabular-nums[^"]*"[^>]*>No data<\/td>/);
		expect(out).toContain('$2,410 (few listings: 3)');
		expect((out.match(/<tr/g) ?? []).length).toBe(4);
	});

	test('uses h3 when headingLevel is 3', () => {
		const h3 = html(ChartFigure, { ...base, state: 'ready', headingLevel: 3 });
		expect(h3).toMatch(/<h3[^>]*id="rent-94110-title"/);
		expect(h3).not.toContain('<h2');
	});

	test('renders no legend for a single-series chart', () => {
		const single = html(ChartFigure, { ...base, state: 'ready', legend: undefined });
		expect(single).not.toContain('aria-label="Legend"');
	});

	test('has no hover handlers or tooltips', () => {
		expect(out).not.toMatch(/tooltip|onmouse/i);
	});
});

describe('ChartFigure print variant', () => {
	const out = html(ChartFigure, { ...base, state: 'ready', print: true });

	test('renders the table open, without <details>', () => {
		expect(out).not.toContain('<details');
		expect(out).not.toContain('Show data table');
		expect(out).toContain('<table');
		expect(out).toContain('$2,410 (few listings: 3)');
	});

	test('passes print to the provenance row, so no Refresh is rendered', () => {
		expect(out).toContain('data-prov');
		expect(out).not.toContain('Refresh');
	});
});

describe('ChartFigure states', () => {
	test('loading: aria-hidden placeholder at plot height plus status text, no legend or table', () => {
		const out = html(ChartFigure, { ...base, state: 'loading' });
		expect(out).toMatch(/<div[^>]*aria-hidden="true"[^>]*class="[^"]*h-64[^"]*md:h-80/);
		expect(strip(out)).toContain('Loading market data…');
		expect(out).toContain('Rent trend by bedroom count</h2>');
		expect(out).not.toContain('aria-label="Legend"');
		expect(out).not.toContain('<table');
		expect(out).not.toContain('data-plot');
	});

	test('empty: the empty-state copy, title kept, no plot or table', () => {
		const out = html(ChartFigure, { ...base, state: 'empty' });
		expect(strip(out)).toContain(
			'Not enough monthly data for this ZIP yet. RentCast needs at least 2 months of listings to draw a trend.'
		);
		expect(out).toContain('Rent trend by bedroom count</h2>');
		expect(out).not.toContain('data-plot');
		expect(out).not.toContain('<table');
		expect(out).not.toContain('aria-label="Legend"');
	});

	test('error: the GatewayError snippet replaces plot, legend and table; title kept', () => {
		const out = html(ChartFigure, { ...base, state: 'error' });
		expect(out).toContain('data-gateway-error');
		expect(out).toContain('Rent trend by bedroom count</h2>');
		expect(out).not.toContain('data-plot');
		expect(out).not.toContain('<table');
		expect(out).not.toContain('aria-label="Legend"');
	});
});

describe('SeriesMarker', () => {
	const svg = (shape: string, token = 'primary') =>
		html(SeriesMarker, { shape, token, x: 10, y: 10 });

	test('diamond is a rotated-square path inside an 8px box', () => {
		const out = svg('diamond', 'muted-foreground');
		expect(out).toMatch(/<path[^>]*d="M10 6L14 10L10 14L6 10Z"/);
		expect(out).toContain('fill-muted-foreground');
	});
	test('square is an 8px rect', () => {
		expect(svg('square', 'secondary')).toMatch(
			/<rect[^>]*x="6"[^>]*y="6"[^>]*width="8"[^>]*height="8"[^>]*class="[^"]*fill-secondary/
		);
	});
	test('circle is a filled r=4 circle', () => {
		expect(svg('circle')).toMatch(/<circle[^>]*r="4"[^>]*class="[^"]*fill-primary/);
	});
	test('triangle points up', () => {
		expect(svg('triangle', 'foreground')).toMatch(/<path[^>]*d="M10 6L14 14L6 14Z"/);
	});
	test('ring is hollow: card fill and a 2px token stroke', () => {
		const out = svg('ring', 'border-strong');
		expect(out).toMatch(/<circle[^>]*r="3"/);
		expect(out).toContain('fill-card');
		expect(out).toContain('stroke-border-strong');
		expect(out).toContain('stroke-2');
	});
	test('uses token utilities only, never a raw color', () => {
		for (const s of ['diamond', 'square', 'circle', 'triangle', 'ring'])
			expect(svg(s)).not.toMatch(/#[0-9a-f]{3,6}|fill="(?!none)|stroke="/i);
	});
});
