// Listing recency status (RENT-03).
// Recency only. Tran never claims a listing is open; the renter asks the listing contact.

export type ListingStatus =
	| { kind: 'recent'; lastSeen: string }
	| { kind: 'stale'; lastSeen: string | null }
	| { kind: 'gone' };

const DAY_MS = 86_400_000;

/** YYYY-MM-DD date part of an ISO string, or null. */
const dayPart = (iso: string | null | undefined): string | null =>
	typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null;

/** Whole UTC calendar days from day to now. TODO(06-07): unify with renter/filters.ts utcDayDiff. */
function daysSince(now: Date, day: string): number {
	const [y, m, d] = day.split('-').map(Number) as [number, number, number];
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Math.round((today - Date.UTC(y, m - 1, d)) / DAY_MS);
}

export function listingStatus(
	row: { status: string | null; lastSeenDate: string | null; removedDate?: string | null },
	now: Date,
	recentDays = 7
): ListingStatus {
	// Only an explicit Inactive status or a removal date means gone; an unknown status falls
	// through to recency so we never claim a delisting RentCast did not report.
	if (row.status?.toLowerCase() === 'inactive' || row.removedDate) return { kind: 'gone' };
	const lastSeen = dayPart(row.lastSeenDate);
	if (lastSeen === null) return { kind: 'stale', lastSeen: null };
	return daysSince(now, lastSeen) <= recentDays
		? { kind: 'recent', lastSeen }
		: { kind: 'stale', lastSeen };
}
