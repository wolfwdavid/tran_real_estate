import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshIdb } from '$lib/storage/test-utils';
import { _resetBackupRegistry, registerBackupTable } from './backup-registry';
import { TranDb, type PrefRecord } from './db';
import { META, getMeta, readReminderInput, setMeta } from './meta';
import { createRepo } from './repo';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Deterministic clock: each call advances one minute from 2026-10-01T12:00:00Z. */
function clock(start = Date.parse('2026-10-01T12:00:00.000Z')) {
	let t = start;
	return () => {
		const d = new Date(t);
		t += 60_000;
		return d;
	};
}

/** Deterministic v4-shaped ids. */
function ids() {
	let n = 0;
	return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

let db: TranDb;

beforeEach(async () => {
	_resetBackupRegistry();
	db = new TranDb(freshIdb());
	await db.open();
});

afterEach(() => {
	db.close();
	_resetBackupRegistry();
});

function prefsRepo(now = clock(), uuid = ids()) {
	return createRepo<PrefRecord>(db, 'prefs', { schemaVersion: 1, now, uuid });
}

describe('createRepo put', () => {
	it('stamps a new Syncable record', async () => {
		const rec = await prefsRepo().put({ key: 'ui.density', value: 'comfortable' });
		expect(rec.id).toMatch(V4);
		expect(rec.ownerId).toBe('local');
		expect(rec.createdAt).toBe('2026-10-01T12:00:00.000Z');
		expect(rec.updatedAt).toBe(rec.createdAt);
		expect(rec.schemaVersion).toBe(1);
		expect(rec.deletedAt).toBeUndefined();
		expect(await db.prefs.get(rec.id)).toEqual(rec);
	});

	it('uses crypto.randomUUID by default', async () => {
		const repo = createRepo<PrefRecord>(db, 'prefs', { schemaVersion: 1 });
		const rec = await repo.put({ key: 'a', value: 1 });
		expect(rec.id).toMatch(V4);
	});

	it('keeps createdAt and advances updatedAt when re-saving an existing id', async () => {
		const repo = prefsRepo();
		const first = await repo.put({ key: 'ui.density', value: 'comfortable' });
		const second = await repo.put({ ...first, value: 'compact' });
		expect(second.id).toBe(first.id);
		expect(second.createdAt).toBe(first.createdAt);
		expect(second.updatedAt > first.updatedAt).toBe(true);
		expect(second.value).toBe('compact');
		expect(await db.prefs.count()).toBe(1);
	});

	it('writes firstRecordAt on the first put only', async () => {
		const repo = prefsRepo();
		expect(await getMeta(db, META.firstRecordAt)).toBeUndefined();
		const first = await repo.put({ key: 'a', value: 1 });
		expect(await getMeta(db, META.firstRecordAt)).toBe(first.createdAt);
		const second = await repo.put({ key: 'b', value: 2 });
		expect(second.createdAt).not.toBe(first.createdAt);
		expect(await getMeta(db, META.firstRecordAt)).toBe(first.createdAt);
	});
});

describe('createRepo remove / list / get', () => {
	it('tombstones on remove; list hides it unless includeDeleted; get still returns it', async () => {
		const repo = prefsRepo();
		const keep = await repo.put({ key: 'keep', value: true });
		const gone = await repo.put({ key: 'gone', value: true });
		await repo.remove(gone.id);

		const listed = await repo.list();
		expect(listed.map((r) => r.id)).toEqual([keep.id]);

		const all = await repo.list({ includeDeleted: true });
		expect(all.map((r) => r.id).sort()).toEqual([keep.id, gone.id].sort());

		const tomb = await repo.get(gone.id);
		expect(tomb?.deletedAt).toBeDefined();
		expect(tomb?.updatedAt).toBe(tomb?.deletedAt);
		expect(tomb?.createdAt).toBe(gone.createdAt);
	});

	it('remove of an unknown id is a no-op', async () => {
		await prefsRepo().remove('00000000-0000-4000-8000-999999999999');
		expect(await db.prefs.count()).toBe(0);
	});
});

describe('meta', () => {
	it('round-trips lastBackupAt and the snooze key', async () => {
		await setMeta(db, META.lastBackupAt, '2026-09-30T08:00:00.000Z');
		await setMeta(db, META.snoozedUntil, '2026-10-02T08:00:00.000Z');
		expect(META.snoozedUntil).toBe('backupReminderSnoozedUntil');
		expect(await getMeta<string>(db, META.lastBackupAt)).toBe('2026-09-30T08:00:00.000Z');
		expect(await getMeta<string>(db, META.snoozedUntil)).toBe('2026-10-02T08:00:00.000Z');
	});

	it('readReminderInput reports no records on an empty DB', async () => {
		const now = new Date('2026-10-04T00:00:00.000Z');
		expect(await readReminderInput(db, now)).toEqual({ now, hasRecords: false });
	});

	it('readReminderInput reflects live records and every meta field', async () => {
		const now = new Date('2026-10-04T00:00:00.000Z');
		const repo = prefsRepo();
		const rec = await repo.put({ key: 'a', value: 1 });
		await setMeta(db, META.lastBackupAt, '2026-09-30T08:00:00.000Z');
		await setMeta(db, META.snoozedUntil, '2026-10-05T08:00:00.000Z');
		expect(await readReminderInput(db, now)).toEqual({
			now,
			hasRecords: true,
			lastBackupAt: '2026-09-30T08:00:00.000Z',
			firstRecordAt: rec.createdAt,
			snoozedUntil: '2026-10-05T08:00:00.000Z'
		});
	});

	it('tombstoned records do not count as records', async () => {
		const repo = prefsRepo();
		const rec = await repo.put({ key: 'a', value: 1 });
		await repo.remove(rec.id);
		const input = await readReminderInput(db, new Date());
		expect(input.hasRecords).toBe(false);
	});

	it('ignores registered names that are not tables in this DB', async () => {
		registerBackupTable({ name: 'savedSearches', label: 'Saved searches' });
		await prefsRepo().put({ key: 'a', value: 1 });
		expect((await readReminderInput(db, new Date())).hasRecords).toBe(true);
	});
});
