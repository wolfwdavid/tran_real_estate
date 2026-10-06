// Backup service: the one module the Settings Backup section and the AppNotice "Download backup"
// action call. It wires the pure core (envelope, key scan, diff) to the Dexie data layer.
//
// Key-free guarantee. Structurally, export reads ONLY the registered tables of the app database
// ('tran'); the key vault lives in its own separate secrets database that this module never
// opens, and the local-only `meta` table is never registered. The key scan below is defense in
// depth: it refuses to create any file whose text looks like a key or contains an exact vault
// value. (When the vault is locked there are no plaintext known secrets, so the shape scan is
// the only check that can fire then.)
//
// Errors are always BackupError with a fixed code; nothing from the data or the browser leaks
// into the message.
import {
	BackupError,
	backupFilename,
	buildEnvelope,
	findKeyMaterial,
	MAX_BACKUP_BYTES,
	parseBackup,
	planMerge,
	planReplace,
	type MergePlan,
	type ReplacePlan,
	type Syncable
} from '@tran/core';
import { listBackupTables } from './backup-registry';
import type { TranDb } from './db';
import { META, getMeta, setMeta } from './meta';

/** The vault's exact-value list. Only the export scan uses it. */
export interface KnownSecretsSource {
	knownSecrets(): string[];
}

/** Each secret as written raw and as it appears inside a JSON string (quotes/backslashes escaped). */
function scanForms(secrets: readonly string[]): string[] {
	const out = new Set<string>();
	for (const s of secrets) {
		out.add(s);
		out.add(JSON.stringify(s).slice(1, -1));
	}
	return [...out];
}

/** Reads every registered table (tombstones included, so deletions survive a merge). */
async function readRegisteredTables(db: TranDb): Promise<Record<string, Syncable[]>> {
	const tables: Record<string, Syncable[]> = {};
	for (const { name } of listBackupTables()) {
		tables[name] = await db.table<Syncable>(name).toArray();
	}
	return tables;
}

/** Copy of `row` with the value at a dot path blanked (missing or non-object parents: unchanged). */
function blankPath(row: unknown, path: readonly string[]): unknown {
	if (path.length === 0 || row === null || typeof row !== 'object' || Array.isArray(row))
		return row;
	const [head, ...rest] = path as [string, ...string[]];
	if (!Object.hasOwn(row, head)) return row;
	const value = (row as Record<string, unknown>)[head];
	return { ...row, [head]: rest.length === 0 ? '' : blankPath(value, rest) };
}

/**
 * The text the key scan reads: every registered table, with only the registry's declared
 * scanExemptPaths blanked (Phase 8: the agent logo bytes and the public Web3Forms key).
 */
function scanText(tables: Record<string, Syncable[]>): string {
	const view: Record<string, unknown[]> = {};
	for (const t of listBackupTables()) {
		const rows = tables[t.name] ?? [];
		const paths = (t.scanExemptPaths ?? []).map((p) => p.split('.'));
		view[t.name] =
			paths.length === 0 ? rows : rows.map((r) => paths.reduce(blankPath, r as unknown));
	}
	return JSON.stringify(view, null, 2);
}

/**
 * Builds the backup JSON text. Throws BackupError('key-material') before any file can exist if the
 * text holds anything key-shaped or any exact known secret.
 */
export async function buildBackupText(
	db: TranDb,
	o: { now: Date; knownSecrets: readonly string[] }
): Promise<{ text: string; filename: string; counts: Record<string, number> }> {
	const tables = await readRegisteredTables(db);
	const text = JSON.stringify(buildEnvelope(tables, o.now), null, 2);
	if (findKeyMaterial(scanText(tables), scanForms(o.knownSecrets)).length > 0) {
		throw new BackupError('key-material');
	}
	const counts: Record<string, number> = {};
	for (const [name, recs] of Object.entries(tables)) counts[name] = recs.length;
	return { text, filename: backupFilename(o.now), counts };
}

/** Same-origin blob download via <a download> (no CSP change needed). Browser only. */
export function downloadJson(text: string, filename: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
	const a = Object.assign(document.createElement('a'), { href: url, download: filename });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Builds, scans and downloads a backup. lastBackupAt is recorded only after the download call
 * returns; a blocked or failed export changes nothing.
 */
export async function exportBackup(
	db: TranDb,
	vault: KnownSecretsSource,
	o: { now?: Date; download?: typeof downloadJson } = {}
): Promise<{ filename: string }> {
	const now = o.now ?? new Date();
	const download = o.download ?? downloadJson;
	try {
		const { text, filename } = await buildBackupText(db, {
			now,
			knownSecrets: vault.knownSecrets()
		});
		download(text, filename);
		await setMeta(db, META.lastBackupAt, now.toISOString());
		return { filename };
	} catch (err) {
		if (err instanceof BackupError) throw err;
		throw new BackupError('export-failed');
	}
}

// ---------------------------------------------------------------- import

/** The subset of File the import needs (tests pass a plain object). */
export interface BackupFileLike {
	readonly name: string;
	readonly size: number;
	text(): Promise<string>;
}

export interface ImportPreview {
	fileName: string;
	exportedAt: string;
	schemaVersion: number;
	migratedFrom: number | null;
	merge: MergePlan;
	replace: ReplacePlan;
	/** Registered table names at preview time, in display order. */
	tables: readonly string[];
	/** The validated (and migrated) file records; apply re-plans against them in its transaction. */
	incoming: Record<string, Syncable[]>;
}

export type ImportResult =
	| { mode: 'merge'; added: number; updated: number; unchanged: number }
	| { mode: 'replace'; total: number; fileName: string };

/**
 * Reads, validates and dry-runs a backup file. The 25 MB limit is checked on `file.size` BEFORE
 * the file is read, so an oversized file is never loaded into memory.
 */
export async function previewImport(db: TranDb, file: BackupFileLike): Promise<ImportPreview> {
	if (file.size > MAX_BACKUP_BYTES) throw new BackupError('too-large');
	const tables = listBackupTables();
	const names = tables.map((t) => t.name);
	let text: string;
	try {
		text = await file.text();
	} catch {
		throw new BackupError('not-json');
	}
	const { envelope, migratedFrom } = parseBackup(text, { registeredTables: names });
	const incoming = envelope.tables as Record<string, Syncable[]>;
	// Tables registered with a record schema (Phase 7+) reject the whole file on any invalid row,
	// so a hand-edited backup can never write an impossible record (e.g. negative cents).
	for (const t of tables) {
		if (t.schema && (incoming[t.name] ?? []).some((r) => !t.schema!.safeParse(r).success)) {
			throw new BackupError('invalid');
		}
	}
	let local: Record<string, Syncable[]>;
	try {
		local = await readRegisteredTables(db);
	} catch {
		throw new BackupError('write-failed');
	}
	return {
		fileName: file.name,
		exportedAt: envelope.exportedAt,
		schemaVersion: envelope.schemaVersion,
		migratedFrom,
		merge: planMerge(local, incoming, tables),
		replace: planReplace(local, incoming, tables),
		tables: names,
		incoming
	};
}

/** Walks Dexie's wrapper chain (inner / cause / BulkError failures) for a QuotaExceededError. */
function isQuotaExceeded(err: unknown): boolean {
	const seen = new Set<unknown>();
	const queue: unknown[] = [err];
	while (queue.length > 0 && seen.size < 10) {
		const e = queue.shift();
		if (!e || typeof e !== 'object' || seen.has(e)) continue;
		seen.add(e);
		if ((e as { name?: unknown }).name === 'QuotaExceededError') return true;
		const w = e as { inner?: unknown; cause?: unknown; failures?: unknown };
		queue.push(w.inner, w.cause);
		if (Array.isArray(w.failures)) queue.push(...w.failures);
	}
	return false;
}

/**
 * Applies a previewed import in ONE read-write transaction over every registered table plus
 * `meta`: any failure part-way rolls every table back. The plan is recomputed inside the
 * transaction against the then-current records, so an edit made between preview and confirm can
 * never be overwritten by a stale plan (merge keeps "local wins ties").
 * Replace = clear() every registered table, then bulkPut the file's live records.
 * Merge = bulkPut the added and newer records. lastBackupAt is never touched by an import.
 * The persistence request is NOT made here: the UI calls requestPersistence() synchronously in
 * the confirm click handler.
 */
export async function applyImport(
	db: TranDb,
	preview: ImportPreview,
	mode: 'merge' | 'replace'
): Promise<ImportResult> {
	const tables = listBackupTables();
	const names = tables.map((t) => t.name);
	if (names.length !== preview.tables.length || names.some((n, i) => n !== preview.tables[i])) {
		throw new BackupError('invalid');
	}
	try {
		return await db.transaction('rw', [...names, 'meta'], async () => {
			const local: Record<string, Syncable[]> = {};
			for (const name of names) local[name] = await db.table<Syncable>(name).toArray();

			let result: ImportResult;
			if (mode === 'replace') {
				const plan = planReplace(local, preview.incoming, tables);
				for (const name of names) await db.table(name).clear();
				for (const name of names) await db.table(name).bulkPut(plan.writes[name] ?? []);
				result = { mode, total: plan.totals.add, fileName: preview.fileName };
			} else {
				const plan = planMerge(local, preview.incoming, tables);
				for (const name of names) await db.table(name).bulkPut(plan.writes[name] ?? []);
				const { add, update, unchanged } = plan.totals;
				result = { mode, added: add, updated: update, unchanged };
			}

			if ((await getMeta(db, META.firstRecordAt)) === undefined) {
				for (const name of names) {
					const live = await db
						.table<Syncable>(name)
						.filter((r) => r.deletedAt === undefined)
						.first();
					if (live) {
						await setMeta(db, META.firstRecordAt, new Date().toISOString());
						break;
					}
				}
			}
			return result;
		});
	} catch (err) {
		if (err instanceof BackupError) throw err;
		if (isQuotaExceeded(err)) throw new BackupError('out-of-space');
		throw new BackupError('write-failed');
	}
}
