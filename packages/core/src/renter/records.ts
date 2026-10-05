// Renter record schemas and pure record logic (RENT-04 saved searches, RENT-05 shortlist).
//
// Both record kinds are persisted to Dexie by the web layer and travel through Phase 3 backups,
// so each schema extends the shared SyncableSchema: uuid id, ISO createdAt/updatedAt,
// schemaVersion, and an OPTIONAL ISO deletedAt (omitted on live rows; null is rejected).
//
// Saved searches: Phase 4 owns the saved-search row (name, endpoint, wide server params,
// lastRunAt/lastSeenAt, claims) and its snapshot. A renter search keeps its location, local
// filters and sort in a companion "search meta" row with the SAME id as the Phase 4 row, so the
// backup merge-by-id lines both up. This module only defines that companion shape and the
// 10-search limit.
//
// Time convention: Syncable timestamps are ISO strings (backup merge compares them as strings);
// domain times (statusChangedAt, statusHistory[].at, provenance.fetchedAt) are epoch ms, matching
// Phase 4's lastRunAt/fetchedAt.
import * as z from 'zod/mini';

import { SyncableSchema } from '../syncable.js';
import { LISTED_WITHIN, RENTER_PROPERTY_TYPES } from './types.js';

export const SHORTLIST_STATUSES = ['saved', 'contacted', 'toured', 'applied', 'signed'] as const;
export type ShortlistStatus = (typeof SHORTLIST_STATUSES)[number];

export const STATUS_LABELS: Readonly<Record<ShortlistStatus, string>> = Object.freeze({
	saved: 'Saved',
	contacted: 'Contacted',
	toured: 'Toured',
	applied: 'Applied',
	signed: 'Signed'
});

export const MAX_NOTES = 2000;
export const NOTES_PREVIEW = 120;
export const MAX_SAVED_SEARCHES = 10;

/** Must equal the ids of 06-07's SORT_OPTIONS (sort.ts); records.test.ts asserts it. */
export const RENTER_SORT_IDS = ['newest', 'rent-asc', 'rent-desc', 'beds', 'size', 'dom'] as const;
export type RenterSortId = (typeof RENTER_SORT_IDS)[number];

const statusSchema = z.enum(SHORTLIST_STATUSES);

/** Normalized listing row at save time. Unknown keys (history, listingAgent, ...) are kept. */
const listingSnapshotSchema = z.looseObject({
	id: z.string(),
	price: z.nullable(z.number())
});

export const shortlistItemSchema = z.extend(SyncableSchema, {
	listingId: z.string().check(z.minLength(1)),
	listing: listingSnapshotSchema,
	provenance: z.object({
		source: z.enum(['rentcast', 'sample']),
		fetchedAt: z.number()
	}),
	status: statusSchema,
	statusChangedAt: z.number(),
	statusHistory: z.array(z.object({ status: statusSchema, at: z.number() })),
	notes: z.string().check(z.maxLength(MAX_NOTES))
});
export type ShortlistItem = z.infer<typeof shortlistItemSchema>;

const priceSchema = z.nullable(z.number().check(z.int(), z.nonnegative()));

const renterLocationSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('zip'), zipCode: z.string().check(z.regex(/^\d{5}$/)) }),
	z.object({
		kind: z.literal('city'),
		city: z.string().check(z.trim(), z.minLength(1)),
		state: z.string().check(z.regex(/^[A-Z]{2}$/))
	})
]);

const rentalFiltersSchema = z.object({
	priceMin: priceSchema,
	priceMax: priceSchema,
	beds: z.union([z.literal('any'), z.literal([0, 1, 2, 3]), z.literal('4+')]),
	types: z.array(z.enum(RENTER_PROPERTY_TYPES)),
	listedWithin: z.union([z.literal('any'), z.literal(LISTED_WITHIN)])
});

export const renterSearchMetaSchema = z.extend(SyncableSchema, {
	location: renterLocationSchema,
	filters: rentalFiltersSchema,
	sort: z.enum(RENTER_SORT_IDS)
});
export type RenterSearchMeta = z.infer<typeof renterSearchMetaSchema>;

const isLive = (i: ShortlistItem) => i.deletedAt === undefined;

/**
 * Moves an item to `status` at `now` (epoch ms): stamps statusChangedAt and updatedAt and appends
 * one history entry. The same status returns the input itself (no history entry, no write).
 * Any status may follow any other, so a renter can correct a mistaken move.
 */
export function changeStatus(
	item: ShortlistItem,
	status: ShortlistStatus,
	now: number
): ShortlistItem {
	if (item.status === status) return item;
	return {
		...item,
		status,
		statusChangedAt: now,
		updatedAt: new Date(now).toISOString(),
		statusHistory: [...item.statusHistory, { status, at: now }]
	};
}

/** Removing asks first only when something would be lost: notes or progress past Saved. */
export function needsRemoveConfirm(item: Pick<ShortlistItem, 'status' | 'notes'>): boolean {
	return item.status !== 'saved' || item.notes.trim() !== '';
}

const CONTACTED_OR_LATER: ReadonlySet<ShortlistStatus> = new Set([
	'contacted',
	'toured',
	'applied',
	'signed'
]);
const APPLIED_OR_LATER: ReadonlySet<ShortlistStatus> = new Set(['applied', 'signed']);

/** Counts for "{n} listings · {c} contacted · {a} applied" (tombstones excluded). */
export function shortlistSummary(items: readonly ShortlistItem[]): {
	total: number;
	contacted: number;
	applied: number;
} {
	let total = 0;
	let contacted = 0;
	let applied = 0;
	for (const i of items) {
		if (!isLive(i)) continue;
		total += 1;
		if (CONTACTED_OR_LATER.has(i.status)) contacted += 1;
		if (APPLIED_OR_LATER.has(i.status)) applied += 1;
	}
	return { total, contacted, applied };
}

/**
 * Live items per status (all five keys, pipeline order), each newest status change first, ties
 * by listingId. The input array is not reordered.
 */
export function groupByStatus(
	items: readonly ShortlistItem[]
): Record<ShortlistStatus, ShortlistItem[]> {
	const groups = Object.fromEntries(
		SHORTLIST_STATUSES.map((s) => [s, [] as ShortlistItem[]])
	) as Record<ShortlistStatus, ShortlistItem[]>;
	for (const i of items) if (isLive(i)) groups[i.status].push(i);
	for (const s of SHORTLIST_STATUSES) {
		groups[s].sort(
			(a, b) =>
				b.statusChangedAt - a.statusChangedAt ||
				(a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0)
		);
	}
	return groups;
}

/** First 120 characters plus "…" when longer; shorter notes are returned unchanged. */
export function notesPreview(notes: string): string {
	return notes.length > NOTES_PREVIEW ? notes.slice(0, NOTES_PREVIEW) + '…' : notes;
}

/** The 10-saved-search limit: `count` is the number of live renter saved searches. */
export const canSaveAnother = (count: number): boolean => count < MAX_SAVED_SEARCHES;
