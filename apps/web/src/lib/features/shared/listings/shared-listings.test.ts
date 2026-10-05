// SSR structure tests for the shared listing components (06-10). Components render to a string
// with svelte/server; effects never run here.
import { readFileSync, readdirSync } from 'node:fs';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import ListingStatusChip from './ListingStatusChip.svelte';
import LocationField from './LocationField.svelte';
import PriceHistory from './PriceHistory.svelte';
import PropertyTypeMark from './PropertyTypeMark.svelte';
import Sparkline from './Sparkline.svelte';

const outputs: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	const r = render(component, { props });
	const out = r.body + r.head;
	outputs.push(out);
	return out;
}

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const text = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();

const NOW = new Date('2026-10-05T12:00:00Z');

const THREE_CHANGES = {
	'2026-06-01': { event: 'Rental Listing', price: 2200 },
	'2026-07-01': { event: 'Rental Listing', price: 2150 },
	'2026-08-01': { event: 'Rental Listing', price: 2000 },
	'2026-09-01': { event: 'Rental Listing', price: 2050 }
};

describe('LocationField', () => {
	test('labelled field with helper, no dropdown, no error by default', () => {
		const h = html(LocationField, {});
		expect(h).toMatch(/<label[^>]*for="location"[^>]*>\s*City and state, or ZIP code/);
		expect(h).toContain('For example, Austin, TX or 78701.');
		expect(h).toContain('autocomplete="off"');
		expect(h).toContain('enterkeyhint="search"');
		expect(h).toContain('aria-describedby="location-help"');
		expect(h).not.toContain('aria-invalid');
		expect(h).not.toContain('role="listbox"');
		expect(h).not.toContain('<datalist');
	});

	test.each([
		['empty', 'Enter a city and state, or a ZIP code.'],
		['city-without-state', 'Add the state, like Austin, TX.'],
		['bad-zip', 'ZIP codes have 5 digits, like 78701.'],
		['unrecognized', 'Enter a city and state, like Austin, TX, or a 5-digit ZIP code.']
	])('error %s renders the Phase 3 invalid pattern', (error, copy) => {
		const h = html(LocationField, { error, id: 'loc' });
		expect(text(h)).toContain(copy);
		expect(h).toContain('aria-invalid="true"');
		expect(h).toContain('aria-describedby="loc-help loc-error"');
		expect(h).toContain('id="loc-error"');
		expect(h).toContain('border-destructive');
		expect(h).not.toContain('role="listbox"');
	});
});

describe('PriceHistory', () => {
	test('three changes: summary, sparkline, captioned scrollable table, signed changes', () => {
		const h = html(PriceHistory, { history: THREE_CHANGES, listedDate: '2026-06-01' });
		const t = text(h);
		expect(h).toMatch(/<h2[^>]*>\s*Price and listing history/);
		expect(t).toContain('Rent went from $2,200 on Jun 1, 2026 to $2,050 on Sep 1, 2026.');
		expect(h).toContain('<svg');
		expect(h).toContain('aria-label="Listing events from RentCast"');
		expect(h).toContain('tabindex="0"');
		expect(h).toMatch(/<caption[^>]*>\s*Listing events from RentCast/);
		for (const col of ['Date', 'Event', 'Rent', 'Change']) {
			expect(h).toMatch(new RegExp(`<th scope="col"[^>]*>${col}</th>`));
		}
		expect(t).toContain('Rent changed');
		expect(t).toContain('−$150');
		expect(t).toContain('+$50');
		expect(t).toContain('no change');
		// Newest first.
		expect(t.indexOf('Sep 1, 2026')).toBeLessThan(t.indexOf('Jun 1, 2026 Listed'));
	});

	test('a single change uses the one-change sentence', () => {
		const h = html(PriceHistory, {
			history: { '2026-08-01': { price: 1900 }, '2026-09-10': { price: 1850 } },
			listedDate: null
		});
		expect(text(h)).toContain('Rent changed from $1,900 to $1,850 on Sep 10, 2026.');
		// Only 2 price points: no sparkline.
		expect(h).not.toContain('<svg');
		expect(h).toContain('<table');
	});

	test('a single listed entry replaces the table with the no-changes line', () => {
		const h = html(PriceHistory, {
			history: { '2026-09-28': { event: 'Rental Listing', price: 2150 } },
			listedDate: '2026-09-28'
		});
		expect(text(h)).toContain('No rent changes recorded since it was listed on Sep 28, 2026.');
		expect(h).not.toContain('<table');
		expect(h).not.toContain('<svg');
	});

	test('empty history falls back to listedDate, then to "Not listed"', () => {
		expect(
			text(html(PriceHistory, { history: null, listedDate: '2026-09-28T00:00:00Z' }))
		).toContain('No rent changes recorded since it was listed on Sep 28, 2026.');
		const none = html(PriceHistory, { history: {}, listedDate: null });
		expect(none).toContain('Price and listing history');
		expect(text(none)).toContain('Not listed');
		expect(none).not.toContain('<table');
	});

	test('headingLevel 3 and the sample chip', () => {
		const h = html(PriceHistory, {
			history: THREE_CHANGES,
			listedDate: null,
			headingLevel: 3,
			sample: true
		});
		expect(h).toMatch(/<h3[^>]*>\s*Price and listing history/);
		expect(h).toContain('data-provenance-chip="sample"');
	});
});

describe('Sparkline', () => {
	test('renders nothing below 3 points', () => {
		expect(text(html(Sparkline, { values: [1, 2] }))).toBe('');
		expect(html(Sparkline, { values: [1, 2] })).not.toContain('<svg');
	});
	test('3+ points: decorative svg with path and last-point dot', () => {
		const h = html(Sparkline, { values: [2200, 2150, 2050] });
		expect(h).toContain('aria-hidden="true"');
		expect(h).toContain('viewBox="0 0 320 48"');
		expect(h).toMatch(/<path[^>]*d="M/);
		expect(h).toContain('<circle');
	});
});

describe('ListingStatusChip', () => {
	test('Inactive is "No longer listed in RentCast"', () => {
		const h = html(ListingStatusChip, {
			row: { status: 'Inactive', lastSeenDate: '2026-10-04' },
			now: NOW
		});
		expect(text(h)).toBe('No longer listed in RentCast');
	});
	test('removedDate is gone too', () => {
		const h = html(ListingStatusChip, {
			row: { status: 'Active', lastSeenDate: '2026-10-04', removedDate: '2026-10-03' },
			now: NOW
		});
		expect(text(h)).toBe('No longer listed in RentCast');
	});
	test('recent row: nothing on a card, "Last seen listed" on detail', () => {
		const row = { status: 'Active', lastSeenDate: '2026-10-02' };
		expect(text(html(ListingStatusChip, { row, now: NOW }))).toBe('');
		expect(text(html(ListingStatusChip, { row, now: NOW, context: 'detail' }))).toBe(
			'Last seen listed 3 days ago'
		);
	});
	test('stale row: "Not seen lately" with or without a date', () => {
		expect(
			text(
				html(ListingStatusChip, { row: { status: 'Active', lastSeenDate: '2026-09-20' }, now: NOW })
			)
		).toBe('Not seen lately: last seen listed Sep 20');
		expect(
			text(html(ListingStatusChip, { row: { status: null, lastSeenDate: null }, now: NOW }))
		).toBe('Not seen lately');
	});
});

describe('PropertyTypeMark', () => {
	test.each([
		['Apartment', 'Three-storey'],
		['Single Family', 'M18 56V34h28v22Z'],
		['Multi-Family', 'M10 54V30'],
		['Condo', 'M22 56V10h20v46Z'],
		['Townhouse', 'M11 56V26'],
		['Manufactured', 'M6 46V30h42v16Z']
	])('%s maps to its own mark', (type, marker) => {
		const h = html(PropertyTypeMark, { type });
		// Svelte strips HTML comments in SSR, so the Apartment check uses a RenterMark path.
		const needle = type === 'Apartment' ? 'M16 56V12l16-4 16 4v44Z' : marker;
		expect(h).toContain(needle);
	});
	test.each([null, 'Land', 'Other', 'constructor'])('%s falls back to the plain home', (type) => {
		expect(html(PropertyTypeMark, { type })).toContain('M18 56V33l14-14 14 14v23Z');
	});
	test('card: 48px mark in a 64px disc; detail: 64px in 96px; disc is aria-hidden', () => {
		const card = html(PropertyTypeMark, { type: 'Condo' });
		expect(card).toMatch(/class="[^"]*size-16[^"]*bg-accent-surface|bg-accent-surface[^"]*size-16/);
		expect(card).toContain('width="48"');
		// The class holds `[&>svg]`, so match attribute by attribute, not with [^>]*.
		expect(card).toMatch(/<span data-property-mark="card" class="[^"]*" aria-hidden="true">/);
		const detail = html(PropertyTypeMark, { type: 'Condo', size: 'detail' });
		expect(detail).toContain('size-24');
		expect(detail).toContain('width="64"');
	});
});

describe('mark sources', () => {
	const dir = new URL('./marks/', import.meta.url);
	const files = readdirSync(dir).filter((f) => f.endsWith('.svelte'));
	test('six marks follow the Phase 2 rules', () => {
		expect(files).toHaveLength(6);
		for (const f of files) {
			const src = readFileSync(new URL(f, dir), 'utf8');
			expect(src, f).toContain('viewBox="0 0 64 64"');
			expect(src, f).toContain('aria-hidden="true"');
			expect(src, f).toContain('focusable="false"');
			expect(src, f).not.toMatch(/#[0-9a-f]{3,8}\b|<image|data:|style=/i);
			for (const cls of src.match(/\bfill-[a-z-]+/g) ?? []) {
				expect(['fill-surface', 'fill-deco-sage', 'fill-deco-terracotta', 'fill-none']).toContain(
					cls
				);
			}
		}
	});
});

describe('honest copy', () => {
	test('no rendered output says "available"', () => {
		expect(outputs.length).toBeGreaterThan(10);
		for (const out of outputs) expect(out.toLowerCase()).not.toContain('available');
	});
});
