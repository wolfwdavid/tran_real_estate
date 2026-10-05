// The renter shortlist (RENT-05): one row per listing, keyed by a uuid with a UNIQUE listingId.
// Removing tombstones the row (deletedAt), so the unique index still holds it: add() therefore
// looks up the listingId INCLUDING tombstones and restores the row instead of inserting (an insert
// would throw ConstraintError). A live row never carries deletedAt at all (never null): the
// shortlistItemSchema and the Phase 3 backup validator both reject null.
//
// Every write validates with the core schema first, so nothing invalid reaches storage or a backup.
// Persistence: the click handler that saves the first listing calls requestPersistence() itself
// (Phase 3 rule); this repo runs after awaits and cannot.
import { liveQuery, type Observable } from 'dexie';
import { newSyncable, tombstone } from '@tran/core';
import {
	changeStatus,
	MAX_NOTES,
	shortlistItemSchema,
	type ShortlistItem,
	type ShortlistStatus
} from '@tran/core/renter';
import type { Provenance } from '$lib/data';
import { getDb, type TranDb } from '$lib/storage/db';
import { META } from '$lib/storage/meta';
import { RENTER_RECORD_SCHEMA_VERSION, shortlistTable } from './tables';

/**
 * The mapped listing row to save. Any object with an id and price, so a Phase 4 Listing (an
 * interface without an index signature) passes as-is; the whole row is kept as the snapshot.
 */
export interface ShortlistListing {
	readonly id: string;
	readonly price: number | null;
}

export interface ShortlistRepo {
	/** Saves a listing as 'saved'; an active duplicate returns the existing item, a removed one is restored. */
	add(
		row: ShortlistListing,
		provenance: Pick<Provenance, 'source' | 'fetchedAt'>
	): Promise<ShortlistItem>;
	/** Tombstones the item. A missing or already removed listing is a no-op. */
	remove(listingId: string): Promise<void>;
	/** Moves the item (history appended); undefined when the listing is not on the shortlist. */
	setStatus(listingId: string, status: ShortlistStatus): Promise<ShortlistItem | undefined>;
	/** Replaces the notes; rejects with RangeError above MAX_NOTES characters (nothing written). */
	setNotes(listingId: string, notes: string): Promise<ShortlistItem | undefined>;
	/** The live item for a listing (tombstones ignored). */
	getByListingId(listingId: string): Promise<ShortlistItem | undefined>;
	/** Every live item (wrap in `live(() => repo.liveAll(), [])` for a reactive view). */
	liveAll(): Promise<ShortlistItem[]>;
	/** Number of live items. */
	count(): Promise<number>;
	/** Dexie liveQuery of count(): a Svelte-store-compatible observable for the nav badge. */
	liveCount(): Observable<number>;
}

export interface ShortlistRepoOptions {
	uuid?: () => string;
}

const isLive = (i: ShortlistItem) => i.deletedAt === undefined;

export function createShortlistRepo(
	db: TranDb,
	clock: () => number = () => Date.now(),
	opts: ShortlistRepoOptions = {}
): ShortlistRepo {
	const uuid = opts.uuid ?? (() => crypto.randomUUID());
	const table = () => shortlistTable(db);

	/** The row for a listing, tombstoned or not (the unique index allows at most one). */
	const anyRow = (listingId: string) => table().where('listingId').equals(listingId).first();

	const liveRow = async (listingId: string) => {
		const row = await anyRow(listingId);
		return row && isLive(row) ? row : undefined;
	};

	const markFirstRecord = async (at: number) => {
		if (!(await db.meta.get(META.firstRecordAt))) {
			await db.meta.put({ key: META.firstRecordAt, value: new Date(at).toISOString() });
		}
	};

	/** Validated write; returns the stored object. */
	const save = async (item: ShortlistItem): Promise<ShortlistItem> => {
		const valid = shortlistItemSchema.parse(item);
		await table().put(valid);
		return valid;
	};

	/** Read-modify-write of a live row in one transaction. */
	const update = (
		listingId: string,
		change: (item: ShortlistItem, now: number) => ShortlistItem
	): Promise<ShortlistItem | undefined> =>
		db.transaction('rw', table(), async () => {
			const item = await liveRow(listingId);
			if (!item) return undefined;
			const next = change(item, clock());
			return next === item ? item : save(next);
		});

	const liveAll = () => table().filter(isLive).toArray();
	const count = () => table().filter(isLive).count();

	return {
		add(row, provenance) {
			return db.transaction('rw', [table(), db.meta], async () => {
				const now = clock();
				const existing = await anyRow(row.id);
				if (existing && isLive(existing)) return existing;

				const fresh = {
					listingId: row.id,
					listing: structuredClone(row) as ShortlistItem['listing'],
					provenance: { source: provenance.source, fetchedAt: provenance.fetchedAt },
					status: 'saved' as const,
					statusChangedAt: now,
					statusHistory: [{ status: 'saved' as const, at: now }],
					notes: ''
				};
				let item: ShortlistItem;
				if (existing) {
					// Restore the tombstone: same id + createdAt, everything else fresh, deletedAt REMOVED.
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { deletedAt, ...kept } = existing;
					item = { ...kept, ...fresh, updatedAt: new Date(now).toISOString() };
				} else {
					item = {
						...newSyncable({
							id: uuid(),
							now: new Date(now),
							schemaVersion: RENTER_RECORD_SCHEMA_VERSION
						}),
						...fresh
					};
				}
				const saved = await save(item);
				await markFirstRecord(now);
				return saved;
			});
		},

		async remove(listingId) {
			await db.transaction('rw', table(), async () => {
				const item = await liveRow(listingId);
				if (item) await table().put(tombstone(item, new Date(clock())));
			});
		},

		setStatus: (listingId, status) =>
			update(listingId, (item, now) => changeStatus(item, status, now)),

		async setNotes(listingId, notes) {
			if (notes.length > MAX_NOTES) {
				throw new RangeError(`Notes are limited to ${MAX_NOTES} characters.`);
			}
			return update(listingId, (item, now) =>
				item.notes === notes ? item : { ...item, notes, updatedAt: new Date(now).toISOString() }
			);
		},

		getByListingId: liveRow,
		liveAll,
		count,
		liveCount: () => liveQuery(count)
	};
}

let instance: ShortlistRepo | undefined;

/** App singleton bound to the app database. Call from onMount / event handlers only. */
export function getShortlistRepo(): ShortlistRepo {
	instance ??= createShortlistRepo(getDb());
	return instance;
}
