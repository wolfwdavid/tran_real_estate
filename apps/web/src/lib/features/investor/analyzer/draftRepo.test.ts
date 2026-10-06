// Working-draft autosave (07-12, INV-01/INV-02): the single investorDraft row, the 500ms autosaver
// and the saved-snapshot comparison behind the "Unsaved changes" badge. fake-indexeddb with a fresh
// IDBFactory per test; the autosaver gets an injected fake timer (never vi.useFakeTimers with Dexie).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { _resetBackupRegistry } from '$lib/storage/backup-registry';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import { TranDb } from '$lib/storage/db';
import { looseRecordSchema } from '../deals/schema';
import { createAutosaver, createDraftRepo, DRAFT_ID, type DraftInput } from './draftRepo';
import { dealSnapshot, EMPTY_SNAPSHOT, formToDealData, isUnsaved } from './deal-data';
import { defaultForm, type AnalyzerForm } from './form-model';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const dbs: TranDb[] = [];
afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
	_resetBackupRegistry();
});

function openDb(factory = new IDBFactory()) {
	const db = new TranDb({ indexedDB: factory, IDBKeyRange }, `t-${crypto.randomUUID()}`);
	dbs.push(db);
	return db;
}

const typed = (patch: Partial<AnalyzerForm> = {}): AnalyzerForm => ({
	...defaultForm(),
	price: '200,000',
	rent: '2,000',
	...patch
});

const draft = (patch: Partial<DraftInput> = {}): DraftInput => ({
	dealId: null,
	form: typed(),
	sources: { price: { source: 'sample' } },
	savedSnapshot: null,
	...patch
});

describe('draft repo', () => {
	it('writeDraft then readDraft returns the same form, sources and dealId', async () => {
		const repo = createDraftRepo(openDb(), { now: () => new Date(T0) });
		const d = draft({ dealId: 'abc', form: typed({ name: 'Elm St' }), savedSnapshot: 'x' });
		await repo.writeDraft(d);
		const back = await repo.readDraft();
		expect(back).not.toBeNull();
		expect(back!.id).toBe(DRAFT_ID);
		expect(back!.form).toEqual(d.form);
		expect(back!.sources).toEqual(d.sources);
		expect(back!.dealId).toBe('abc');
		expect(back!.savedSnapshot).toBe('x');
		expect(back!.updatedAt).toBe(new Date(T0).toISOString());
	});

	it('keeps a single row (fixed id) across writes', async () => {
		const db = openDb();
		const repo = createDraftRepo(db);
		await repo.writeDraft(draft());
		await repo.writeDraft(draft({ form: typed({ rent: '2,100' }) }));
		expect(await db.investorDraft.count()).toBe(1);
		expect((await repo.readDraft())!.form.rent).toBe('2,100');
	});

	it('clearDraft -> readDraft null', async () => {
		const repo = createDraftRepo(openDb());
		await repo.writeDraft(draft());
		await repo.clearDraft();
		expect(await repo.readDraft()).toBeNull();
	});

	it('the stored row is a valid Phase 3 Syncable (uuid id, ISO stamps, no deletedAt)', async () => {
		const db = openDb();
		await createDraftRepo(db, { now: () => new Date(T0) }).writeDraft(draft());
		const row = await db.investorDraft.get(DRAFT_ID);
		expect(looseRecordSchema.safeParse(row).success).toBe(true);
		expect(row).not.toHaveProperty('deletedAt');
	});

	it('keeps createdAt on later writes and moves updatedAt', async () => {
		const db = openDb();
		let t = T0;
		const repo = createDraftRepo(db, { now: () => new Date(t) });
		await repo.writeDraft(draft());
		t = T0 + 60_000;
		await repo.writeDraft(draft());
		const row = await db.investorDraft.get(DRAFT_ID);
		expect(row!.createdAt).toBe(new Date(T0).toISOString());
		expect(row!.updatedAt).toBe(new Date(T0 + 60_000).toISOString());
	});

	it('a malformed or tombstoned row reads as no draft; missing form keys get defaults', async () => {
		const db = openDb();
		const repo = createDraftRepo(db);
		const base = {
			id: DRAFT_ID,
			ownerId: 'local',
			createdAt: '2026-10-15T12:00:00.000Z',
			updatedAt: '2026-10-15T12:00:00.000Z',
			schemaVersion: 1
		};
		await db.investorDraft.put({ ...base, form: 'nope' } as never);
		expect(await repo.readDraft()).toBeNull();
		await db.investorDraft.put({
			...base,
			deletedAt: '2026-10-15T12:00:00.000Z',
			form: typed()
		} as never);
		expect(await repo.readDraft()).toBeNull();
		await db.investorDraft.put({ ...base, form: { price: '1', rent: '2' } } as never);
		const back = await repo.readDraft();
		expect(back!.form).toEqual({ ...defaultForm(), price: '1', rent: '2' });
		expect(back!.dealId).toBeNull();
		expect(back!.sources).toEqual({});
		expect(back!.savedSnapshot).toBeNull();
	});

	it('round-trips through a backup export and import', async () => {
		const src = openDb();
		await createDraftRepo(src).writeDraft(draft({ form: typed({ name: 'Backup me' }) }));
		const { text } = await buildBackupText(src, { now: new Date(T0), knownSecrets: [] });
		const dst = openDb();
		const file = { name: 'tran-backup.json', size: text.length, text: async () => text };
		const preview = await previewImport(dst, file as never);
		await applyImport(dst, preview, 'replace');
		expect((await createDraftRepo(dst).readDraft())!.form.name).toBe('Backup me');
	});
});

describe('createAutosaver', () => {
	function fakeTimers() {
		let nextId = 1;
		const timers = new Map<number, { at: number; fn: () => void }>();
		let now = 0;
		const setTimer = ((fn: () => void, ms: number) => {
			const id = nextId++;
			timers.set(id, { at: now + ms, fn });
			return id;
		}) as unknown as typeof setTimeout;
		const clearTimer = ((id: number) => void timers.delete(id)) as unknown as typeof clearTimeout;
		const advance = (ms: number) => {
			now += ms;
			for (const [id, t] of [...timers]) {
				if (t.at <= now) {
					timers.delete(id);
					t.fn();
				}
			}
		};
		return { setTimer, clearTimer, advance, pending: () => timers.size };
	}

	it('three schedules within 500ms -> exactly one write, with the LAST draft', async () => {
		const t = fakeTimers();
		const write = vi.fn(async () => {});
		const saver = createAutosaver(write, t);
		saver.schedule(draft({ form: typed({ rent: '1' }) }));
		t.advance(200);
		saver.schedule(draft({ form: typed({ rent: '2' }) }));
		t.advance(200);
		saver.schedule(draft({ form: typed({ rent: '3' }) }));
		t.advance(499);
		expect(write).not.toHaveBeenCalled();
		t.advance(1);
		expect(write).toHaveBeenCalledTimes(1);
		expect(write.mock.calls[0]).toEqual([draft({ form: typed({ rent: '3' }) })]);
	});

	it('flush() writes immediately and cancels the timer', async () => {
		const t = fakeTimers();
		const write = vi.fn(async () => {});
		const saver = createAutosaver(write, t);
		saver.schedule(draft());
		await saver.flush();
		expect(write).toHaveBeenCalledTimes(1);
		expect(t.pending()).toBe(0);
		await saver.flush();
		expect(write).toHaveBeenCalledTimes(1);
	});

	it('cancel() drops the pending draft', () => {
		const t = fakeTimers();
		const write = vi.fn(async () => {});
		const saver = createAutosaver(write, t);
		saver.schedule(draft());
		saver.cancel();
		t.advance(1000);
		expect(write).not.toHaveBeenCalled();
	});

	it('a failed write is reported, not thrown', async () => {
		const t = fakeTimers();
		const onError = vi.fn();
		const saver = createAutosaver(
			async () => {
				throw new Error('quota');
			},
			{ ...t, onError }
		);
		saver.schedule(draft());
		t.advance(500);
		await Promise.resolve();
		await Promise.resolve();
		expect(onError).toHaveBeenCalledTimes(1);
	});

	it('defaults to a 500ms delay', () => {
		const t = fakeTimers();
		const write = vi.fn(async () => {});
		const saver = createAutosaver(write, { setTimer: t.setTimer, clearTimer: t.clearTimer });
		saver.schedule(draft());
		t.advance(499);
		expect(write).not.toHaveBeenCalled();
		t.advance(1);
		expect(write).toHaveBeenCalledTimes(1);
	});
});

describe('saved snapshot and deal data', () => {
	it('formatting differences do not count as changes', () => {
		expect(dealSnapshot(typed({ price: '200000' }))).toBe(dealSnapshot(typed()));
	});

	it('any typed value on a fresh form is unsaved; matching the snapshot is saved', () => {
		expect(dealSnapshot(defaultForm())).toBe(EMPTY_SNAPSHOT);
		expect(isUnsaved(defaultForm(), null)).toBe(false);
		expect(isUnsaved({ ...defaultForm(), price: '5' }, null)).toBe(true);
		expect(isUnsaved({ ...defaultForm(), name: 'x' }, null)).toBe(true);
		const snap = dealSnapshot(typed());
		expect(isUnsaved(typed(), snap)).toBe(false);
		expect(isUnsaved(typed({ rent: '2,100' }), snap)).toBe(true);
		expect(isUnsaved(typed({ bedrooms: '3' }), snap)).toBe(true);
	});

	it('formToDealData: name falls back to the address, then "Untitled deal"; numbers parsed', () => {
		const a = formToDealData(
			typed({ address: ' 1 Elm St ', bedrooms: '3', bathrooms: '1.5', squareFeet: '1,450' }),
			{}
		);
		expect(a!.name).toBe('1 Elm St');
		expect(a!.address).toBe('1 Elm St');
		expect([a!.bedrooms, a!.bathrooms, a!.squareFeet]).toEqual([3, 1.5, 1450]);
		expect(a!.propertyType).toBeNull();
		expect(formToDealData(typed(), {})!.name).toBe('Untitled deal');
		expect(formToDealData(typed({ name: ' Duplex ', propertyType: 'condo' }), {})).toMatchObject({
			name: 'Duplex',
			propertyType: 'condo'
		});
		expect(formToDealData(defaultForm(), {})).toBeNull();
	});
});
