// The main app database ('tran'). Every route prerenders in Node and marketing routes must not
// even load Dexie, so nothing here touches IndexedDB at module scope: callers reach the database
// through getDb()/openDb() from onMount, event handlers, or modules imported only by (app) routes.
import Dexie, { type Table } from 'dexie';
import type { Syncable } from '@tran/core';
import {
	PHASE4_STORES,
	type ApiCacheRow,
	type DataPrefRow,
	type LedgerRow,
	type SavedSearchRow,
	type SearchSnapshotRow
} from '$lib/data/tables';
import { AI_STORES, type AiArtifact } from '$lib/ai/storage/tables';
import type { RenterSearchMeta, ShortlistItem } from '@tran/core/renter';

/** LOCAL-ONLY bookkeeping (lastBackupAt, snooze, firstRecordAt). Never exported in a backup. */
export interface MetaRow {
	key: string;
	value: unknown;
}

/** Small user settings. Exported in backups (registered as "Settings"). */
export interface PrefRecord extends Syncable {
	key: string;
	value: unknown;
}

export type DbOptions = { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange };

export class TranDb extends Dexie {
	meta!: Table<MetaRow, string>;
	prefs!: Table<PrefRecord, string>;
	// Phase 4 data layer (apps/web/src/lib/data/tables.ts).
	apiCache!: Table<ApiCacheRow, string>;
	ledger!: Table<LedgerRow, string>;
	savedSearches!: Table<SavedSearchRow, string>;
	searchSnapshots!: Table<SearchSnapshotRow, string>;
	dataPrefs!: Table<DataPrefRow, string>;
	// Phase 5 AI drafts (apps/web/src/lib/ai/storage/tables.ts).
	aiArtifacts!: Table<AiArtifact, string>;
	// Phase 6 renter shortlist + saved-search filters ($lib/features/renter/storage).
	renterShortlist!: Table<ShortlistItem, string>;
	renterSearchMeta!: Table<RenterSearchMeta, string>;

	constructor(options?: DbOptions, name = 'tran') {
		super(name, options);
		// Version history is APPEND-ONLY. Later phases add this.version(n + 1).stores({...}) below
		// (plus .upgrade() when a record shape changes); never edit an existing block.
		this.version(1).stores({ meta: 'key', prefs: 'id, key, updatedAt' });
		// Phase 4: RentCast cache, call ledger, saved searches + snapshots, data prefs.
		this.version(2).stores(PHASE4_STORES);
		// Phase 5: stored AI generations ("AI drafts"). Adds one table; existing tables unchanged.
		this.version(3).stores(AI_STORES);
		// Phase 6: renter shortlist (one row per listing; tombstones keep the unique listingId, so a
		// re-add restores the row) and the renter search meta (same id as the savedSearches row).
		this.version(4).stores({
			renterShortlist: 'id, &listingId, status, updatedAt, deletedAt',
			renterSearchMeta: 'id, updatedAt, deletedAt'
		});
	}
}

/** Site storage is blocked (user/policy setting) or IndexedDB is unavailable. */
export class StorageBlockedError extends Error {
	constructor() {
		super('storage-blocked');
		this.name = 'StorageBlockedError';
	}
}

const BLOCKED_NAMES = new Set([
	'SecurityError',
	'InvalidStateError',
	'UnknownError',
	'MissingAPIError'
]);

/** Dexie wraps the native DOMException (OpenFailedError.inner); walk the chain for a blocked name. */
function isBlocked(err: unknown): boolean {
	for (let e = err, depth = 0; e && depth < 5; depth++) {
		const name = (e as { name?: unknown }).name;
		if (typeof name === 'string' && BLOCKED_NAMES.has(name)) return true;
		e = (e as { inner?: unknown; cause?: unknown }).inner ?? (e as { cause?: unknown }).cause;
	}
	return false;
}

let instance: TranDb | undefined;

/** Lazy singleton. Browser callers only (onMount / event handlers); options are used on first call. */
export function getDb(options?: DbOptions): TranDb {
	instance ??= new TranDb(options);
	return instance;
}

/** Opens the database, mapping blocked-storage failures to StorageBlockedError. */
export async function openDb(db: TranDb = getDb()): Promise<TranDb> {
	try {
		await db.open();
		return db;
	} catch (err) {
		if (isBlocked(err)) throw new StorageBlockedError();
		throw err;
	}
}

/** Tests only: closes and forgets the singleton. */
export function _resetDb(): void {
	instance?.close();
	instance = undefined;
}
