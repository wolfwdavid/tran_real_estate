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
	type Syncable
} from '@tran/core';
import { listBackupTables } from './backup-registry';
import type { TranDb } from './db';
import { META, setMeta } from './meta';

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
	if (findKeyMaterial(text, scanForms(o.knownSecrets)).length > 0) {
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
