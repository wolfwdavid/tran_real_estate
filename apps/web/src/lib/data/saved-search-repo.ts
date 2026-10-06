// Saved searches and their last snapshot (DATA-03 alerts).
//
// claim() re-checks "due and unclaimed" and stamps claimedAt inside ONE Dexie read-write
// transaction. IndexedDB serializes overlapping rw transactions across connections, so two tabs
// opening the app at the same moment cannot both run the same search (saved-search-repo.test.ts and
// scheduler.test.ts prove it; both go red if the read leaves the transaction). A claim expires on
// its own after CLAIM_TTL_MS, so a tab that crashes mid-run never blocks the search for good.
//
// complete() writes the snapshot and lastRunAt in one transaction over savedSearches +
// searchSnapshots: a search is never marked as run without its snapshot, or the other way round.
import { isDue } from '@tran/core/alerts';
import { newSyncable, tombstone } from '@tran/core';
import type { DataDb } from './platform';
import {
	DATA_RECORD_SCHEMA_VERSION,
	type SavedSearchParams,
	type SavedSearchRow,
	type SearchSnapshotRow
} from './tables';

export type SavedSearchPortal = SavedSearchRow['portal'];
export type SavedSearchEndpoint = 'rental-listings' | 'sale-listings';

export interface SavedSearchInput {
	portal: SavedSearchPortal;
	name: string;
	endpoint: SavedSearchEndpoint;
	params: SavedSearchParams;
}

/** What a run produces; the repo adds searchId and the Syncable fields. */
export type SnapshotInput = Pick<SearchSnapshotRow, 'takenAt' | 'truncated' | 'items'>;

export interface SavedSearchRepo {
	/** lastRunAt null (due at once), lastSeenAt = now, claimedAt null. */
	create(input: SavedSearchInput): Promise<SavedSearchRow>;
	/** Live rows only (tombstoned rows are excluded). */
	list(): Promise<SavedSearchRow[]>;
	/** rw transaction: true and claimedAt = now only if the row is live, due and unclaimed. */
	claim(id: string): Promise<boolean>;
	/** One rw transaction: write the snapshot, lastRunAt = snapshot.takenAt, claimedAt = null. */
	complete(id: string, snapshot: SnapshotInput): Promise<void>;
	/** A failed run: claimedAt = null, lastRunAt unchanged (due again on the next pass). */
	release(id: string): Promise<void>;
	/** The user opened the results: lastSeenAt = now ("new since last visit" resets). */
	markSeen(id: string): Promise<void>;
	/** Renames a live row (the caller validates and trims; 06-20 renter saved searches). */
	rename(id: string, name: string): Promise<void>;
	snapshot(id: string): Promise<SearchSnapshotRow | undefined>;
	/** Tombstone (Syncable deletedAt) so the deletion survives backup merges. */
	remove(id: string): Promise<void>;
}

const iso = (t: number) => new Date(t).toISOString();

export function createSavedSearchRepo(db: DataDb, clock: () => number): SavedSearchRepo {
	/** Patch a live row; tombstoned or missing rows are left alone. */
	const patch = (id: string, fields: (now: number) => Partial<SavedSearchRow>) =>
		db.transaction('rw', db.savedSearches, async () => {
			const row = await db.savedSearches.get(id);
			if (!row || row.deletedAt !== undefined) return;
			const now = clock();
			await db.savedSearches.update(id, { ...fields(now), updatedAt: iso(now) });
		});

	return {
		async create(input) {
			const now = clock();
			const row: SavedSearchRow = {
				...newSyncable({
					id: crypto.randomUUID(),
					now: new Date(now),
					schemaVersion: DATA_RECORD_SCHEMA_VERSION
				}),
				portal: input.portal,
				name: input.name,
				endpoint: input.endpoint,
				params: structuredClone(input.params),
				lastRunAt: null,
				lastSeenAt: now,
				claimedAt: null
			};
			await db.savedSearches.add(row);
			return structuredClone(row);
		},

		async list() {
			const rows = await db.savedSearches.toArray();
			return rows.filter((r) => r.deletedAt === undefined);
		},

		claim(id) {
			return db.transaction('rw', db.savedSearches, async () => {
				const now = clock();
				const row = await db.savedSearches.get(id);
				if (!row || row.deletedAt !== undefined || !isDue(row, now)) return false;
				await db.savedSearches.update(id, { claimedAt: now, updatedAt: iso(now) });
				return true;
			});
		},

		complete(id, snapshot) {
			return db.transaction('rw', db.savedSearches, db.searchSnapshots, async () => {
				const row = await db.savedSearches.get(id);
				if (!row || row.deletedAt !== undefined) return;
				const now = clock();
				const prev = await db.searchSnapshots.get(id);
				const next: SearchSnapshotRow = {
					...newSyncable({ id, now: new Date(now), schemaVersion: DATA_RECORD_SCHEMA_VERSION }),
					...(prev ? { createdAt: prev.createdAt } : {}),
					searchId: id,
					takenAt: snapshot.takenAt,
					truncated: snapshot.truncated,
					items: snapshot.items
				};
				await db.searchSnapshots.put(next);
				await db.savedSearches.update(id, {
					lastRunAt: snapshot.takenAt,
					claimedAt: null,
					updatedAt: iso(now)
				});
			});
		},

		release: (id) => patch(id, () => ({ claimedAt: null })),

		markSeen: (id) => patch(id, (now) => ({ lastSeenAt: now })),

		rename: (id, name) => patch(id, () => ({ name })),

		snapshot: (id) => db.searchSnapshots.get(id),

		remove(id) {
			return db.transaction('rw', db.savedSearches, async () => {
				const row = await db.savedSearches.get(id);
				if (!row || row.deletedAt !== undefined) return;
				await db.savedSearches.put(tombstone(row, new Date(clock())));
			});
		}
	};
}
