// Synthetic Tran backup files for the backup E2E (03-13). Only fictional `prefs` records; no key
// literals live here (key-shaped values are built at runtime by tests/support/fake-keys.ts).

export interface MakeBackupOptions {
	/** Number of live prefs records. */
	prefs: number;
	/** Envelope schemaVersion. Default 1. */
	schemaVersion?: number;
	/** Envelope exportedAt. Default a fixed ISO date. */
	exportedAt?: string;
	/** Adds an extra (unregistered) table with one record. */
	extraTable?: string;
	/** Marks the last N prefs records as tombstones (deletedAt set). */
	tombstones?: number;
	/** Shifts record ids/keys so two files describe different records. Default 0. */
	idOffset?: number;
	/** ownerId for every record. Default 'local' ('remote' makes the file invalid). */
	ownerId?: string;
	/** Overrides the value of record 0 (e.g. a planted key for the export-refusal test). */
	firstValue?: unknown;
}

const STAMP = '2026-10-01T12:00:00.000Z';

export function recordId(i: number): string {
	return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
}

export function makeBackup(o: MakeBackupOptions): string {
	const offset = o.idOffset ?? 0;
	const tombstones = o.tombstones ?? 0;
	const prefs = Array.from({ length: o.prefs }, (_, n) => {
		const i = n + offset;
		return {
			id: recordId(i),
			ownerId: o.ownerId ?? 'local',
			createdAt: STAMP,
			updatedAt: STAMP,
			schemaVersion: 1,
			key: `test.pref.${i}`,
			value: n === 0 && o.firstValue !== undefined ? o.firstValue : `v${i}`,
			...(n >= o.prefs - tombstones && { deletedAt: STAMP })
		};
	});
	const tables: Record<string, unknown[]> = { prefs };
	if (o.extraTable) {
		tables[o.extraTable] = [
			{
				id: recordId(900000),
				ownerId: 'local',
				createdAt: STAMP,
				updatedAt: STAMP,
				schemaVersion: 1
			}
		];
	}
	return JSON.stringify({
		format: 'tran-backup-v1',
		schemaVersion: o.schemaVersion ?? 1,
		app: 'Tran Real Estate Tools',
		exportedAt: o.exportedAt ?? STAMP,
		tables
	});
}

export interface FilePayload {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

/** A setInputFiles payload. */
export function fileFrom(text: string | Buffer, name = 'tran-backup-2026-10-04.json'): FilePayload {
	return {
		name,
		mimeType: 'application/json',
		buffer: typeof text === 'string' ? Buffer.from(text) : text
	};
}
