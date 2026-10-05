import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupError, backupFilename, newSyncable, parseBackup, tombstone } from '@tran/core';
import { fakeKey } from '../../../tests/support/fake-keys';
import { freshIdb } from '$lib/storage/test-utils';
import { _resetBackupRegistry, listBackupTables, registerBackupTable } from './backup-registry';
import { TranDb, type DbOptions, type PrefRecord } from './db';
import { META, getMeta, setMeta } from './meta';
import { buildBackupText, exportBackup } from './backup';

const NOW = new Date('2026-10-01T12:00:00.000Z');

/** Test-only database with one extra user-data table, to prove export follows the registry. */
class TestDb extends TranDb {
	constructor(options?: DbOptions) {
		super(options);
		this.version(2).stores({ notes: 'id, updatedAt' });
	}
}

let n = 0;
function id(): string {
	return `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function pref(key: string, value: unknown, now = NOW): PrefRecord {
	return { ...newSyncable({ id: id(), now, schemaVersion: 1 }), key, value };
}

const noSecrets = { knownSecrets: () => [] as string[] };

let db: TranDb;

beforeEach(async () => {
	n = 0;
	_resetBackupRegistry();
	db = new TranDb(freshIdb());
	await db.open();
});

afterEach(() => {
	db.close();
	_resetBackupRegistry();
});

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
	const err = await p.then(
		() => undefined,
		(e: unknown) => e
	);
	expect(err).toBeInstanceOf(BackupError);
	expect((err as BackupError).code).toBe(code);
	expect((err as BackupError).message).toBe(code);
}

describe('buildBackupText', () => {
	it('empty DB -> a valid tran-backup-v1 file with { prefs: [] } and the dated filename', async () => {
		const out = await buildBackupText(db, { now: NOW, knownSecrets: [] });
		expect(out.filename).toBe(backupFilename(NOW));
		expect(out.counts).toEqual({ prefs: 0 });
		const parsed = parseBackup(out.text, { registeredTables: ['prefs'] });
		expect(parsed.envelope.tables).toEqual({ prefs: [] });
		expect(parsed.envelope.exportedAt).toBe(NOW.toISOString());
		expect(parsed.migratedFrom).toBeNull();
	});

	it('table names equal the registry exactly (never meta) and include tombstones', async () => {
		const live = pref('theme', 'light');
		const dead = tombstone(pref('density', 'compact'), new Date('2026-10-01T13:00:00.000Z'));
		await db.prefs.bulkPut([live, dead]);
		await setMeta(db, META.firstRecordAt, NOW.toISOString());

		const out = await buildBackupText(db, { now: NOW, knownSecrets: [] });
		const env = JSON.parse(out.text) as { tables: Record<string, PrefRecord[]> };
		expect(Object.keys(env.tables)).toEqual(listBackupTables().map((t) => t.name));
		expect(Object.keys(env.tables)).not.toContain('meta');
		expect(env.tables.prefs).toHaveLength(2);
		expect(env.tables.prefs.find((r) => r.id === dead.id)?.deletedAt).toBe(dead.deletedAt);
		expect(out.text).not.toContain(META.firstRecordAt);
	});

	it('exports a newly registered table', async () => {
		db.close();
		db = new TestDb(freshIdb());
		await db.open();
		registerBackupTable({ name: 'notes', label: 'Notes' });
		const note = { ...newSyncable({ id: id(), now: NOW, schemaVersion: 1 }), body: 'call back' };
		await db.table('notes').put(note);

		const out = await buildBackupText(db, { now: NOW, knownSecrets: [] });
		const env = JSON.parse(out.text) as { tables: Record<string, unknown[]> };
		expect(Object.keys(env.tables)).toEqual(['prefs', 'notes']);
		expect(env.tables.notes).toEqual([note]);
		expect(out.counts).toEqual({ prefs: 0, notes: 1 });
	});

	it('a key-shaped value -> key-material', async () => {
		await db.prefs.put(pref('note', `my key is ${fakeKey('anthropic')} ok`));
		await expectCode(buildBackupText(db, { now: NOW, knownSecrets: [] }), 'key-material');
	});

	it('an exact known secret (no key shape) -> key-material', async () => {
		const rc = fakeKey('rentcast');
		await db.prefs.put(pref('note', `x${rc}y`));
		// Shape scan alone does not catch it...
		await expect(buildBackupText(db, { now: NOW, knownSecrets: [] })).resolves.toBeDefined();
		// ...the exact-value check does.
		await expectCode(buildBackupText(db, { now: NOW, knownSecrets: [rc] }), 'key-material');
	});

	it('a known secret that JSON escapes (quote/backslash) is still caught', async () => {
		const odd = 'abc"def\\ghi-123456';
		await db.prefs.put(pref('note', odd));
		await expectCode(buildBackupText(db, { now: NOW, knownSecrets: [odd] }), 'key-material');
	});
});

describe('exportBackup', () => {
	it('success: downloads once, then records lastBackupAt, returns the filename', async () => {
		await db.prefs.put(pref('theme', 'dark'));
		const download = vi.fn();
		const res = await exportBackup(db, noSecrets, { now: NOW, download });
		expect(res).toEqual({ filename: backupFilename(NOW) });
		expect(download).toHaveBeenCalledTimes(1);
		const [text, filename] = download.mock.calls[0] as [string, string];
		expect(filename).toBe(backupFilename(NOW));
		expect(parseBackup(text, { registeredTables: ['prefs'] }).envelope.tables.prefs).toHaveLength(
			1
		);
		expect(await getMeta<string>(db, META.lastBackupAt)).toBe(NOW.toISOString());
	});

	it('planted key: never calls download and leaves lastBackupAt unchanged', async () => {
		const before = '2026-09-01T00:00:00.000Z';
		await setMeta(db, META.lastBackupAt, before);
		await db.prefs.put(pref('note', fakeKey('openai')));
		const download = vi.fn();
		await expectCode(exportBackup(db, noSecrets, { now: NOW, download }), 'key-material');
		expect(download).not.toHaveBeenCalled();
		expect(await getMeta<string>(db, META.lastBackupAt)).toBe(before);
	});

	it('vault value: uses vault.knownSecrets() and never calls download', async () => {
		const rc = fakeKey('rentcast', 'B');
		await db.prefs.put(pref('note', rc));
		const download = vi.fn();
		await expectCode(
			exportBackup(db, { knownSecrets: () => [rc] }, { now: NOW, download }),
			'key-material'
		);
		expect(download).not.toHaveBeenCalled();
		expect(await getMeta(db, META.lastBackupAt)).toBeUndefined();
	});

	it('download throws -> export-failed and lastBackupAt unchanged', async () => {
		const download = vi.fn(() => {
			throw new Error('blocked by browser');
		});
		await expectCode(exportBackup(db, noSecrets, { now: NOW, download }), 'export-failed');
		expect(await getMeta(db, META.lastBackupAt)).toBeUndefined();
	});

	it('unexpected read error -> export-failed (message is the code only)', async () => {
		vi.spyOn(db.prefs, 'toArray').mockRejectedValueOnce(new Error('disk on fire'));
		const download = vi.fn();
		await expectCode(exportBackup(db, noSecrets, { now: NOW, download }), 'export-failed');
		expect(download).not.toHaveBeenCalled();
		expect(await getMeta(db, META.lastBackupAt)).toBeUndefined();
	});
});
