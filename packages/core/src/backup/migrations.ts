// Forward migrations for backup files. `migrations[n]` upgrades the tables of a version-n file to
// version n + 1. Bump BACKUP_SCHEMA_VERSION only together with a new `migrations[n]` step; a unit
// test fails if the registry has a gap. This version is separate from Dexie's database version.
import { BACKUP_SCHEMA_VERSION } from './envelope.js';
import { BackupError } from './errors.js';

export type TablesMap = Record<string, unknown[]>;
export type MigrationRegistry = Readonly<Record<number, (t: TablesMap) => TablesMap>>;

export const migrations: MigrationRegistry = Object.freeze({});

/** Runs steps from..to-1 in order. Throws BackupError('invalid') when a step is missing. */
export function migrateTables(
	tables: TablesMap,
	from: number,
	to: number = BACKUP_SCHEMA_VERSION,
	registry: MigrationRegistry = migrations
): TablesMap {
	let out = tables;
	for (let v = from; v < to; v++) {
		const step = Object.hasOwn(registry, v) ? registry[v] : undefined;
		if (!step) throw new BackupError('invalid');
		out = step(out);
	}
	return out;
}
