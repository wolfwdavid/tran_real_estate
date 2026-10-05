// The backup file format. A backup is one JSON envelope holding every registered table of the
// app database. Keys are never part of it: they live in a separate database and the export is
// additionally scanned by findKeyMaterial (key-scan.ts) before anything is written.
import * as z from 'zod/mini';

import { SyncableSchema, type Syncable } from '../syncable.js';
import { BackupError } from './errors.js';
import { migrateTables, type MigrationRegistry, type TablesMap } from './migrations.js';

export const BACKUP_FORMAT = 'tran-backup-v1';
/** Bump only together with a `migrations[n]` step (see migrations.ts). */
export const BACKUP_SCHEMA_VERSION = 1;
/** Checked by the web layer against `file.size` before the file is read (code 'too-large'). */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
export const BACKUP_APP_NAME = 'Tran Real Estate Tools';

export const EnvelopeSchema = z.object({
	format: z.literal(BACKUP_FORMAT),
	schemaVersion: z.number().check(z.int(), z.positive()),
	app: z.literal(BACKUP_APP_NAME),
	exportedAt: z.iso.datetime(),
	tables: z.record(z.string(), z.array(SyncableSchema))
});

export type BackupEnvelope = z.infer<typeof EnvelopeSchema>;

export function buildEnvelope(tables: Record<string, Syncable[]>, now: Date): BackupEnvelope {
	return {
		format: BACKUP_FORMAT,
		schemaVersion: BACKUP_SCHEMA_VERSION,
		app: BACKUP_APP_NAME,
		exportedAt: now.toISOString(),
		// Syncable has no index signature, but every record is a loose object at runtime.
		tables: tables as BackupEnvelope['tables']
	};
}

export interface ParseBackupOptions {
	readonly registeredTables: readonly string[];
	/** Test seam: the version this build understands. Defaults to BACKUP_SCHEMA_VERSION. */
	readonly currentVersion?: number;
	/** Test seam: the migration registry. Defaults to the real `migrations`. */
	readonly registry?: MigrationRegistry;
}

export interface ParsedBackup {
	envelope: BackupEnvelope;
	/** The file's original schemaVersion when it was migrated forward, otherwise null. */
	migratedFrom: number | null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parses untrusted backup text. Check order: JSON → Tran format → not newer → migrate →
 * validate → known tables. Every failure throws a BackupError whose message is only the code.
 */
export function parseBackup(text: string, o: ParseBackupOptions): ParsedBackup {
	const currentVersion = o.currentVersion ?? BACKUP_SCHEMA_VERSION;

	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new BackupError('not-json');
	}

	if (!isPlainObject(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError('not-tran');

	const version = raw.schemaVersion;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
		throw new BackupError('invalid');
	}
	if (version > currentVersion) throw new BackupError('newer');
	if (!isPlainObject(raw.tables)) throw new BackupError('invalid');

	const migrated = migrateTables(raw.tables as TablesMap, version, currentVersion, o.registry);

	const result = EnvelopeSchema.safeParse({
		...raw,
		schemaVersion: currentVersion,
		tables: migrated
	});
	if (!result.success) throw new BackupError('invalid');

	const known = new Set(o.registeredTables);
	for (const name of Object.keys(result.data.tables)) {
		if (!known.has(name)) throw new BackupError('invalid');
	}

	return { envelope: result.data, migratedFrom: version < currentVersion ? version : null };
}
