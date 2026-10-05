// Renter saved-search meta (RENT-04): the location, local filters and sort of a renter saved
// search, in a companion row whose id EQUALS the Phase 4 savedSearches row id (Phase 4 keeps the
// name, endpoint, wide params, run times and snapshot). Same id means a backup merge lines both up.
// Tombstoned on remove; a later put restores the row with deletedAt removed (never null).
import { newSyncable, tombstone } from '@tran/core';
import {
	renterSearchMetaSchema,
	type RentalFilters,
	type RenterLocation,
	type RenterSearchMeta,
	type RenterSortId
} from '@tran/core/renter';
import { getDb, type TranDb } from '$lib/storage/db';
import { META } from '$lib/storage/meta';
import { RENTER_RECORD_SCHEMA_VERSION, searchMetaTable } from './tables';

/** What the renter UI holds (06-07 url-state shapes); validated and copied on write. */
export interface SearchMetaValue {
	location: RenterLocation;
	filters: RentalFilters;
	sort: RenterSortId;
}

export interface SearchMetaRepo {
	/** Creates or replaces the meta for `searchId` (validated; rejects without writing). */
	put(searchId: string, value: SearchMetaValue): Promise<RenterSearchMeta>;
	/** The live meta row (tombstones ignored). */
	get(searchId: string): Promise<RenterSearchMeta | undefined>;
	/** Tombstones the row; a missing or removed id is a no-op. */
	remove(searchId: string): Promise<void>;
	/** Every live meta row. */
	liveAll(): Promise<RenterSearchMeta[]>;
}

const isLive = (m: RenterSearchMeta) => m.deletedAt === undefined;

export function createSearchMetaRepo(
	db: TranDb,
	clock: () => number = () => Date.now()
): SearchMetaRepo {
	const table = () => searchMetaTable(db);

	return {
		put(searchId, value) {
			return db.transaction('rw', [table(), db.meta], async () => {
				const now = new Date(clock());
				const existing = await table().get(searchId);
				let base;
				if (existing) {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { deletedAt, location, filters, sort, ...kept } = existing;
					base = { ...kept, updatedAt: now.toISOString() };
				} else {
					base = newSyncable({ id: searchId, now, schemaVersion: RENTER_RECORD_SCHEMA_VERSION });
				}
				const row = renterSearchMetaSchema.parse({
					...base,
					location: value.location,
					filters: { ...value.filters, types: [...value.filters.types] },
					sort: value.sort
				});
				await table().put(row);
				if (!(await db.meta.get(META.firstRecordAt))) {
					await db.meta.put({ key: META.firstRecordAt, value: now.toISOString() });
				}
				return row;
			});
		},

		async get(searchId) {
			const row = await table().get(searchId);
			return row && isLive(row) ? row : undefined;
		},

		async remove(searchId) {
			await db.transaction('rw', table(), async () => {
				const row = await table().get(searchId);
				if (row && isLive(row)) await table().put(tombstone(row, new Date(clock())));
			});
		},

		liveAll: () => table().filter(isLive).toArray()
	};
}

let instance: SearchMetaRepo | undefined;

/** App singleton bound to the app database. Call from onMount / event handlers only. */
export function getSearchMetaRepo(): SearchMetaRepo {
	instance ??= createSearchMetaRepo(getDb());
	return instance;
}
