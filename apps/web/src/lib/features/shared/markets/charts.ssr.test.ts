// SSR structural tests for the shared market charts (07-11). LayerChart's <Chart> renders nothing
// on the server (ssr=false), so these prove every text alternative and state exists independently
// of the client-only plot. The live SVG is verified in the 07-13 dashboard E2E.
import type { Component } from 'svelte';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import type { MarketStatsInput, RentalMonth } from '@tran/core/markets';
import ChartFigure from './ChartFigure.svelte';
import PriceToRentChart from './PriceToRentChart.svelte';
import SeriesMarker from './SeriesMarker.svelte';
import { SERIES_STYLE } from './series-style';
import ZipTrendChart from './ZipTrendChart.svelte';

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
		expect(strip(items[0] ?? '')).toBe('Studio');
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

// ---- ZipTrendChart / PriceToRentChart (Task 3) ----

const MONTHS = Array.from({ length: 24 }, (_, i) => {
	const t = Date.UTC(2024, 9 + i, 1);
	const d = new Date(t);
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
});

/** 24 months: studio missing in month 3, 2-bed backed by 3 listings in month 1, no 1/3/4+ data. */
function fixture(): MarketStatsInput {
	const rental: Record<string, RentalMonth> = {};
	const sale: Record<string, { medianPrice: number }> = {};
	MONTHS.forEach((m, i) => {
		const beds: RentalMonth['dataByBedrooms'] = [
			{ bedrooms: 2, medianRent: 2400 + i * 10, totalListings: i === 1 ? 3 : 20 }
		];
		if (i !== 3) beds.unshift({ bedrooms: 0, medianRent: 1450 + i * 5, totalListings: 12 });
		rental[m] = { medianRent: 2000 + i * 10, totalListings: 40, dataByBedrooms: beds };
		sale[m] = { medianPrice: 400000 + i * 1000 };
	});
	return {
		zipCode: '94110',
		rentalData: { history: rental },
		saleData: { history: sale }
	};
}

describe('ZipTrendChart', () => {
	const out = html(ZipTrendChart, {
		zip: '94110',
		stats: fixture(),
		state: 'ready',
		sample: true,
		provenance
	});
	const text = strip(out);

	test('titles the figure and names it by the core summary', () => {
		expect(out).toMatch(/<h2[^>]*id="rent-trend-94110-title"[^>]*>Rent trend by bedroom count</);
		expect(text).toContain('Median rent in ZIP 94110. Studio: $1,450 in Oct 2024');
		expect(text).toMatch(/\(sample data\)/);
		expect(out).toMatch(/<p[^>]*id="rent-trend-94110-summary"[^>]*>[^<]*\(sample data\)<\/p>/);
	});

	test('shows the time line and the listing-count caveat', () => {
		expect(text).toContain('Monthly medians, Oct 2024 to Sep 2026');
		expect(text).toContain(
			'Medians come from listings RentCast saw each month. Months with fewer than 5 listings for a bedroom count are marked in the table.'
		);
	});

	test('legends only the drawn series, in order', () => {
		const ul = /<ul[^>]*aria-label="Legend"[^>]*>([\s\S]*?)<\/ul>/.exec(out)![1];
		expect(strip(ul)).toBe('Studio 2 bedrooms');
	});

	test('tables every month with a column per drawn series', () => {
		expect(out).toMatch(/<th[^>]*scope="col"[^>]*>Month<\/th>/);
		expect(out).toMatch(/<th[^>]*scope="col"[^>]*>Studio<\/th>/);
		expect(out).toMatch(/<th[^>]*scope="col"[^>]*>2 bedrooms<\/th>/);
		expect(out).not.toMatch(/scope="col"[^>]*>1 bedroom</);
		expect((out.match(/scope="row"/g) ?? []).length).toBe(24);
		expect(out).toMatch(/>Oct 2024<\/th>\s*<td[^>]*>\$1,450<\/td>\s*<td[^>]*>\$2,400<\/td>/);
		expect(out).toContain('$2,410 (few listings: 3)');
		// The missing studio month is "No data", never $0.
		expect(out).toMatch(/>Jan 2025<\/th>\s*<td[^>]*>No data<\/td>/);
		expect(out).not.toContain('$0');
	});

	test('uses an h3 and drops Refresh in print', () => {
		const p = html(ZipTrendChart, {
			zip: '94110',
			stats: fixture(),
			state: 'ready',
			sample: false,
			provenance,
			headingLevel: 3,
			print: true
		});
		expect(p).toMatch(/<h3[^>]*>Rent trend by bedroom count</);
		expect(p).not.toContain('<details');
		expect(p).not.toContain('Refresh');
		expect(strip(p)).not.toContain('(sample data)');
	});

	test('shows the empty state when no series has 2 points', () => {
		const one: MarketStatsInput = {
			zipCode: '94110',
			rentalData: {
				history: { '2026-09': { dataByBedrooms: [{ bedrooms: 1, medianRent: 1800 }] } }
			}
		};
		const e = html(ZipTrendChart, { zip: '94110', stats: one, state: 'ready', sample: false });
		expect(strip(e)).toContain('Not enough monthly data for this ZIP yet.');
		expect(e).not.toContain('<table');
		const none = html(ZipTrendChart, { zip: '94110', stats: null, state: 'ready', sample: false });
		expect(strip(none)).toContain('Not enough monthly data for this ZIP yet.');
	});

	test('passes loading and error through', () => {
		const l = html(ZipTrendChart, { zip: '94110', stats: null, state: 'loading', sample: false });
		expect(strip(l)).toContain('Loading market data…');
		const er = html(ZipTrendChart, {
			zip: '94110',
			stats: null,
			state: 'error',
			sample: false,
			error: gatewayError
		});
		expect(er).toContain('data-gateway-error');
		expect(er).toContain('Rent trend by bedroom count</h2>');
	});
});

describe('PriceToRentChart', () => {
	const out = html(PriceToRentChart, {
		zip: '94110',
		stats: fixture(),
		state: 'ready',
		sample: false
	});
	const text = strip(out);

	test('titles, summarises and caveats the ratio', () => {
		expect(out).toMatch(/<h2[^>]*id="price-to-rent-94110-title"[^>]*>Price-to-rent ratio</);
		expect(text).toContain('Price-to-rent ratio in ZIP 94110: 16.7 in Oct 2024');
		expect(text).toContain(
			'Median sale price divided by a year of median rent. Sale and rent medians cover different sets of homes, so treat this as a rough market signal.'
		);
	});

	test('has no legend and one-decimal table values', () => {
		expect(out).not.toContain('aria-label="Legend"');
		expect(out).toMatch(/<th[^>]*scope="col"[^>]*>Price-to-rent ratio<\/th>/);
		expect(out).toMatch(/>Oct 2024<\/th>\s*<td[^>]*>16\.7<\/td>/);
		expect((out.match(/scope="row"/g) ?? []).length).toBe(24);
	});

	test('shows the empty state without sale data', () => {
		const s = fixture();
		s.saleData = null;
		const e = html(PriceToRentChart, { zip: '94110', stats: s, state: 'ready', sample: false });
		expect(strip(e)).toContain('Not enough monthly data for this ZIP yet.');
	});
});
