// SSR structural tests for the results pieces (06-16, RENT-02): the honest card contract (Studio,
// "a month", abbreviations, the sr-only summary, the detail link, the Sample data chip, the New
// badge, never "available"), local pagination and the filtered-empty state. svelte/server renders
// to a string; no network, no storage.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Listing } from '@tran/core/listings';
import FilteredEmptyState from './FilteredEmptyState.svelte';
import ListingCard from './ListingCard.svelte';
import ResultsList from './ResultsList.svelte';
import type { RenterSearch } from './search-state.svelte';

const NOW = new Date('2026-10-05T12:00:00.000Z');
const SAMPLE = { source: 'sample' as const, fetchedAt: NOW.getTime(), stale: false };
const LIVE = { source: 'rentcast' as const, fetchedAt: NOW.getTime(), stale: false };

function listing(overrides: Partial<Listing> = {}): Listing {
	return {
		id: 'SAMPLE-74201-R900',
		kind: 'rental',
		formattedAddress: '12 Fictional Ln, Harlow Springs, OK 74201',
		addressLine1: '12 Fictional Ln',
		addressLine2: null,
		city: 'Harlow Springs',
		state: 'OK',
		zipCode: '74201',
		latitude: null,
		longitude: null,
		propertyType: 'Condo',
		bedrooms: 2,
		bathrooms: 1.5,
		squareFootage: 1050,
		yearBuilt: 1998,
		hoaFee: null,
		price: 1650,
		status: 'Active',
		listingType: null,
		listedDate: '2026-09-28T00:00:00.000Z',
		removedDate: null,
		lastSeenDate: '2026-10-02T00:00:00.000Z',
		daysOnMarket: 7,
		mlsName: null,
		mlsNumber: null,
		agent: null,
		office: null,
		history: [],
		...overrides
	};
}

const html = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '');
const text = (h: string) =>
	h
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

function card(props: Record<string, unknown>) {
	return html(
		render(ListingCard, { props: { provenance: SAMPLE, now: NOW, ...props } as never }).body
	);
}

describe('ListingCard', () => {
	it('renders a sample studio with rent, abbreviations, the summary and the detail link', () => {
		const h = card({ row: listing({ bedrooms: 0, bathrooms: 1, squareFootage: 480 }) });
		const t = text(h);
		expect(h).toMatch(/<article[^>]*aria-labelledby="card-SAMPLE-74201-R900-addr"/);
		expect(h).toMatch(/<article[^>]*data-provenance="sample"/);
		expect(t).toContain('Studio');
		expect(t).toContain('$1,650 a month');
		expect(t).toContain('Sample data');
		expect(h).toContain('<abbr title="bathrooms">ba</abbr>');
		expect(h).not.toContain('title="bedrooms"');
		expect(t).toContain('480 sq ft');
		expect(h).toContain(
			'<p class="sr-only">$1,650 a month, studio, 1 bathroom, 480 square feet, Condo, listed 7 days ago.</p>'
		);
		expect(h).toMatch(
			/id="card-SAMPLE-74201-R900-addr"[^>]*href="[^"]*renter\/listing\/\?id=SAMPLE-74201-R900"/
		);
		expect(t).toContain('Harlow Springs, OK 74201');
		expect(t).toContain('Condo · Listed 7 days ago');
		expect(t.toLowerCase()).not.toContain('available');
		expect(h).toContain('data-shortlist-toggle="card"');
		expect(h).toContain('aria-label="Save 12 Fictional Ln to shortlist"');
	});

	it('spells out bedrooms and omits missing facts instead of showing 0', () => {
		const h = card({ row: listing({ bathrooms: null, squareFootage: null }) });
		expect(h).toContain('<abbr title="bedrooms">bd</abbr>');
		expect(h).not.toContain('title="bathrooms"');
		expect(text(h)).not.toContain('sq ft');
		expect(h).toContain('2 bedrooms, Condo, listed 7 days ago.');
	});

	it('says the listing date is not shown when RentCast gave none', () => {
		const t = text(card({ row: listing({ listedDate: null }) }));
		expect(t).toContain('Condo · Listing date not shown');
		expect(t).toContain('listing date not shown.');
	});

	it('adds the New badge with its hidden suffix only when new', () => {
		const plain = text(card({ row: listing() }));
		expect(plain).not.toMatch(/\bNew\b/);
		const h = card({ row: listing(), isNew: true });
		expect(h).toContain('data-new-badge');
		expect(h).toContain('<span class="sr-only"> since your last visit</span>');
	});

	it('live rows carry no Sample chip; selected cards are aria-current; compact drops the mark', () => {
		const h = html(
			render(ListingCard, {
				props: { row: listing(), provenance: LIVE, now: NOW, selected: true, compact: true }
			}).body
		);
		expect(h).toMatch(/<article[^>]*data-provenance="rentcast"/);
		expect(text(h)).not.toContain('Sample data');
		expect(h).toMatch(/<article[^>]*aria-current="true"/);
		expect(h).not.toContain('data-property-mark');
		expect(card({ row: listing() })).toContain('data-property-mark="card"');
	});

	it('flags a listing RentCast has not seen lately, never claiming availability', () => {
		const t = text(card({ row: listing({ lastSeenDate: '2026-09-01T00:00:00.000Z' }) }));
		expect(t).toContain('Not seen lately');
		expect(t.toLowerCase()).not.toContain('available');
	});
});

function rows(n: number): Listing[] {
	return Array.from({ length: n }, (_, i) =>
		listing({ id: `SAMPLE-74201-R${100 + i}`, addressLine1: `${i + 1} Fictional Ln` })
	);
}

function fakeSearch(over: Partial<Record<keyof RenterSearch, unknown>>): RenterSearch {
	const all = (over.rows as Listing[] | undefined) ?? [];
	return {
		rows: all,
		filtered: all,
		sorted: all,
		shownCount: 24,
		status: 'ready',
		provenance: SAMPLE,
		newIds: new Set<string>(),
		selectedListingId: null,
		hoveredListingId: null,
		locationText: '74201',
		hover() {},
		showMore() {},
		clearFilters() {},
		...over
	} as unknown as RenterSearch;
}

describe('ResultsList', () => {
	it('renders 24 cards, the count line and Show 24 more when more than 48 remain', () => {
		const h = html(
			render(ResultsList, { props: { search: fakeSearch({ rows: rows(60) }), now: NOW } }).body
		);
		expect(h.match(/<article/g)).toHaveLength(24);
		expect(text(h)).toContain('Showing 24 of 60');
		expect(text(h)).toContain('Show 24 more');
	});

	it('names the real remainder on the last page and hides paging for one page', () => {
		const last = text(
			html(
				render(ResultsList, {
					props: { search: fakeSearch({ rows: rows(30), shownCount: 24 }), now: NOW }
				}).body
			)
		);
		expect(last).toContain('Showing 24 of 30');
		expect(last).toContain('Show 6 more');

		const one = html(
			render(ResultsList, { props: { search: fakeSearch({ rows: rows(10) }), now: NOW } }).body
		);
		expect(one.match(/<article/g)).toHaveLength(10);
		expect(text(one)).not.toContain('Showing');
		expect(text(one)).not.toMatch(/Show \d+ more/);
	});

	it('marks new ids with the New badge', () => {
		const r = rows(3);
		const h = html(
			render(ResultsList, {
				props: { search: fakeSearch({ rows: r, newIds: new Set([r[1].id]) }), now: NOW }
			}).body
		);
		expect(h.match(/data-new-badge/g)).toHaveLength(1);
	});
});

describe('FilteredEmptyState', () => {
	it('explains that filters hide every row and clearing is free', () => {
		const h = html(
			render(FilteredEmptyState, {
				props: { search: fakeSearch({ rows: rows(12), filtered: [] }) }
			}).body
		);
		expect(h).toMatch(/<h3[^>]*>\s*No rentals match these filters\s*<\/h3>/);
		expect(text(h)).toContain(
			'12 rentals in 74201 are hidden by your filters. Clearing them costs nothing.'
		);
		expect(text(h)).toContain('Clear filters');
	});

	it('renders nothing while rows remain visible or before any rows', () => {
		const visible = render(FilteredEmptyState, {
			props: { search: fakeSearch({ rows: rows(3) }) }
		}).body;
		expect(text(html(visible))).toBe('');
		const none = render(FilteredEmptyState, {
			props: { search: fakeSearch({ rows: [], filtered: [] }) }
		}).body;
		expect(text(html(none))).toBe('');
	});
});
