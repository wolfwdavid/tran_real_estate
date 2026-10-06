import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { AI_STORES } from '$lib/ai/storage/tables';
import { PHASE4_STORES } from '$lib/data/tables';
import { AGENT_STORES } from './agent/tables';
import { INVESTOR_STORES } from '$lib/features/investor/deals/tables';
import { freshIdb } from '$lib/storage/test-utils';
import { StorageBlockedError, TranDb, _resetDb, getDb, openDb } from './db';

const dbSource = readFileSync(new URL('./db.ts', import.meta.url), 'utf8');

/** An IDBFactory whose open() throws a DOMException with the given name. */
function throwingFactory(name: string): IDBFactory {
	const real = freshIdb().indexedDB;
	return {
		open: () => {
			throw new DOMException('blocked', name);
		},
		deleteDatabase: (n: string) => real.deleteDatabase(n),
		cmp: (a: unknown, b: unknown) => real.cmp(a, b),
		databases: () => real.databases()
	} as IDBFactory;
}

afterEach(() => {
	_resetDb();
});

describe('TranDb', () => {
	it("opens as 'tran' with the Phase 3, Phase 4 data, Phase 5 AI, Phase 6 renter, Phase 7 investor and Phase 8 agent tables at version 6", async () => {
		const db = new TranDb(freshIdb());
		await db.open();
		expect(db.name).toBe('tran');
		expect(db.tables.map((t) => t.name).sort()).toEqual(
			[
				'meta',
				'prefs',
				...Object.keys(PHASE4_STORES),
				...Object.keys(AI_STORES),
				'renterShortlist',
				'renterSearchMeta',
				'deals',
				'investorDraft',
				'buyBoxes',
				'watchedZips',
				...Object.keys(AGENT_STORES)
			].sort()
		);
		expect(db.verno).toBe(6);
		db.close();
	});

	it('version 3 adds aiArtifacts with its feature+createdAt index', async () => {
		const db = new TranDb(freshIdb());
		await db.open();
		const t = db.table('aiArtifacts');
		expect(t.schema.primKey.name).toBe('id');
		expect(t.schema.indexes.map((i) => i.name).sort()).toEqual(
			['[feature+createdAt]', 'feature', 'status', 'updatedAt'].sort()
		);
		db.close();
	});

	it('upgrades a version 2 database in place: existing rows kept, aiArtifacts, renter and investor tables added', async () => {
		const idb = freshIdb();
		class V2 extends Dexie {
			constructor() {
				super('tran', idb);
				this.version(1).stores({ meta: 'key', prefs: 'id, key, updatedAt' });
				this.version(2).stores(PHASE4_STORES);
			}
		}
		const old = new V2();
		await old.table('meta').put({ key: 'lastBackupAt', value: '2026-10-01T00:00:00.000Z' });
		old.close();

		const db = new TranDb(idb);
		await db.open();
		expect(db.verno).toBe(6);
		expect(await db.meta.get('lastBackupAt')).toEqual({
			key: 'lastBackupAt',
			value: '2026-10-01T00:00:00.000Z'
		});
		expect(await db.aiArtifacts.count()).toBe(0);
		expect(await db.renterShortlist.count()).toBe(0);
		expect(await db.renterSearchMeta.count()).toBe(0);
		expect(await db.deals.count()).toBe(0);
		expect(await db.watchedZips.count()).toBe(0);
		db.close();
	});

	it('upgrades a version 5 database in place: Phase 7 rows kept, agent tables added with their indexes', async () => {
		const idb = freshIdb();
		class V5 extends Dexie {
			constructor() {
				super('tran', idb);
				this.version(1).stores({ meta: 'key', prefs: 'id, key, updatedAt' });
				this.version(2).stores(PHASE4_STORES);
				this.version(3).stores(AI_STORES);
				this.version(4).stores({
					renterShortlist: 'id, &listingId, status, updatedAt, deletedAt',
					renterSearchMeta: 'id, updatedAt, deletedAt'
				});
				this.version(5).stores(INVESTOR_STORES);
			}
		}
		const old = new V5();
		await old.table('deals').put({ id: 'd1', updatedAt: '2026-10-01T00:00:00.000Z' });
		old.close();

		const db = new TranDb(idb);
		await db.open();
		expect(db.verno).toBe(6);
		expect(await db.deals.get('d1')).toEqual({ id: 'd1', updatedAt: '2026-10-01T00:00:00.000Z' });
		const idx = (name: string) =>
			db
				.table(name)
				.schema.indexes.map((i) => i.name)
				.sort();
		expect(idx('contacts')).toEqual(
			[
				'createdAt',
				'deletedAt',
				'emailNorm',
				'lastContactedAt',
				'phoneNorm',
				'stage',
				'updatedAt'
			].sort()
		);
		expect(idx('tasks')).toEqual(
			['[status+dueDate]', 'contactId', 'deletedAt', 'updatedAt'].sort()
		);
		expect(idx('activities')).toEqual(['[contactId+at]', 'at', 'contactId'].sort());
		expect(idx('agentProfile')).toEqual([]);
		expect(await db.contacts.count()).toBe(0);
		db.close();
	});

	it('declares append-only, strictly increasing schema versions', () => {
		const versions = [...dbSource.matchAll(/\.version\((\d+)\)/g)].map((m) => Number(m[1]));
		expect(versions.filter((v) => v === 1)).toHaveLength(1);
		expect(versions.length).toBeGreaterThan(0);
		for (let i = 1; i < versions.length; i++) {
			expect(versions[i]).toBeGreaterThan(versions[i - 1]);
		}
	});

	it('never constructs the database at module scope', () => {
		expect(dbSource).not.toMatch(/^(const|let) .*= (getDb|new TranDb)\(/m);
	});
});

describe('openDb', () => {
	it('resolves with the database for a working factory', async () => {
		const db = new TranDb(freshIdb());
		await expect(openDb(db)).resolves.toBe(db);
		db.close();
	});

	it.each(['SecurityError', 'InvalidStateError', 'UnknownError'])(
		'maps a %s from open() to StorageBlockedError',
		async (name) => {
			const db = new TranDb({ ...freshIdb(), indexedDB: throwingFactory(name) });
			await expect(openDb(db)).rejects.toBeInstanceOf(StorageBlockedError);
		}
	);

	it('maps a missing IndexedDB API (MissingAPIError) to StorageBlockedError', async () => {
		const db = new TranDb({});
		const err = await openDb(db).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(StorageBlockedError);
		expect((err as Error).message).toBe('storage-blocked');
		expect((err as Error).name).toBe('StorageBlockedError');
	});
});

describe('getDb / _resetDb', () => {
	it('returns the same lazy singleton until reset', () => {
		const a = getDb(freshIdb());
		expect(getDb()).toBe(a);
		_resetDb();
		const b = getDb(freshIdb());
		expect(b).not.toBe(a);
		expect(b).toBeInstanceOf(TranDb);
	});
});
