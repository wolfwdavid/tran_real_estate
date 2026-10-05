// Renter table names, backup labels and typed accessors. Dependency-free at runtime (type imports
// only), like $lib/data/tables and $lib/ai/storage/tables, so $lib/storage/backup-registry.ts can
// import RENTER_BACKUP_TABLES without an import cycle.
//
// Dexie stores live in TranDb's version 4 block ($lib/storage/db.ts):
//   renterShortlist:  'id, &listingId, status, updatedAt, deletedAt'
//   renterSearchMeta: 'id, updatedAt, deletedAt'
//
// Backup registration: both tables are in the registry's built-in list (DEFAULT_TABLES, the init
// path Phases 4 and 5 use) rather than a runtime registerBackupTable() call from this module. A
// runtime call would only run once a renter module had loaded, so a backup made from Settings
// first could silently omit the shortlist; the built-in list makes the coverage test enforce it.
import type { ShortlistItem, RenterSearchMeta } from '@tran/core/renter';
import type { Table } from 'dexie';
import type { TranDb } from '$lib/storage/db';

export const RENTER_SHORTLIST_TABLE = 'renterShortlist';
export const RENTER_SHORTLIST_LABEL = 'Rental shortlist';
export const RENTER_SEARCH_META_TABLE = 'renterSearchMeta';
export const RENTER_SEARCH_META_LABEL = 'Saved rental searches';

/** schemaVersion stamped on every renter Syncable record. */
export const RENTER_RECORD_SCHEMA_VERSION = 1;

/** Renter tables in the backup (appended to the registry's built-in list). */
export const RENTER_BACKUP_TABLES: readonly { readonly name: string; readonly label: string }[] =
	Object.freeze([
		Object.freeze({ name: RENTER_SHORTLIST_TABLE, label: RENTER_SHORTLIST_LABEL }),
		Object.freeze({ name: RENTER_SEARCH_META_TABLE, label: RENTER_SEARCH_META_LABEL })
	]);

export const shortlistTable = (db: TranDb): Table<ShortlistItem, string> => db.renterShortlist;
export const searchMetaTable = (db: TranDb): Table<RenterSearchMeta, string> => db.renterSearchMeta;
