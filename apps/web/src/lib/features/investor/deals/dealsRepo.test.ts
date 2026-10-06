// Phase 7 persistence (07-09, INV-02): the v5 Dexie tables, their backup registration and the deals
// repository (inputs-only records, tombstone delete that also tombstones memo drafts atomically).
// fake-indexeddb with a fresh IDBFactory per test and an injected clock (never fake timers).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { BackupError } from '@tran/core';
import {
	ANALYZER_VERSION,
	DEFAULT_CLOSING,
	DEFAULT_DOWN_BPS,
	DEFAULT_TERM_YEARS,
	defaultExpenseLines,
	type DealInputs
} from '@tran/core/finance';
import { createArtifactRepo } from '$lib/ai/storage/artifacts';
import {
	BACKUP_EXCLUDED_TABLES,
	listBackupTables,
	_resetBackupRegistry
} from '$lib/storage/backup-registry';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import { TranDb } from '$lib/storage/db';
import { createDealsRepo } from './dealsRepo';
import { dealRecordSchema, type DealData } from './schema';
import { INVESTOR_STORES } from './tables';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const MIN = 60_000;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const dbs: TranDb[] = [];
afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
	_resetBackupRegistry();
});

function openDb(factory = new IDBFactory(), name = `t-${crypto.randomUUID()}`) {
	const db = new TranDb({ indexedDB: factory, IDBKeyRange }, name);
	dbs.push(db);
	return { db, factory, name };
}

function setup() {
	const env = openDb();
	let now = T0;
	const clock = () => new Date(now);
	return {
		...env,
		repo: createDealsRepo(env.db, { now: clock }),
		artifacts: createArtifactRepo(env.db, { now: clock }),
		at: (t: number) => {
			now = t;
		}
	};
}

function inputs(o: Partial<DealInputs> = {}): DealInputs {
	return {
		priceCents: 20_000_000,
		closing: { ...DEFAULT_CLOSING },
		repairsCents: 0,
		financing: {
			kind: 'mortgage',
			downBps: DEFAULT_DOWN_BPS,
			annualRatePct: 7,
			termYears: DEFAULT_TERM_YEARS
		},
		rentCents: 200_000,
		otherIncomeCents: 0,
		expenses: defaultExpenseLines(),
		...o
	};
}

/** A synthetic deal (fictional address). */
function deal(name = '100 Example Way', o: Partial<DealData> = {}): DealData {
	return {
		name,
		address: '100 Example Way, Harlow Springs, TX 79999',
		propertyType: 'single-family',
		bedrooms: 3,
		bathrooms: 2,
		squareFeet: 1450,
		inputs: inputs(),
		sources: {
			rent: { source: 'sample', fetchedAt: T0 - 5 * MIN, rangeLowCents: 180_000, comps: 12 },
			price: { source: 'edited' }
		},
		...o
	};
}

const memo = (subjectId?: string) => ({
	feature: 'investor-memo',
	promptId: 'investor/memo@1',
	provider: 'anthropic' as const,
	model: 'claude-sonnet-5',
	sample: true,
	inputHash: 'a'.repeat(64),
	text: 'A sample memo.',
	findings: [],
	...(subjectId ? { subjectId } : {})
});

describe('Dexie schema: Phase 7 tables', () => {
	const dbSource = readFileSync(new URL('../../../storage/db.ts', import.meta.url), 'utf8');

	it('adds all four stores in ONE new version block, above every earlier block', () => {
		const versions = [...dbSource.matchAll(/\.version\((\d+)\)/g)].map((m) => Number(m[1]));
		expect(versions).toEqual([1, 2, 3, 4, 5]);
		expect(dbSource).toMatch(/this\.version\(5\)\.stores\(INVESTOR_STORES\)/);
		expect(Object.keys(INVESTOR_STORES)).toEqual([
			'deals',
			'investorDraft',
			'buyBoxes',
			'watchedZips'
		]);
	});

	it('opens with the v5 tables and their indexes', async () => {
		const { db } = openDb();
		await db.open();
		expect(db.verno).toBe(5);
		expect(db.deals.schema.indexes.map((i) => i.name).sort()).toEqual(['deletedAt', 'updatedAt']);
		expect(db.watchedZips.schema.idxByName.zip.unique).toBe(true);
		for (const t of ['investorDraft', 'buyBoxes'])
			expect(db.table(t).schema.primKey.name).toBe('id');
	});

	it('registers every Phase 7 table for backup (registered XOR excluded)', () => {
		const names = listBackupTables().map((t) => t.name);
		for (const t of Object.keys(INVESTOR_STORES)) {
			expect(names).toContain(t);
			expect(BACKUP_EXCLUDED_TABLES).not.toContain(t);
		}
		const deals = listBackupTables().find((t) => t.name === 'deals');
		expect(deals?.label).toBe('Saved deals');
		expect(deals?.schema).toBe(dealRecordSchema);
	});
});

describe('deals repository', () => {
	it('createDeal stamps Syncable fields and the analyzer version; a fresh DB open reads it back', async () => {
		const { db, factory, name, repo } = setup();
		const rec = await repo.createDeal(deal());
		expect(rec.id).toMatch(ID);
		expect(rec.ownerId).toBe('local');
		expect(rec.createdAt).toBe(new Date(T0).toISOString());
		expect(rec.updatedAt).toBe(rec.createdAt);
		expect('deletedAt' in rec).toBe(false);
		expect(rec.analyzerVersion).toBe(ANALYZER_VERSION);

		db.close();
		const reopened = createDealsRepo(openDb(factory, name).db);
		expect(await reopened.getDeal(rec.id)).toEqual(rec);
	});

	it('stores inputs and sources only, never computed outputs', async () => {
		const { db, repo } = setup();
		const withJunk = { ...deal(), noiMonthly: 123, capRatePct: 5 } as DealData;
		const rec = await repo.createDeal(withJunk);
		const raw = (await db.deals.get(rec.id)) as unknown as Record<string, unknown>;
		expect(raw).not.toHaveProperty('noiMonthly');
		expect(raw).not.toHaveProperty('capRatePct');
		expect(raw).not.toHaveProperty('cashFlowMonthly');
		expect(raw.inputs).toEqual(inputs());
		expect(raw.sources).toEqual(deal().sources);
	});

	it('updateDeal bumps updatedAt and keeps createdAt; a missing deal rejects', async () => {
		const { repo, at } = setup();
		const rec = await repo.createDeal(deal());
		at(T0 + 10 * MIN);
		const next = await repo.updateDeal(rec.id, deal('Renamed', { bedrooms: 4 }));
		expect(next.createdAt).toBe(rec.createdAt);
		expect(next.updatedAt).toBe(new Date(T0 + 10 * MIN).toISOString());
		expect(next.name).toBe('Renamed');
		expect(next.bedrooms).toBe(4);
		await expect(repo.updateDeal(crypto.randomUUID(), deal())).rejects.toThrow('deal-not-found');
	});

	it('rejects an invalid deal before anything is written', async () => {
		const { db, repo } = setup();
		await expect(
			repo.createDeal(deal('x', { inputs: inputs({ priceCents: -1 }) }))
		).rejects.toThrow();
		expect(await db.deals.count()).toBe(0);
	});

	it('listDeals excludes tombstones and sorts by updatedAt descending', async () => {
		const { repo, at } = setup();
		const a = await repo.createDeal(deal('A'));
		at(T0 + MIN);
		const b = await repo.createDeal(deal('B'));
		at(T0 + 2 * MIN);
		const c = await repo.createDeal(deal('C'));
		at(T0 + 3 * MIN);
		await repo.updateDeal(a.id, deal('A2'));
		await repo.deleteDeal(b.id);
		expect((await repo.listDeals()).map((d) => d.id)).toEqual([a.id, c.id]);
	});

	it('deleteDeal tombstones the deal and calls deleteBySubjectId(dealId, now) once', async () => {
		const { db, repo } = setup();
		const rec = await repo.createDeal(deal());
		const spy = vi.fn(async () => 0);
		const at = new Date(T0 + 7 * MIN);
		await repo.deleteDeal(rec.id, { artifacts: { deleteBySubjectId: spy }, now: () => at });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(rec.id, at);
		expect(await repo.getDeal(rec.id)).toBeNull();
		expect(await repo.listDeals()).toEqual([]);
		const raw = await db.deals.get(rec.id);
		expect(raw?.deletedAt).toBe(at.toISOString());
	});

	it('deleteDeal tombstones only that deal’s memo drafts (real artifact repo)', async () => {
		const { repo, artifacts } = setup();
		const mine = await repo.createDeal(deal('Mine'));
		const other = await repo.createDeal(deal('Other'));
		const m1 = await artifacts.create(memo(mine.id));
		const m2 = await artifacts.create(memo(mine.id));
		const o1 = await artifacts.create(memo(other.id));
		const loose = await artifacts.create(memo());

		await repo.deleteDeal(mine.id);
		expect(await artifacts.listBySubject('investor-memo', mine.id)).toEqual([]);
		expect((await artifacts.get(m1.id))?.deletedAt).toBeDefined();
		expect((await artifacts.get(m2.id))?.deletedAt).toBeDefined();
		expect((await artifacts.get(o1.id))?.deletedAt).toBeUndefined();
		expect((await artifacts.get(loose.id))?.deletedAt).toBeUndefined();
		expect(await artifacts.listBySubject('investor-memo', other.id)).toHaveLength(1);
	});

	it('rolls the deal tombstone back when deleteBySubjectId throws (same transaction)', async () => {
		const { repo } = setup();
		const rec = await repo.createDeal(deal());
		const boom = vi.fn(async () => {
			throw new Error('drafts-failed');
		});
		await expect(
			repo.deleteDeal(rec.id, { artifacts: { deleteBySubjectId: boom } })
		).rejects.toThrow('drafts-failed');
		expect(await repo.getDeal(rec.id)).toEqual(rec);
	});

	it('deleting a missing or already-deleted deal is a no-op', async () => {
		const { repo } = setup();
		const spy = vi.fn(async () => 0);
		await repo.deleteDeal(crypto.randomUUID(), { artifacts: { deleteBySubjectId: spy } });
		expect(spy).not.toHaveBeenCalled();
	});
});

describe('backup round trip', () => {
	const file = (text: string, name = 'tran-backup.json') => ({
		name,
		size: text.length,
		text: async () => text
	});

	it('exports all four Phase 7 tables; export -> wipe -> import (Replace) restores the deal', async () => {
		const { db, repo } = setup();
		const rec = await repo.createDeal(deal());
		await db.watchedZips.put({
			id: '00000000-0000-4000-8000-000000079999',
			ownerId: 'local',
			createdAt: new Date(T0).toISOString(),
			updatedAt: new Date(T0).toISOString(),
			schemaVersion: 1,
			zip: '79999',
			addedAt: T0
		});
		const { text, counts } = await buildBackupText(db, { now: new Date(T0), knownSecrets: [] });
		expect(counts).toMatchObject({ deals: 1, investorDraft: 0, buyBoxes: 0, watchedZips: 1 });

		const fresh = openDb().db;
		const preview = await previewImport(fresh, file(text));
		await applyImport(fresh, preview, 'replace');
		expect(await createDealsRepo(fresh).getDeal(rec.id)).toEqual(rec);
		expect((await fresh.watchedZips.toArray()).map((z) => z.zip)).toEqual(['79999']);
	});

	it('rejects a backup holding a deal with a negative priceCents', async () => {
		const { db, repo } = setup();
		await repo.createDeal(deal());
		const { text } = await buildBackupText(db, { now: new Date(T0), knownSecrets: [] });
		const env = JSON.parse(text);
		env.tables.deals[0].inputs.priceCents = -500;
		expect(dealRecordSchema.safeParse(env.tables.deals[0]).success).toBe(false);

		const fresh = openDb().db;
		const err = await previewImport(fresh, file(JSON.stringify(env))).catch((e) => e);
		expect(err).toBeInstanceOf(BackupError);
		expect((err as BackupError).code).toBe('invalid');
	});

	it.each([
		['bps above 10000', (i: DealInputs) => ({ ...i, closing: { unit: 'pct', bps: 10_001 } })],
		[
			'rate above 25',
			(i: DealInputs) => ({ ...i, financing: { ...i.financing, annualRatePct: 26 } })
		],
		[
			'term of 41 years',
			(i: DealInputs) => ({ ...i, financing: { ...i.financing, termYears: 41 } })
		],
		['fractional cents', (i: DealInputs) => ({ ...i, rentCents: 10.5 })]
	])('dealRecordSchema rejects %s', async (_label, mutate) => {
		const { repo } = setup();
		const rec = await repo.createDeal(deal());
		expect(dealRecordSchema.safeParse(rec).success).toBe(true);
		const bad = { ...rec, inputs: mutate(rec.inputs) };
		expect(dealRecordSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects a null deletedAt (live rows omit it)', async () => {
		const { repo } = setup();
		const rec = await repo.createDeal(deal());
		expect(dealRecordSchema.safeParse({ ...rec, deletedAt: null }).success).toBe(false);
	});
});
