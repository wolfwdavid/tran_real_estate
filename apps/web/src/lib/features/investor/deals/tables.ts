// Phase 7 table names, Dexie stores and backup labels. Dependency-free at runtime apart from the
// zod/mini record schemas (no Dexie, no $lib/storage import), like $lib/data/tables and the renter
// tables module, so $lib/storage/db.ts and backup-registry.ts can import it without a cycle.
//
// Every Phase 7 row is a Phase 3 Syncable record (uuid id, ownerId 'local', ISO timestamps,
// deletedAt OMITTED on live rows and set on tombstones), because the backup envelope validates
// every exported record as Syncable and merges by id.
import type { TranDb } from '$lib/storage/db';
import type { Table } from 'dexie';
import { watchedZipRecordSchema } from '$lib/features/shared/markets/watched-zip-record';
import { dealRecordSchema, looseRecordSchema, type DealRecord } from './schema';

export const DEALS_TABLE = 'deals';
export const INVESTOR_DRAFT_TABLE = 'investorDraft';
export const BUY_BOXES_TABLE = 'buyBoxes';
export const WATCHED_ZIPS_TABLE = 'watchedZips';

/** schemaVersion stamped on every Phase 7 Syncable record. */
export const INVESTOR_RECORD_SCHEMA_VERSION = 1;

/**
 * Dexie stores for TranDb's version 5 block. watchedZips is keyed by a uuid derived from the ZIP
 * (watchedZipId), so the same ZIP has the same id in every browser and a backup merge never
 * collides on the unique `zip` index.
 */
export const INVESTOR_STORES = Object.freeze({
	[DEALS_TABLE]: 'id, updatedAt, deletedAt',
	[INVESTOR_DRAFT_TABLE]: 'id',
	[BUY_BOXES_TABLE]: 'id',
	[WATCHED_ZIPS_TABLE]: 'id, &zip, addedAt'
});

/** Minimal validator contract the backup registry accepts (any zod/mini schema satisfies it). */
interface RecordValidator {
	safeParse(value: unknown): { success: boolean };
}

/**
 * Phase 7 tables in the backup, appended to the registry's built-in list (so a backup made from
 * Settings before any investor module loads still includes them). Each carries a record schema the
 * import preview applies to every incoming row.
 */
export const INVESTOR_BACKUP_TABLES: readonly {
	readonly name: string;
	readonly label: string;
	readonly schema: RecordValidator;
}[] = Object.freeze([
	Object.freeze({ name: DEALS_TABLE, label: 'Saved deals', schema: dealRecordSchema }),
	Object.freeze({
		name: INVESTOR_DRAFT_TABLE,
		label: 'Deal analyzer draft',
		schema: looseRecordSchema
	}),
	Object.freeze({ name: BUY_BOXES_TABLE, label: 'Buy boxes', schema: looseRecordSchema }),
	Object.freeze({
		name: WATCHED_ZIPS_TABLE,
		label: 'Watched ZIP codes',
		schema: watchedZipRecordSchema
	})
]);

export const dealsTable = (db: TranDb): Table<DealRecord, string> => db.deals;
