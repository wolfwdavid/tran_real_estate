import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
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
	it("opens as 'tran' with exactly the meta and prefs tables at version 1", async () => {
		const db = new TranDb(freshIdb());
		await db.open();
		expect(db.name).toBe('tran');
		expect(db.tables.map((t) => t.name).sort()).toEqual(['meta', 'prefs']);
		expect(db.verno).toBe(1);
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
