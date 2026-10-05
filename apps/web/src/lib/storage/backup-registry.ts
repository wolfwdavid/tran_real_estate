// Which Dexie tables a backup contains. Export, the import preview rows and their labels are all
// driven by this list, so a table that is not registered is never written to a backup file.
// Later phases call registerBackupTable() for each user-data table they add, and list local-only
// tables in BACKUP_EXCLUDED_TABLES. Every TranDb table must be exactly one of the two.

import { PHASE4_BACKUP_EXCLUDED, PHASE4_BACKUP_TABLES } from '$lib/data/tables';

export interface BackupTable {
	readonly name: string;
	readonly label: string;
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
	...PHASE4_BACKUP_TABLES
];

let tables: BackupTable[] = DEFAULT_TABLES.map((t) => ({ ...t }));

/** Adds a table (appended in registration order) or replaces the label of an existing one. */
export function registerBackupTable(t: BackupTable): void {
	if (!t.name || !t.label) throw new Error('backup-table-invalid');
	if (BACKUP_EXCLUDED_TABLES.includes(t.name)) throw new Error('backup-table-excluded');
	const entry = Object.freeze({ name: t.name, label: t.label });
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
