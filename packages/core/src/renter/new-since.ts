// "N new since last visit" for a renter saved search (RENT-04), filtered by the saved filters.
//
// Builds on Phase 4's portal-neutral snapshot model (`@tran/core/alerts`): the scheduler's
// `buildSnapshot` assigns `firstSeenAt`, and `countNewSince` is the unfiltered count. The renter
// version also requires each new id to still match the search's filters, using the cached row and
// the same `matchRental` the results list uses, so the badge never counts a row the list hides.
import type { SnapshotItemLike } from '../alerts/diff.js';
import { matchRental } from './filters.js';
import type { RentalFilters, RentalRowLike } from './types.js';

export type { SnapshotItemLike };

/** Snapshot-only check for an id whose full row is no longer cached: on-market and in price. */
function snapshotMatches(item: SnapshotItemLike, f: RentalFilters): boolean {
	if (f.priceMin === null && f.priceMax === null) return true;
	if (item.price === null) return false;
	if (f.priceMin !== null && item.price < f.priceMin) return false;
	if (f.priceMax !== null && item.price > f.priceMax) return false;
	return true;
}

/**
 * Ids first seen strictly after `lastSeenAt` that still match `filters`. A null `lastSeenAt`
 * (never visited) returns an empty set: the first visit shows nothing as new. Items with a
 * removal date or a status other than 'Active' are never new.
 */
export function filteredNewIds(
	items: Record<string, SnapshotItemLike>,
	lastSeenAt: number | null,
	rowsById: ReadonlyMap<string, RentalRowLike>,
	filters: RentalFilters,
	now: Date
): Set<string> {
	const out = new Set<string>();
	if (lastSeenAt === null) return out;
	for (const [id, item] of Object.entries(items)) {
		if (!(item.firstSeenAt > lastSeenAt)) continue;
		if (item.status !== 'Active' || item.removedDate !== null) continue;
		const row = rowsById.get(id);
		if (row ? matchRental(row, filters, now) : snapshotMatches(item, filters)) out.add(id);
	}
	return out;
}
