import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BackupError,
	MAX_BACKUP_BYTES,
	backupFilename,
	buildEnvelope,
	newSyncable,
	parseBackup,
	planMerge,
	planReplace,
	tombstone,
	touch,
	type Syncable
} from '@tran/core';
import { fakeKey } from '../../../tests/support/fake-keys';
import { freshIdb } from '$lib/storage/test-utils';
import { _resetBackupRegistry, listBackupTables, registerBackupTable } from './backup-registry';
import { TranDb, type DbOptions, type PrefRecord } from './db';
import { META, getMeta, setMeta } from './meta';
import {
	applyImport,
	buildBackupText,
	exportBackup,
	previewImport,
	type BackupFileLike
} from './backup';

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
	vi.restoreAllMocks();
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
		vi.spyOn(db, 'table').mockImplementation(() => {
			throw new Error('disk on fire');
		});
		const download = vi.fn();
		await expectCode(exportBackup(db, noSecrets, { now: NOW, download }), 'export-failed');
		expect(download).not.toHaveBeenCalled();
		expect(await getMeta(db, META.lastBackupAt)).toBeUndefined();
	});
});

// ---------------------------------------------------------------- import

const LATER = new Date('2026-10-02T09:00:00.000Z');

function fileLike(text: string, size = new TextEncoder().encode(text).length, name = 'b.json') {
	const textSpy = vi.fn(async () => text);
	const file: BackupFileLike = { name, size, text: textSpy };
	return { file, text: textSpy };
}

function backupText(tables: Record<string, Syncable[]>, now = LATER): string {
	return JSON.stringify(buildEnvelope(tables, now), null, 2);
}

async function snapshot(): Promise<PrefRecord[]> {
	return (await db.prefs.toArray()).sort((a, b) => a.id.localeCompare(b.id));
}

/** Wraps db.table('prefs') so bulkPut really writes, then throws (a failure part-way). */
function failPrefsBulkPut(error: unknown = new Error('boom')) {
	const real = db.table.bind(db);
	vi.spyOn(db, 'table').mockImplementation(((name: string) => {
		const t = real(name);
		if (name !== 'prefs') return t;
		return Object.assign(Object.create(t) as typeof t, {
			bulkPut: async (recs: readonly unknown[]) => {
				await t.bulkPut(recs as never);
				throw error;
			}
		});
	}) as typeof db.table);
}

describe('previewImport', () => {
	it('over 25 MB -> too-large and file.text() is never called', async () => {
		const { file, text } = fileLike('{}', MAX_BACKUP_BYTES + 1);
		await expectCode(previewImport(db, file), 'too-large');
		expect(text).not.toHaveBeenCalled();
	});

	it('exactly 25 MB is allowed through to parsing', async () => {
		const { file, text } = fileLike('{', MAX_BACKUP_BYTES);
		await expectCode(previewImport(db, file), 'not-json');
		expect(text).toHaveBeenCalledTimes(1);
	});

	it('maps parse failures to their codes', async () => {
		await expectCode(previewImport(db, fileLike('{').file), 'not-json');
		await expectCode(previewImport(db, fileLike('{"format":"x"}').file), 'not-tran');
		const newer = { ...buildEnvelope({ prefs: [] }, LATER), schemaVersion: 99 };
		await expectCode(previewImport(db, fileLike(JSON.stringify(newer)).file), 'newer');
		const bad = buildEnvelope({ prefs: [{ id: 'not-a-uuid' } as unknown as Syncable] }, LATER);
		await expectCode(previewImport(db, fileLike(JSON.stringify(bad)).file), 'invalid');
	});

	it('a table this build does not know -> invalid', async () => {
		const other = buildEnvelope({ prefs: [], notes: [] }, LATER);
		await expectCode(previewImport(db, fileLike(JSON.stringify(other)).file), 'invalid');
	});

	it('returns counts equal to planMerge/planReplace against the current DB', async () => {
		const a = pref('a', 1);
		const b = pref('b', 2);
		await db.prefs.bulkPut([a, b]);
		const bNewer = touch({ ...b, value: 3 }, LATER);
		const c = pref('c', 4, LATER);
		const text = backupText({ prefs: [bNewer, c] });

		const p = await previewImport(db, fileLike(text, undefined, 'my.json').file);
		const tables = listBackupTables();
		const incoming = { prefs: [bNewer, c] };
		const local = { prefs: await db.prefs.toArray() };
		expect(p.fileName).toBe('my.json');
		expect(p.exportedAt).toBe(LATER.toISOString());
		expect(p.schemaVersion).toBe(1);
		expect(p.migratedFrom).toBeNull();
		expect(p.tables).toEqual(['prefs']);
		expect(p.merge).toEqual(planMerge(local, incoming, tables));
		expect(p.replace).toEqual(planReplace(local, incoming, tables));
		expect(p.merge.totals).toEqual({ add: 1, update: 1, unchanged: 2 });
		expect(p.replace.totals).toEqual({ delete: 2, add: 2 });
	});
});

describe('applyImport', () => {
	it('merge writes add + update; re-merging the same file changes nothing', async () => {
		const a = pref('a', 1);
		const b = pref('b', 2);
		await db.prefs.bulkPut([a, b]);
		const bNewer = touch({ ...b, value: 3 }, LATER);
		const c = pref('c', 4, LATER);
		const text = backupText({ prefs: [bNewer, c] });

		const res = await applyImport(db, await previewImport(db, fileLike(text).file), 'merge');
		expect(res).toEqual({ mode: 'merge', added: 1, updated: 1, unchanged: 2 });
		expect(await snapshot()).toEqual([a, bNewer, c].sort((x, y) => x.id.localeCompare(y.id)));

		const after = await snapshot();
		const again = await previewImport(db, fileLike(text).file);
		expect(again.merge.noChanges).toBe(true);
		const res2 = await applyImport(db, again, 'merge');
		expect(res2).toEqual({ mode: 'merge', added: 0, updated: 0, unchanged: 3 });
		expect(await snapshot()).toEqual(after);
	});

	it('merge applies an incoming tombstone to a local record', async () => {
		const a = pref('a', 1);
		await db.prefs.put(a);
		const dead = tombstone(a, LATER);
		const preview = await previewImport(db, fileLike(backupText({ prefs: [dead] })).file);
		await applyImport(db, preview, 'merge');
		expect((await db.prefs.get(a.id))?.deletedAt).toBe(LATER.toISOString());
	});

	it("replace leaves exactly the file's live items in every registered table", async () => {
		db.close();
		db = new TestDb(freshIdb());
		await db.open();
		registerBackupTable({ name: 'notes', label: 'Notes' });
		await db.prefs.bulkPut([pref('a', 1), pref('b', 2)]);
		await db.table('notes').put(newSyncable({ id: id(), now: NOW, schemaVersion: 1 }));

		const c = pref('c', 3, LATER);
		const gone = tombstone(pref('d', 4), LATER);
		const note = { ...newSyncable({ id: id(), now: LATER, schemaVersion: 1 }), body: 'x' };
		const text = backupText({ prefs: [c, gone], notes: [note] });

		const preview = await previewImport(db, fileLike(text, undefined, 'r.json').file);
		const res = await applyImport(db, preview, 'replace');
		expect(res).toEqual({ mode: 'replace', total: 2, fileName: 'r.json' });
		expect(await db.prefs.toArray()).toEqual([c]);
		expect(await db.table('notes').toArray()).toEqual([note]);
	});

	for (const mode of ['merge', 'replace'] as const) {
		it(`${mode}: a failure part-way rolls every table back (write-failed)`, async () => {
			await db.prefs.bulkPut([pref('a', 1), pref('b', 2)]);
			const before = await snapshot();
			const text = backupText({ prefs: [pref('c', 3, LATER), pref('d', 4, LATER)] });
			const preview = await previewImport(db, fileLike(text).file);

			failPrefsBulkPut();
			await expectCode(applyImport(db, preview, mode), 'write-failed');
			vi.restoreAllMocks();
			expect(await snapshot()).toEqual(before);
			expect(await getMeta(db, META.firstRecordAt)).toBeUndefined();
		});
	}

	it('QuotaExceededError inside the transaction -> out-of-space', async () => {
		const text = backupText({ prefs: [pref('c', 3, LATER)] });
		const preview = await previewImport(db, fileLike(text).file);
		failPrefsBulkPut(new DOMException('full', 'QuotaExceededError'));
		await expectCode(applyImport(db, preview, 'replace'), 'out-of-space');
		vi.restoreAllMocks();
		expect(await db.prefs.count()).toBe(0);
	});

	it('Dexie-wrapped QuotaExceededError (inner) -> out-of-space', async () => {
		const text = backupText({ prefs: [pref('c', 3, LATER)] });
		const preview = await previewImport(db, fileLike(text).file);
		const wrapped = Object.assign(new Error('AbortError'), {
			name: 'AbortError',
			inner: new DOMException('full', 'QuotaExceededError')
		});
		failPrefsBulkPut(wrapped);
		await expectCode(applyImport(db, preview, 'merge'), 'out-of-space');
	});

	it('sets firstRecordAt when absent; never touches lastBackupAt', async () => {
		const text = backupText({ prefs: [pref('c', 3, LATER)] });
		await applyImport(db, await previewImport(db, fileLike(text).file), 'merge');
		expect(await getMeta<string>(db, META.firstRecordAt)).toEqual(expect.any(String));
		expect(await getMeta(db, META.lastBackupAt)).toBeUndefined();
	});

	it('keeps an existing firstRecordAt', async () => {
		const first = '2026-01-01T00:00:00.000Z';
		await setMeta(db, META.firstRecordAt, first);
		const text = backupText({ prefs: [pref('c', 3, LATER)] });
		await applyImport(db, await previewImport(db, fileLike(text).file), 'replace');
		expect(await getMeta<string>(db, META.firstRecordAt)).toBe(first);
	});

	it('does not set firstRecordAt when the result holds no live record', async () => {
		const text = backupText({ prefs: [] });
		await applyImport(db, await previewImport(db, fileLike(text).file), 'replace');
		expect(await getMeta(db, META.firstRecordAt)).toBeUndefined();
	});

	it('refuses a preview whose table set differs from the current registry (invalid)', async () => {
		const preview = await previewImport(db, fileLike(backupText({ prefs: [] })).file);
		registerBackupTable({ name: 'notes', label: 'Notes' });
		await expectCode(applyImport(db, preview, 'merge'), 'invalid');
	});
});
