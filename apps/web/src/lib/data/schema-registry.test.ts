// Schema/backup invariants across phases: Dexie versions only ever grow, and every table in the
// app database is either written to backups or deliberately excluded (never silently dropped).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildEnvelope, newSyncable, parseBackup, type Syncable } from '@tran/core';
import { BACKUP_EXCLUDED_TABLES, listBackupTables } from './platform';
import {
	DATA_PREF_IDS,
	DATA_RECORD_SCHEMA_VERSION,
	PHASE4_BACKUP_EXCLUDED,
	unregisteredTables
} from './tables';
import { T0, makeDb } from './testing/harness';

const dbSource = readFileSync(new URL('../storage/db.ts', import.meta.url), 'utf8');
const declared = [...dbSource.matchAll(/\.version\((\d+)\)/g)].map((m) => Number(m[1]));

const toClose: { close(): void }[] = [];
afterEach(() => {
	for (const db of toClose.splice(0)) db.close();
});

describe('Dexie schema versions', () => {
	it('are unique and strictly increasing in source order; the highest is the opened verno', async () => {
		expect(declared.length).toBeGreaterThan(1);
		expect(new Set(declared).size).toBe(declared.length);
		for (let i = 1; i < declared.length; i++) expect(declared[i]).toBeGreaterThan(declared[i - 1]);
		const db = makeDb();
		toClose.push(db);
		await db.open();
		expect(db.verno).toBe(Math.max(...declared));
	});
});

describe('backup coverage', () => {
	it('every DB table is backup-registered or in BACKUP_EXCLUDED_TABLES, never both', () => {
		const db = makeDb();
		toClose.push(db);
		const tables = db.tables.map((t) => t.name);
		const registered = listBackupTables().map((t) => t.name);
		expect(unregisteredTables(tables, registered, BACKUP_EXCLUDED_TABLES)).toEqual([]);
		for (const name of registered) expect(BACKUP_EXCLUDED_TABLES).not.toContain(name);
		for (const name of PHASE4_BACKUP_EXCLUDED) expect(BACKUP_EXCLUDED_TABLES).toContain(name);
		expect(registered).toEqual(
			expect.arrayContaining(['ledger', 'savedSearches', 'searchSnapshots', 'dataPrefs'])
		);
		expect(registered).not.toContain('apiCache');
	});

	it('unregisteredTables is not vacuous: a planted table is reported', () => {
		expect(unregisteredTables(['planted', 'ledger'], ['ledger'], [])).toEqual(['planted']);
		expect(unregisteredTables(['planted', 'apiCache'], [], ['planted', 'apiCache'])).toEqual([]);
	});

	it('Phase 4 backed-up rows pass the backup file validation (Syncable shape)', () => {
		const base = (id: string): Syncable =>
			newSyncable({ id, now: new Date(T0), schemaVersion: DATA_RECORD_SCHEMA_VERSION });
		const searchId = '00000000-0000-4000-8000-0000000000c1';
		const tables = {
			prefs: [],
			ledger: [
				{
					...base('00000000-0000-4000-8000-0000000000a1'),
					periodKey: '2026-10',
					at: T0,
					endpoint: 'properties',
					key: 'GET /properties',
					intent: 'user',
					status: 200,
					overCap: false,
					settledAt: T0
				}
			],
			savedSearches: [],
			searchSnapshots: [{ ...base(searchId), searchId, takenAt: T0, truncated: false, items: {} }],
			dataPrefs: [{ ...base(DATA_PREF_IDS.rentcastCap), key: 'rentcastCap', value: 40 }]
		};
		const text = JSON.stringify(buildEnvelope(tables as Record<string, Syncable[]>, new Date(T0)));
		const parsed = parseBackup(text, { registeredTables: listBackupTables().map((t) => t.name) });
		expect(parsed.envelope.tables.ledger).toHaveLength(1);
		expect(parsed.envelope.tables.searchSnapshots).toHaveLength(1);
		expect(parsed.envelope.tables.dataPrefs).toHaveLength(1);
	});
});
