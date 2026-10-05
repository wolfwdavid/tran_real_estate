/**
 * Saved-search snapshot diffing for the check-on-open alerts scheduler.
 *
 * Pure: no clock reads (`takenAt` is passed in), no I/O. Output id arrays are sorted ascending
 * so results are deterministic regardless of object key order.
 */

export interface SnapshotItemLike {
	price: number | null;
	status: string | null;
	removedDate: string | null;
	firstSeenAt: number;
}

export interface SnapshotLike {
	takenAt: number;
	/** True when the result window was full (e.g. 500 rows), so absent ids may simply be out of view. */
	truncated: boolean;
	items: Record<string, SnapshotItemLike>;
}

export interface ObservedItem {
	id: string;
	price: number | null;
	status: string | null;
	removedDate: string | null;
}

export interface SnapshotDiff {
	new: string[];
	priceChanged: { id: string; from: number | null; to: number | null }[];
	gone: string[];
	/** Ids from the previous snapshot missing from a truncated one: we cannot tell if they are gone. */
	unknown: string[];
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A record the provider itself marks as off-market. */
function isOffMarket(item: Pick<SnapshotItemLike, 'status' | 'removedDate'>): boolean {
	return item.status === 'Inactive' || item.removedDate !== null;
}

export function buildSnapshot(
	prev: SnapshotLike | null,
	observed: readonly ObservedItem[],
	opts: { takenAt: number; truncated: boolean }
): SnapshotLike {
	const items: Record<string, SnapshotItemLike> = {};
	for (const o of observed) {
		items[o.id] = {
			price: o.price,
			status: o.status,
			removedDate: o.removedDate,
			firstSeenAt: prev?.items[o.id]?.firstSeenAt ?? opts.takenAt
		};
	}
	return { takenAt: opts.takenAt, truncated: opts.truncated, items };
}

export function diffSnapshots(prev: SnapshotLike | null, next: SnapshotLike): SnapshotDiff {
	const out: SnapshotDiff = { new: [], priceChanged: [], gone: [], unknown: [] };
	// First run is a baseline: nothing is "new" relative to a search the user just saved.
	if (prev === null) return out;

	for (const id of Object.keys(next.items).sort(byId)) {
		const now = next.items[id]!;
		const before = prev.items[id];
		if (isOffMarket(now)) {
			// Only report a removal for something we had seen on-market before.
			if (before && !isOffMarket(before)) out.gone.push(id);
			continue;
		}
		if (!before) {
			out.new.push(id);
		} else if (before.price !== now.price) {
			out.priceChanged.push({ id, from: before.price, to: now.price });
		}
	}

	for (const id of Object.keys(prev.items).sort(byId)) {
		if (id in next.items) continue;
		if (isOffMarket(prev.items[id]!)) continue; // already reported as gone on an earlier run
		// A truncated window may have pushed the id out of view: never call that "gone".
		if (next.truncated) out.unknown.push(id);
		else out.gone.push(id);
	}

	out.gone.sort(byId);
	return out;
}

/** "N new since your last visit": items first seen strictly after the user last opened the results. */
export function countNewSince(snapshot: SnapshotLike | null, lastSeenAt: number | null): number {
	if (snapshot === null || lastSeenAt === null) return 0;
	let n = 0;
	for (const item of Object.values(snapshot.items)) {
		if (item.firstSeenAt > lastSeenAt && !isOffMarket(item)) n++;
	}
	return n;
}
