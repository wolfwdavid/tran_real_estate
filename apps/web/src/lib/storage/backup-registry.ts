// Which Dexie tables a backup contains. Export, the import preview rows and their labels are all
// driven by this list, so a table that is not registered is never written to a backup file.
// Later phases call registerBackupTable() for each user-data table they add, and list local-only
// tables in BACKUP_EXCLUDED_TABLES. Every TranDb table must be exactly one of the two.

import { AI_BACKUP_TABLES } from '$lib/ai/storage/tables';
import { PHASE4_BACKUP_EXCLUDED, PHASE4_BACKUP_TABLES } from '$lib/data/tables';
import { RENTER_BACKUP_TABLES } from '$lib/features/renter/storage/tables';
import { INVESTOR_BACKUP_TABLES } from '$lib/features/investor/deals/tables';
import { AGENT_BACKUP_TABLES } from './agent/backup';
import { STUDIO_BACKUP_TABLES } from './studio/tables';

/** Any zod/mini schema satisfies this; the import preview rejects a file with a failing row. */
export interface BackupRecordSchema {
	safeParse(value: unknown): { success: boolean };
}

export interface BackupTable {
	readonly name: string;
	readonly label: string;
	/** Optional per-record validator applied to every incoming row of this table on import. */
	readonly schema?: BackupRecordSchema;
	/**
	 * Dot paths inside each row that the export key scan skips (Phase 8: the agent logo bytes and
	 * the public Web3Forms key). Paths only, never patterns; every other field is still scanned.
	 */
	readonly scanExemptPaths?: readonly string[];
}

/**
 * Local-only tables. `meta` holds lastBackupAt etc.: importing it would fake backup recency.
 * Phase 4's `apiCache` is a disposable RentCast response cache.
 */
export const BACKUP_EXCLUDED_TABLES: readonly string[] = Object.freeze([
	'meta',
	...PHASE4_BACKUP_EXCLUDED
]);

// Built-in registrations live here (not in a side-effect import) so a backup made from Settings
// always includes them, even when no data-layer module has loaded yet.
const DEFAULT_TABLES: readonly BackupTable[] = [
	{ name: 'prefs', label: 'Settings' },
	...PHASE4_BACKUP_TABLES,
	// Phase 5: AI drafts (aiArtifacts).
	...AI_BACKUP_TABLES,
	// Phase 6: 'Rental shortlist' (renterShortlist), 'Saved rental searches' (renterSearchMeta).
	...RENTER_BACKUP_TABLES,
	// Phase 7: 'Saved deals' (deals), 'Deal analyzer draft' (investorDraft), 'Buy boxes'
	// (buyBoxes), 'Watched ZIP codes' (watchedZips), each with a record schema.
	...INVESTOR_BACKUP_TABLES,
	// Phase 8: 'Contacts', 'Tasks', 'Activity', 'Agent profile' (each with a record schema; the
	// profile also carries its two scan-exempt paths, see $lib/storage/agent/backup.ts).
	...AGENT_BACKUP_TABLES,
	// Phase 9: 'Studio forms' (studioDraft) and 'Market Snapshots' (snapshots), each with a record
	// schema (snapshots also re-run the aggregate-only privacy guard on import).
	...STUDIO_BACKUP_TABLES
];

let tables: BackupTable[] = DEFAULT_TABLES.map((t) => ({ ...t }));

/** Adds a table (appended in registration order) or replaces the label of an existing one. */
export function registerBackupTable(t: BackupTable): void {
	if (!t.name || !t.label) throw new Error('backup-table-invalid');
	if (BACKUP_EXCLUDED_TABLES.includes(t.name)) throw new Error('backup-table-excluded');
	const entry: BackupTable = Object.freeze({
		name: t.name,
		label: t.label,
		...(t.schema ? { schema: t.schema } : {}),
		...(t.scanExemptPaths ? { scanExemptPaths: Object.freeze([...t.scanExemptPaths]) } : {})
	});
	const i = tables.findIndex((x) => x.name === t.name);
	if (i === -1) tables.push(entry);
	else tables[i] = entry;
}

/** Registered tables in registration order (a frozen snapshot). */
export function listBackupTables(): readonly BackupTable[] {
	return Object.freeze([...tables]);
}

/** Tests only: restores the default registry. */
export function _resetBackupRegistry(): void {
	tables = DEFAULT_TABLES.map((t) => ({ ...t }));
}
