import { describe, expect, test } from 'vitest';

import {
	MAX_NOTES,
	MAX_SAVED_SEARCHES,
	NOTES_PREVIEW,
	RENTER_SORT_IDS,
	SHORTLIST_STATUSES,
	STATUS_LABELS,
	canSaveAnother,
	changeStatus,
	groupByStatus,
	needsRemoveConfirm,
	notesPreview,
	renterSearchMetaSchema,
	shortlistItemSchema,
	shortlistSummary,
	type ShortlistItem,
	type ShortlistStatus
} from './records.js';

// 06-07 owns sort.ts and runs in the same wave. Resolve it at runtime (variable specifier) so this
// file compiles and runs whether or not it has merged yet.
const SORT_SPEC = './sort.js';
const sortModule: Record<string, unknown> | null = await import(/* @vite-ignore */ SORT_SPEC).catch(
	() => null
);

const ISO = '2026-10-05T12:00:00.000Z';
const syncable = (id = '6f1c2b1e-4b8a-4d0e-9a51-3c7d2e8f4a10') => ({
	id,
	ownerId: 'local' as const,
	createdAt: ISO,
	updatedAt: ISO,
	schemaVersion: 1
});

let seq = 0;
function item(over: Partial<ShortlistItem> = {}): ShortlistItem {
	seq += 1;
	const n = String(seq).padStart(12, '0');
	return {
		...syncable(`6f1c2b1e-4b8a-4d0e-9a51-${n}`),
		listingId: `123-Main-St,-Tulsa,-OK-74201-${seq}`,
		listing: { id: `listing-${seq}`, price: 1450 },
		provenance: { source: 'rentcast', fetchedAt: 1000 },
		status: 'saved',
		statusChangedAt: 1000,
		statusHistory: [{ status: 'saved', at: 1000 }],
		notes: '',
		...over
	};
}

describe('statuses and constants', () => {
	test('five statuses in pipeline order with UI labels', () => {
		expect(SHORTLIST_STATUSES).toEqual(['saved', 'contacted', 'toured', 'applied', 'signed']);
		expect(STATUS_LABELS).toEqual({
			saved: 'Saved',
			contacted: 'Contacted',
			toured: 'Toured',
			applied: 'Applied',
			signed: 'Signed'
		});
	});

	test('limits', () => {
		expect(MAX_NOTES).toBe(2000);
		expect(NOTES_PREVIEW).toBe(120);
		expect(MAX_SAVED_SEARCHES).toBe(10);
	});
});

describe('shortlistItemSchema', () => {
	test('accepts a full item', () => {
		const ok = shortlistItemSchema.safeParse(item({ notes: 'Call after 5pm' }));
		expect(ok.success).toBe(true);
	});

	test('accepts every status', () => {
		for (const status of SHORTLIST_STATUSES) {
			expect(shortlistItemSchema.safeParse(item({ status })).success).toBe(true);
		}
	});

	test('accepts a tombstoned item (ISO deletedAt)', () => {
		expect(shortlistItemSchema.safeParse(item({ deletedAt: ISO })).success).toBe(true);
	});

	test('rejects deletedAt null (Phase 3 backup rule: omit on live rows)', () => {
		const bad = { ...item(), deletedAt: null };
		expect(shortlistItemSchema.safeParse(bad).success).toBe(false);
	});

	test('rejects an unknown status', () => {
		const bad = { ...item(), status: 'rejected' };
		expect(shortlistItemSchema.safeParse(bad).success).toBe(false);
	});

	test('rejects an unknown status inside the history', () => {
		const bad = { ...item(), statusHistory: [{ status: 'viewed', at: 1 }] };
		expect(shortlistItemSchema.safeParse(bad).success).toBe(false);
	});

	test('notes: 2,000 chars accepted, 2,001 rejected', () => {
		expect(shortlistItemSchema.safeParse(item({ notes: 'a'.repeat(2000) })).success).toBe(true);
		expect(shortlistItemSchema.safeParse(item({ notes: 'a'.repeat(2001) })).success).toBe(false);
	});

	test('rejects a missing or empty listingId', () => {
		const { listingId: _drop, ...missing } = item();
		expect(shortlistItemSchema.safeParse(missing).success).toBe(false);
		expect(shortlistItemSchema.safeParse(item({ listingId: '' })).success).toBe(false);
	});

	test("rejects provenance.source 'other'", () => {
		const bad = { ...item(), provenance: { source: 'other', fetchedAt: 1 } };
		expect(shortlistItemSchema.safeParse(bad).success).toBe(false);
	});

	test("accepts provenance.source 'sample'", () => {
		const ok = item({ provenance: { source: 'sample', fetchedAt: 1 } });
		expect(shortlistItemSchema.safeParse(ok).success).toBe(true);
	});

	test('rejects missing Syncable fields', () => {
		const { createdAt: _drop, ...bad } = item();
		expect(shortlistItemSchema.safeParse(bad).success).toBe(false);
	});

	test('the listing snapshot keeps unknown keys (history, listingAgent, listingOffice)', () => {
		const snapshot = {
			id: 'abc',
			price: null,
			history: { '2026-09-01': { event: 'Rental Listing', price: 1500 } },
			listingAgent: { name: 'Pat Example', phone: '5550100' },
			listingOffice: { name: 'Example Realty' }
		};
		const parsed = shortlistItemSchema.parse(item({ listing: snapshot }));
		expect(parsed.listing).toEqual(snapshot);
		expect(parsed.listing.listingAgent).toEqual({ name: 'Pat Example', phone: '5550100' });
	});

	test('rejects a listing snapshot without id or with a string price', () => {
		expect(shortlistItemSchema.safeParse({ ...item(), listing: { price: 1 } }).success).toBe(false);
		expect(
			shortlistItemSchema.safeParse({ ...item(), listing: { id: 'x', price: '1' } }).success
		).toBe(false);
	});
});

describe('changeStatus', () => {
	test('moves to a new status, stamps times and appends history', () => {
		const before = item();
		const snapshot = structuredClone(before);
		const after = changeStatus(before, 'toured', 5000);
		expect(after).not.toBe(before);
		expect(after.status).toBe('toured');
		expect(after.statusChangedAt).toBe(5000);
		expect(after.updatedAt).toBe(new Date(5000).toISOString());
		expect(after.statusHistory).toEqual([
			{ status: 'saved', at: 1000 },
			{ status: 'toured', at: 5000 }
		]);
		// input not mutated (including its history array)
		expect(before).toEqual(snapshot);
		expect(after.statusHistory).not.toBe(before.statusHistory);
	});

	test('the result still validates', () => {
		expect(shortlistItemSchema.safeParse(changeStatus(item(), 'signed', 9000)).success).toBe(true);
	});

	test('same status returns the item unchanged (no history entry)', () => {
		const before = item({ status: 'contacted' });
		const after = changeStatus(before, 'contacted', 5000);
		expect(after).toBe(before);
		expect(after.statusHistory).toHaveLength(1);
		expect(after.updatedAt).toBe(ISO);
	});

	test('moving backwards is allowed (renters correct mistakes)', () => {
		const after = changeStatus(item({ status: 'applied' }), 'contacted', 7000);
		expect(after.status).toBe('contacted');
		expect(after.statusHistory.at(-1)).toEqual({ status: 'contacted', at: 7000 });
	});
});

describe('needsRemoveConfirm', () => {
	test('saved with no notes: no confirm', () => {
		expect(needsRemoveConfirm({ status: 'saved', notes: '' })).toBe(false);
	});
	test('whitespace-only notes do not count', () => {
		expect(needsRemoveConfirm({ status: 'saved', notes: ' \n\t ' })).toBe(false);
	});
	test('saved with notes: confirm', () => {
		expect(needsRemoveConfirm({ status: 'saved', notes: '  x ' })).toBe(true);
	});
	test('every status past saved: confirm', () => {
		for (const status of SHORTLIST_STATUSES.filter((s) => s !== 'saved')) {
			expect(needsRemoveConfirm({ status, notes: '' })).toBe(true);
		}
	});
});

describe('shortlistSummary', () => {
	test('empty', () => {
		expect(shortlistSummary([])).toEqual({ total: 0, contacted: 0, applied: 0 });
	});

	test('counts non-deleted items by pipeline stage', () => {
		const statuses: ShortlistStatus[] = [
			'saved',
			'saved',
			'contacted',
			'toured',
			'applied',
			'signed'
		];
		const items = statuses.map((status) => item({ status }));
		items.push(item({ status: 'signed', deletedAt: ISO }));
		items.push(item({ status: 'contacted', deletedAt: ISO }));
		items.push(item({ status: 'saved', deletedAt: ISO }));
		expect(shortlistSummary(items)).toEqual({ total: 6, contacted: 4, applied: 2 });
	});

	test('each status maps to the right buckets', () => {
		const one = (status: ShortlistStatus) => shortlistSummary([item({ status })]);
		expect(one('saved')).toEqual({ total: 1, contacted: 0, applied: 0 });
		expect(one('contacted')).toEqual({ total: 1, contacted: 1, applied: 0 });
		expect(one('toured')).toEqual({ total: 1, contacted: 1, applied: 0 });
		expect(one('applied')).toEqual({ total: 1, contacted: 1, applied: 1 });
		expect(one('signed')).toEqual({ total: 1, contacted: 1, applied: 1 });
	});
});

describe('groupByStatus', () => {
	test('returns all five keys even when empty', () => {
		const groups = groupByStatus([]);
		expect(Object.keys(groups)).toEqual([...SHORTLIST_STATUSES]);
		for (const s of SHORTLIST_STATUSES) expect(groups[s]).toEqual([]);
	});

	test('non-deleted only, sorted by statusChangedAt desc then listingId', () => {
		const a = item({ status: 'toured', statusChangedAt: 100, listingId: 'b' });
		const b = item({ status: 'toured', statusChangedAt: 300, listingId: 'z' });
		const c = item({ status: 'toured', statusChangedAt: 100, listingId: 'a' });
		const gone = item({ status: 'toured', statusChangedAt: 999, deletedAt: ISO });
		const s = item({ status: 'saved', statusChangedAt: 1 });
		const groups = groupByStatus([a, gone, s, b, c]);
		expect(groups.toured.map((i) => i.listingId)).toEqual(['z', 'a', 'b']);
		expect(groups.saved).toEqual([s]);
		expect(groups.contacted).toEqual([]);
		expect(groups.applied).toEqual([]);
		expect(groups.signed).toEqual([]);
	});

	test('does not reorder the input array', () => {
		const input = [item({ statusChangedAt: 1 }), item({ statusChangedAt: 2 })];
		const ids = input.map((i) => i.id);
		groupByStatus(input);
		expect(input.map((i) => i.id)).toEqual(ids);
	});
});

describe('notesPreview', () => {
	test('long notes: first 120 characters plus an ellipsis', () => {
		const out = notesPreview('a'.repeat(130));
		expect(out).toBe('a'.repeat(120) + '…');
		expect(out).toHaveLength(121);
	});
	test('exactly 120 characters unchanged', () => {
		expect(notesPreview('b'.repeat(120))).toBe('b'.repeat(120));
	});
	test('short notes unchanged', () => {
		expect(notesPreview('Ask about parking')).toBe('Ask about parking');
		expect(notesPreview('')).toBe('');
	});
});

describe('renterSearchMetaSchema', () => {
	const filters = {
		priceMin: 900,
		priceMax: 1800,
		beds: 2 as const,
		types: ['Apartment' as const, 'Condo' as const],
		listedWithin: 14 as const
	};
	const meta = (over: Record<string, unknown> = {}) => ({
		...syncable(),
		location: { kind: 'zip', zipCode: '74201' },
		filters,
		sort: 'newest',
		...over
	});

	test('accepts a zip search', () => {
		expect(renterSearchMetaSchema.safeParse(meta()).success).toBe(true);
	});

	test('accepts a city search with default filters', () => {
		const ok = meta({
			location: { kind: 'city', city: 'Tulsa', state: 'OK' },
			filters: { priceMin: null, priceMax: null, beds: 'any', types: [], listedWithin: 'any' },
			sort: 'rent-asc'
		});
		expect(renterSearchMetaSchema.safeParse(ok).success).toBe(true);
	});

	test('accepts every beds, listedWithin and sort value', () => {
		for (const beds of ['any', 0, 1, 2, 3, '4+']) {
			expect(
				renterSearchMetaSchema.safeParse(meta({ filters: { ...filters, beds } })).success
			).toBe(true);
		}
		for (const listedWithin of ['any', 7, 14, 30, 60]) {
			expect(
				renterSearchMetaSchema.safeParse(meta({ filters: { ...filters, listedWithin } })).success
			).toBe(true);
		}
		for (const sort of RENTER_SORT_IDS) {
			expect(renterSearchMetaSchema.safeParse(meta({ sort })).success).toBe(true);
		}
	});

	test.each([
		['beds 9', { filters: { ...filters, beds: 9 } }],
		['beds "4"', { filters: { ...filters, beds: '4' } }],
		["types ['Land']", { filters: { ...filters, types: ['Land'] } }],
		['listedWithin 5', { filters: { ...filters, listedWithin: 5 } }],
		['priceMin -1', { filters: { ...filters, priceMin: -1 } }],
		['priceMax 1.5', { filters: { ...filters, priceMax: 1.5 } }],
		["zip '7420'", { location: { kind: 'zip', zipCode: '7420' } }],
		["zip '742011'", { location: { kind: 'zip', zipCode: '742011' } }],
		["state 'ok'", { location: { kind: 'city', city: 'Tulsa', state: 'ok' } }],
		['empty city', { location: { kind: 'city', city: '', state: 'OK' } }],
		["sort 'price'", { sort: 'price' }],
		['deletedAt null', { deletedAt: null }]
	])('rejects %s', (_label, over) => {
		expect(renterSearchMetaSchema.safeParse(meta(over)).success).toBe(false);
	});

	test('rejects missing Syncable fields', () => {
		const { id: _drop, ...bad } = meta();
		expect(renterSearchMetaSchema.safeParse(bad).success).toBe(false);
	});
});

describe('saved-search limit', () => {
	test('canSaveAnother is true below 10, false at or above', () => {
		expect(canSaveAnother(0)).toBe(true);
		expect(canSaveAnother(9)).toBe(true);
		expect(canSaveAnother(10)).toBe(false);
		expect(canSaveAnother(11)).toBe(false);
	});
});

describe('sort ids match 06-07 sort.ts', () => {
	test.skipIf(!sortModule)('RENTER_SORT_IDS equals the sort module ids', () => {
		const ids =
			(sortModule?.SORT_IDS as readonly string[] | undefined) ??
			(sortModule?.SORT_OPTIONS as readonly { id: string }[] | undefined)?.map((o) => o.id);
		expect(ids).toBeDefined();
		expect([...(ids ?? [])]).toEqual([...RENTER_SORT_IDS]);
	});
});
