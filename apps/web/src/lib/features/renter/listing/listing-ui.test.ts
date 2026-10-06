// SSR structural tests for the listing detail pieces (06-14, RENT-03): the nine facts with "Not
// listed", contact rows built only from safe hrefs, the empty contact state, the not-found
// variants and the address lines. svelte/server renders to a string; no network, no storage.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { Listing } from '@tran/core/listings';
import { placeLine, streetLine } from './address';
import { historyEvents } from '@tran/core/renter/history';
import { toRawHistory } from './history';
import ListingContact from './ListingContact.svelte';
import ListingFacts from './ListingFacts.svelte';
import ListingNotFound from './ListingNotFound.svelte';
import SearchElsewhere from './SearchElsewhere.svelte';

const NOW = new Date('2026-10-05T12:00:00.000Z');
const LIVE = { source: 'rentcast' as const, fetchedAt: NOW.getTime(), stale: false };
const SAMPLE = { source: 'sample' as const, fetchedAt: NOW.getTime(), stale: false };

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
		hoaFee: 120,
		price: 1650,
		status: 'Active',
		listingType: null,
		listedDate: '2026-09-28T00:00:00.000Z',
		removedDate: null,
		lastSeenDate: '2026-10-02T00:00:00.000Z',
		daysOnMarket: 7,
		mlsName: null,
		mlsNumber: null,
		agent: {
			name: 'Avery Example',
			phone: '(580) 555-0132',
			email: 'avery@example.com',
			website: 'example.com/avery'
		},
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
const hrefs = (h: string) => [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe('address lines', () => {
	it('builds the street line from line 1 and the unit line', () => {
		expect(streetLine(listing())).toBe('12 Fictional Ln');
		expect(streetLine(listing({ addressLine2: 'Apt 4B' }))).toBe('12 Fictional Ln, Apt 4B');
		expect(streetLine(listing({ addressLine1: null }))).toBe('12 Fictional Ln');
		expect(placeLine(listing())).toBe('Harlow Springs, OK 74201');
		expect(placeLine(listing({ city: null }))).toBe('OK 74201');
	});
});

describe('toRawHistory', () => {
	it('rebuilds the date-keyed history with removedDate, so Delisted and Relisted show', () => {
		const raw = toRawHistory([
			{ date: '2026-07-01', event: 'Rental Listing', price: 1600, removedDate: '2026-07-20' },
			{ date: '2026-08-15', event: 'Rental Listing', price: 1550, removedDate: null },
			{ date: '2026-09-01', event: 'Rental Listing', price: 1500 }
		]);
		expect(raw).toEqual({
			'2026-07-01': { event: 'Rental Listing', price: 1600, removedDate: '2026-07-20' },
			'2026-08-15': { event: 'Rental Listing', price: 1550, removedDate: null },
			'2026-09-01': { event: 'Rental Listing', price: 1500, removedDate: null }
		});
		expect(historyEvents(raw).map((e) => e.kind)).toEqual([
			'rent-changed',
			'relisted',
			'delisted',
			'listed'
		]);
	});
});

describe('ListingFacts', () => {
	it('lists all nine facts in order with formatted values', () => {
		const h = html(render(ListingFacts, { props: { row: listing(), now: NOW } }).body);
		const terms = [...h.matchAll(/<dt\b[^>]*>([^<]*)<\/dt>/g)].map((m) => m[1]);
		expect(terms).toEqual([
			'Bedrooms',
			'Bathrooms',
			'Square feet',
			'Property type',
			'Year built',
			'HOA fee',
			'Days on market',
			'Listed on',
			'Last seen listed'
		]);
		const values = [...h.matchAll(/<dd\b[^>]*>([^<]*)<\/dd>/g)].map((m) => m[1]);
		expect(values).toEqual([
			'2',
			'1.5',
			'1,050',
			'Condo',
			'1998',
			'$120 a month',
			'7',
			'Sep 28, 2026',
			'3 days ago'
		]);
	});

	it('keeps every item and says "Not listed" for missing values (never 0)', () => {
		const row = listing({
			bedrooms: null,
			bathrooms: null,
			squareFootage: null,
			yearBuilt: null,
			hoaFee: null,
			daysOnMarket: null,
			listedDate: null,
			lastSeenDate: null
		});
		const h = html(render(ListingFacts, { props: { row, now: NOW } }).body);
		expect(h.match(/<dt\b/g)).toHaveLength(9);
		expect(h.match(/>Not listed</g)).toHaveLength(8);
		expect(text(h)).not.toMatch(/\b0\b/);
	});

	it('reads 0 bedrooms as Studio', () => {
		const h = html(
			render(ListingFacts, { props: { row: listing({ bedrooms: 0 }), now: NOW } }).body
		);
		expect(h).toContain('>Studio<');
	});
});

describe('ListingContact', () => {
	it('renders call, email and website rows from safe hrefs only', () => {
		const h = html(render(ListingContact, { props: { row: listing(), provenance: LIVE } }).body);
		expect(hrefs(h)).toEqual([
			'tel:+15805550132',
			'mailto:avery@example.com',
			'https://example.com/avery'
		]);
		const t = text(h);
		expect(t).toContain('Call (580) 555-0132');
		expect(t).toContain('Email avery@example.com');
		expect(t).toContain('Visit website (opens external site)');
		expect(t).toContain("Tran doesn't contact anyone for you. These open your phone or email app.");
		expect(h).toContain('rel="noopener noreferrer external"');
		expect(h).not.toContain('data-provenance-chip');
	});

	it('drops every unsafe value and falls back to the office when the agent value fails', () => {
		const row = listing({
			agent: {
				name: 'Avery Example',
				phone: 'javascript:5805550132',
				email: 'x@y.com?body=hi',
				website: 'javascript:alert(1)'
			},
			office: {
				name: 'Sample Realty',
				phone: '580-555-0133',
				email: null,
				website: 'data:text/html,hi'
			}
		});
		const h = html(render(ListingContact, { props: { row, provenance: LIVE } }).body);
		expect(hrefs(h)).toEqual(['tel:+15805550133']);
		expect(h).not.toContain('javascript:');
		expect(h).not.toContain('data:text');
		expect(text(h)).toContain('Sample Realty');
	});

	it('shows the empty copy when RentCast gave no usable contact, and the sample chip on samples', () => {
		const row = listing({ agent: null, office: null });
		const h = html(render(ListingContact, { props: { row, provenance: SAMPLE } }).body);
		expect(hrefs(h)).toEqual([]);
		expect(text(h)).toContain(
			"RentCast didn't include contact details for this listing. Look it up elsewhere to find who's renting it."
		);
		expect(h).toContain('data-provenance="sample"');
		expect(h).toContain('data-provenance-chip="sample"');
	});
});

describe('SearchElsewhere', () => {
	it('offers three plain search links for the full address', () => {
		const h = html(
			render(SearchElsewhere, { props: { fullAddress: '12 Fictional Ln, Harlow Springs, OK' } })
				.body
		);
		expect(hrefs(h).map((u) => new URL(u).host)).toEqual([
			'www.google.com',
			'www.zillow.com',
			'www.google.com'
		]);
		const t = text(h);
		for (const label of ['Search Google', 'Search Zillow', 'Search Apartments.com']) {
			expect(t).toContain(`${label} (opens external site)`);
		}
	});
});

describe('ListingNotFound', () => {
	const base = { canFetch: false, estimate: null, onLookUp: async () => {} };

	it('missing id: the "doesn\'t point to a listing" body and no paid lookup', () => {
		const t = text(
			html(render(ListingNotFound, { props: { ...base, variant: 'missing-id' } }).body)
		);
		expect(t).toContain('Listing not found');
		expect(t).toContain("This link doesn't point to a listing. Search again to find it.");
		expect(t).toContain('Back to search');
		expect(t).not.toContain('Look it up again');
	});

	it('not found and fetchable: the cost is shown in the button name before any spend', () => {
		const t = text(
			html(
				render(ListingNotFound, {
					props: {
						...base,
						variant: 'not-found',
						canFetch: true,
						estimate: { calls: 1, reason: 'network' }
					}
				}).body
			)
		);
		expect(t).toContain("This listing isn't saved in this browser.");
		expect(t).toContain('Look it up again (1 call)');
	});
});
