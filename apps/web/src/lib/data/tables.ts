// Phase 4 Dexie tables: row types and schema strings. Plain TypeScript (no Svelte, no runes) so the
// storage layer, repositories and tests can all import it. TranDb adds PHASE4_STORES in its own
// append-only version block (apps/web/src/lib/storage/db.ts).
//
// Backups: every table except apiCache is exported. The Phase 3 backup format validates each
// record as Syncable (uuid id, ownerId 'local', ISO-8601 createdAt/updatedAt, schemaVersion) and
// merges by id + updatedAt, so every backed-up row type below extends Syncable.
// apiCache is a disposable response cache: NOT Syncable, never backed up, never synced.
// No row ever holds an API key. ledger.key is the canonical REQUEST key (endpoint + params).
import type { Syncable } from '@tran/core';

export const PHASE4_STORES = {
	apiCache: 'key, endpoint, fetchedAt',
	ledger: 'id, periodKey, [periodKey+at]',
	savedSearches: 'id, portal, lastRunAt',
	searchSnapshots: 'searchId',
	dataPrefs: 'key'
} as const;

/** schemaVersion stamped on every Phase 4 Syncable record (use with newSyncable from @tran/core). */
export const DATA_RECORD_SCHEMA_VERSION = 1;

/** Cache entry for one canonical request. Local-only; excluded from backup and future sync. */
export interface ApiCacheRow {
	key: string;
	endpoint: string;
	status: number;
	body: unknown;
	fetchedAt: number;
	truncated: boolean;
	droppedRows: number;
}

export type LedgerIntent = 'user' | 'refresh' | 'scheduler' | 'key-test';

export interface LedgerRow extends Syncable {
	periodKey: string;
	at: number;
	endpoint: string;
	/** Canonical request key. NEVER contains the API key. */
	key: string;
	intent: LedgerIntent;
	status: 'pending' | number;
	overCap: boolean;
	settledAt: number | null;
}

export type SavedSearchParams = Record<string, string | number | boolean | (string | number)[]>;

export interface SavedSearchRow extends Syncable {
	portal: 'renter' | 'investor' | 'agent';
	name: string;
	endpoint: string;
	params: SavedSearchParams;
	lastRunAt: number | null;
	lastSeenAt: number | null;
	claimedAt: number | null;
}

export interface SnapshotItem {
	price: number | null;
	status: string | null;
	removedDate: string | null;
	firstSeenAt: number;
}

/**
 * Last result set of one saved search (primary key searchId). Syncable so it survives a backup:
 * by convention `id === searchId` (a uuid), so the backup merge-by-id lines up with the primary key.
 */
export interface SearchSnapshotRow extends Syncable {
	searchId: string;
	takenAt: number;
	truncated: boolean;
	items: Record<string, SnapshotItem>;
}

export type DataSourcePref = 'rentcast' | 'sample';

export type DataPrefKey = 'rentcastCap' | 'dataSource';

/**
 * Fixed record ids per data preference (primary key is `key`). Constant ids keep the backup
 * merge-by-id aligned with the primary key across devices: the newer updatedAt wins.
 */
export const DATA_PREF_IDS: Readonly<Record<DataPrefKey, string>> = Object.freeze({
	rentcastCap: '6f1c2b1e-4b8a-4d0e-9a51-3c7d2e8f4a01',
	dataSource: '6f1c2b1e-4b8a-4d0e-9a51-3c7d2e8f4a02'
});

export type DataPrefRow =
	| (Syncable & { key: 'rentcastCap'; value: number })
	| (Syncable & { key: 'dataSource'; value: DataSourcePref });

/** Phase 4 tables written to backups, with their ImportPreview labels. */
export const PHASE4_BACKUP_TABLES: readonly { readonly name: string; readonly label: string }[] =
	Object.freeze([
		{ name: 'ledger', label: 'RentCast call history' },
		{ name: 'savedSearches', label: 'Saved searches' },
		{ name: 'searchSnapshots', label: 'Saved search results' },
		{ name: 'dataPrefs', label: 'Data settings' }
	]);

/**
 * Phase 4 tables deliberately NOT in backups. The registry's BACKUP_EXCLUDED_TABLES includes them;
 * every other TranDb table must be backup-registered (schema-registry.test.ts).
 */
export const PHASE4_BACKUP_EXCLUDED = Object.freeze(['apiCache'] as const);

/** Names in `tableNames` that are neither registered for backup nor explicitly excluded. */
export function unregisteredTables(
	tableNames: readonly string[],
	registered: readonly string[],
	excluded: readonly string[]
): string[] {
	return tableNames.filter((n) => !registered.includes(n) && !excluded.includes(n));
}
