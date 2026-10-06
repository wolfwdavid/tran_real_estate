// SSR structural tests for the shortlist board (06-15, RENT-05). svelte/server renders to a string
// with a stub repo, so nothing touches IndexedDB or the network. Behaviour (status moves, notes,
// removal focus, persistence) is proven end to end in renter-shortlist.spec.ts.
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { ShortlistItem, ShortlistStatus } from '@tran/core/renter/records';

const repo = vi.hoisted(() => ({
	remove: vi.fn(),
	setStatus: vi.fn(),
	setNotes: vi.fn(),
	liveAll: vi.fn(async () => []),
	getByListingId: vi.fn(),
	count: vi.fn(),
	liveCount: vi.fn()
}));
vi.mock('../storage/shortlist-repo', () => ({ getShortlistRepo: () => repo }));

const { default: ShortlistBoard } = await import('./ShortlistBoard.svelte');
const { default: ShortlistCard } = await import('./ShortlistCard.svelte');

const AT = Date.parse('2026-10-02T15:00:00.000Z');

function item(
	listingId: string,
	overrides: Partial<ShortlistItem> = {},
	listing: Record<string, unknown> = {}
): ShortlistItem {
	const status: ShortlistStatus = overrides.status ?? 'saved';
	return {
		id: `uuid-${listingId}`,
		ownerId: 'local',
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		schemaVersion: 1,
		listingId,
		listing: {
			id: listingId,
			price: 1650,
			formattedAddress: '12 Fictional Ln, Harlow Springs, OK 74201',
			addressLine1: '12 Fictional Ln',
			addressLine2: null,
			city: 'Harlow Springs',
			state: 'OK',
			zipCode: '74201',
			propertyType: 'Condo',
			bedrooms: 2,
			bathrooms: 1.5,
			squareFootage: 1050,
			status: 'Active',
			lastSeenDate: new Date().toISOString(),
			removedDate: null,
			...listing
		},
		provenance: { source: 'sample', fetchedAt: AT },
		status,
		statusChangedAt: AT,
		statusHistory: [{ status, at: AT }],
		notes: '',
		...overrides
	};
}

const html = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '');
const text = (h: string) =>
	h
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

describe('ShortlistBoard', () => {
	it('renders nothing before the first query result (no flash of the empty state)', () => {
		const h = html(render(ShortlistBoard, { props: {} }).body);
		expect(text(h)).toBe('');
	});

	it('shows the empty state with a Search rentals link to /renter/', () => {
		const h = html(render(ShortlistBoard, { props: { items: [] } }).body);
		const t = text(h);
		expect(t).toContain('Your shortlist is empty');
		expect(t).toContain(
			'Save listings from your search results to compare them and track where each one stands.'
		);
		expect(h).toMatch(/<a[^>]*href="\/renter\/"[^>]*>[\s\S]*Search rentals/);
	});

	it('summarises the shortlist and renders one card per live item', () => {
		const items = [
			item('A-1'),
			item('A-2', { status: 'toured' }),
			item('A-3', { status: 'applied' })
		];
		const h = html(render(ShortlistBoard, { props: { items } }).body);
		expect(text(h)).toContain('3 listings · 2 contacted · 1 applied');
		expect(h.match(/<article\b/g)).toHaveLength(3);
		expect(text(h)).not.toContain('Your shortlist is empty');
	});
	it('renders five status sections in pipeline order with counts and empty lines', () => {
		const items = [
			item('S-1'),
			item('S-2', { status: 'toured' }),
			item('S-3', { status: 'toured' })
		];
		const h = html(render(ShortlistBoard, { props: { items } }).body);
		const headings = [...h.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]));
		expect(headings).toEqual([
			'Saved (1)',
			'Contacted (0)',
			'Toured (2)',
			'Applied (0)',
			'Signed (0)'
		]);
		expect(h.match(/Nothing here yet\./g)).toHaveLength(3);
		expect(h).toContain('xl:grid-cols-5');
		expect(h.match(/<h2\b[^>]*tabindex="-1"/g)).toHaveLength(5);
	});
});

describe('ShortlistCard', () => {
	it('uses item- plus the encoded listing id as the article id, labelled by the address link', () => {
		const id = 'SAMPLE 74201/R#1';
		const h = html(render(ShortlistCard, { props: { item: item(id) } }).body);
		const enc = encodeURIComponent(id);
		expect(h).toContain(`id="item-${enc}"`);
		expect(h).toContain(`aria-labelledby="item-title-${enc}"`);
		expect(h).toMatch(
			new RegExp(
				`<a[^>]*id="item-title-${enc}"[^>]*href="/renter/listing/\\?id=${encodeURIComponent(id).replace(/%20/g, '\\+')}"`
			)
		);
	});

	it('shows rent, facts, the address and the Saved meta line from the snapshot', () => {
		const t = text(html(render(ShortlistCard, { props: { item: item('B-1') } }).body));
		expect(t).toContain('$1,650 a month');
		expect(t).toContain('2 bd · 1.5 ba · 1,050 sq ft');
		expect(t).toContain('12 Fictional Ln');
		expect(t).toContain('Saved Oct 2');
	});

	it('reads Studio for 0 bedrooms and omits missing facts', () => {
		const t = text(
			html(
				render(ShortlistCard, {
					props: { item: item('B-2', {}, { bedrooms: 0, bathrooms: null, squareFootage: null }) }
				}).body
			)
		);
		expect(t).toContain('Studio');
		expect(t).not.toMatch(/\bba\b|sq ft/);
	});

	it('previews long notes at 120 characters plus an ellipsis, with Edit notes', () => {
		const notes = 'n'.repeat(130);
		const t = text(html(render(ShortlistCard, { props: { item: item('C-1', { notes }) } }).body));
		expect(t).toContain('n'.repeat(120) + '…');
		expect(t).not.toContain('n'.repeat(121));
		expect(t).toContain('Edit notes');
		expect(t).not.toContain('Add notes');
	});

	it('offers Add notes when there are none', () => {
		const t = text(html(render(ShortlistCard, { props: { item: item('C-2') } }).body));
		expect(t).toContain('Add notes');
	});

	it('keeps the Sample data chip on a sample snapshot, and none on a RentCast one', () => {
		const sample = html(render(ShortlistCard, { props: { item: item('D-1') } }).body);
		expect(sample).toContain('data-provenance="sample"');
		expect(text(sample)).toContain('Sample data');

		const live = html(
			render(ShortlistCard, {
				props: { item: item('D-2', { provenance: { source: 'rentcast', fetchedAt: AT } }) }
			}).body
		);
		expect(text(live)).not.toContain('Sample data');
	});

	it('has a labelled native Status select with the five statuses, and a badge with text', () => {
		const h = html(
			render(ShortlistCard, { props: { item: item('F-1', { status: 'applied' }) } }).body
		);
		const enc = encodeURIComponent('F-1');
		expect(h).toMatch(new RegExp(`<label[^>]*for="status-${enc}"[^>]*>Status</label>`));
		expect(h).toMatch(new RegExp(`<select[^>]*id="status-${enc}"`));
		const options = [...h.matchAll(/<option\b[^>]*>([^<]*)<\/option>/g)].map((m) => m[1].trim());
		expect(options).toEqual(['Saved', 'Contacted', 'Toured', 'Applied', 'Signed']);
		expect(h).toMatch(/<option[^>]*value="applied"[^>]*selected/);
		const badge = /<span[^>]*data-status-badge="applied"[^>]*>([\s\S]*?)<\/span>/.exec(h);
		expect(badge && text(badge[1])).toBe('Applied');
		expect(badge?.[1]).toContain('<svg');
	});

	it('names the remove button after the street line', () => {
		const h = html(render(ShortlistCard, { props: { item: item('E-1') } }).body);
		expect(h).toContain('aria-label="Remove 12 Fictional Ln from shortlist"');
	});
});
