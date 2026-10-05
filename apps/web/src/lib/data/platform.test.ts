import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { newSyncable, type ProviderId } from '@tran/core';
import type { KeyState } from '$lib/storage/secrets';
import { _resetKeyTesters, getKeyTester, hasKeyTester } from '$lib/storage/secrets/testers';
import {
	_resetPlatform,
	bindRentCastVault,
	getLastRentCastKeyTest,
	getRentCastKey,
	getRentCastKeyState,
	onRentCastKeyChange,
	registerRentCastKeyTest,
	type DataDb,
	type RentCastKeyTestOutcome,
	type RentCastVaultLike
} from './platform';
import {
	DATA_PREF_IDS,
	DATA_RECORD_SCHEMA_VERSION,
	PHASE4_STORES,
	type ApiCacheRow,
	type DataPrefRow,
	type LedgerRow,
	type SavedSearchRow,
	type SearchSnapshotRow
} from './tables';
import { T0, TEST_KEY, jsonResponse, makeDb, spyFetch } from './testing/harness';

const dbSource = readFileSync(new URL('../storage/db.ts', import.meta.url), 'utf8');
const PHASE3_LATEST = 1;

const opened: DataDb[] = [];
async function open(): Promise<DataDb> {
	const db = makeDb();
	opened.push(db);
	await db.open();
	return db;
}

afterEach(() => {
	for (const db of opened.splice(0)) db.close();
	_resetPlatform();
	_resetKeyTesters();
});

const syncable = (id: string) =>
	newSyncable({ id, now: new Date(T0), schemaVersion: DATA_RECORD_SCHEMA_VERSION });
const ID_A = '00000000-0000-4000-8000-00000000000a';
const ID_B = '00000000-0000-4000-8000-00000000000b';

describe('createDataDb / makeDb', () => {
	it('opens with all five Phase 4 tables and round-trips a row in each', async () => {
		const db = await open();
		const names = db.tables.map((t) => t.name);
		for (const t of Object.keys(PHASE4_STORES)) expect(names).toContain(t);

		const cache: ApiCacheRow = {
			key: 'GET /listings/rental/long-term?zipCode=00000',
			endpoint: 'listings/rental/long-term',
			status: 200,
			body: [{ id: 'x' }],
			fetchedAt: T0,
			truncated: false,
			droppedRows: 0
		};
		const ledger: LedgerRow = {
			...syncable(ID_A),
			periodKey: '2026-10',
			at: T0,
			endpoint: 'listings/rental/long-term',
			key: cache.key,
			intent: 'user',
			status: 'pending',
			overCap: false,
			settledAt: null
		};
		const search: SavedSearchRow = {
			...syncable(ID_B),
			portal: 'renter',
			name: 'Two-bed near the park',
			endpoint: 'listings/rental/long-term',
			params: { zipCode: '00000', bedrooms: 2 },
			lastRunAt: null,
			lastSeenAt: null,
			claimedAt: null
		};
		const snapshot: SearchSnapshotRow = {
			...syncable(ID_B),
			searchId: ID_B,
			takenAt: T0,
			truncated: false,
			items: { x: { price: 1500, status: 'Active', removedDate: null, firstSeenAt: T0 } }
		};
		const pref: DataPrefRow = {
			...syncable(DATA_PREF_IDS.rentcastCap),
			key: 'rentcastCap',
			value: 40
		};

		await db.apiCache.put(cache);
		await db.ledger.put(ledger);
		await db.savedSearches.put(search);
		await db.searchSnapshots.put(snapshot);
		await db.dataPrefs.put(pref);

		expect(await db.apiCache.get(cache.key)).toEqual(cache);
		expect(await db.ledger.get(ID_A)).toEqual(ledger);
		expect(await db.savedSearches.get(ID_B)).toEqual(search);
		expect(await db.searchSnapshots.get(ID_B)).toEqual(snapshot);
		expect(await db.dataPrefs.get('rentcastCap')).toEqual(pref);
		expect(await db.ledger.where('[periodKey+at]').equals(['2026-10', T0]).count()).toBe(1);
	});

	it('two makeDb() databases never share rows', async () => {
		const a = await open();
		const b = await open();
		await a.dataPrefs.put({
			...syncable(DATA_PREF_IDS.dataSource),
			key: 'dataSource',
			value: 'sample'
		});
		expect(await a.dataPrefs.count()).toBe(1);
		expect(await b.dataPrefs.count()).toBe(0);
	});

	it('Phase 4 tables are version Phase 3 latest + 1; verno is the highest declared version', async () => {
		const db = await open();
		const versions = [...dbSource.matchAll(/\.version\((\d+)\)/g)].map((m) => Number(m[1]));
		expect(dbSource).toContain(`this.version(${PHASE3_LATEST + 1}).stores(PHASE4_STORES)`);
		// Later phases append their own blocks (Phase 5: version 3, aiArtifacts).
		expect(db.verno).toBeGreaterThanOrEqual(PHASE3_LATEST + 1);
		expect(Math.max(...versions)).toBe(db.verno);
	});

	it('a stored ledger row never contains the test key', async () => {
		const db = await open();
		await db.ledger.put({
			...syncable(ID_A),
			periodKey: '2026-10',
			at: T0,
			endpoint: 'properties',
			key: 'GET /properties?address=1%20Test%20Way',
			intent: 'key-test',
			status: 200,
			overCap: false,
			settledAt: T0
		});
		const row = await db.ledger.get(ID_A);
		expect(row).toBeDefined();
		expect(JSON.stringify(row)).not.toContain(TEST_KEY);
	});
});

/** Minimal vault fake: a key per provider plus a locked flag, with change events. */
function fakeVault(initial: { key?: string; locked?: boolean } = {}) {
	let key = initial.key;
	let locked = initial.locked ?? false;
	const cbs = new Set<() => void>();
	const vault: RentCastVaultLike = {
		getStatus: () => {
			const state: KeyState = locked ? 'locked' : key ? 'session' : 'none';
			return {
				providers: { rentcast: { state } } as Record<ProviderId, { state: KeyState }>
			};
		},
		getKey: async () => (locked ? undefined : key),
		onChange: (cb) => {
			cbs.add(cb);
			return () => cbs.delete(cb);
		}
	};
	return {
		vault,
		set(next: { key?: string; locked?: boolean }) {
			key = next.key;
			locked = next.locked ?? false;
			for (const cb of cbs) cb();
		},
		listeners: () => cbs.size
	};
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('RentCast key bridge', () => {
	it('is "none" with a null key before any vault is bound (Node: no browser vault)', () => {
		expect(getRentCastKey()).toBeNull();
		expect(getRentCastKeyState()).toBe('none');
	});

	it('mirrors the vault key synchronously after binding', async () => {
		const f = fakeVault({ key: TEST_KEY });
		await bindRentCastVault(f.vault);
		expect(getRentCastKey()).toBe(TEST_KEY);
		expect(getRentCastKeyState()).toBe('available');
	});

	it('reports locked with a null key while the vault is locked', async () => {
		const f = fakeVault({ key: TEST_KEY, locked: true });
		await bindRentCastVault(f.vault);
		expect(getRentCastKey()).toBeNull();
		expect(getRentCastKeyState()).toBe('locked');
	});

	it('notifies listeners on change and stops after unsubscribe/unbind', async () => {
		const f = fakeVault();
		const unbind = await bindRentCastVault(f.vault);
		let calls = 0;
		const off = onRentCastKeyChange(() => calls++);

		f.set({ key: TEST_KEY });
		await settle();
		expect(calls).toBe(1);
		expect(getRentCastKeyState()).toBe('available');

		f.set({ key: TEST_KEY }); // same key: no change, no notification
		await settle();
		expect(calls).toBe(1);

		off();
		f.set({});
		await settle();
		expect(calls).toBe(1);
		expect(getRentCastKey()).toBeNull();

		unbind();
		expect(f.listeners()).toBe(0);
	});

	it('treats a vault read error as no key and never surfaces the error', async () => {
		const f = fakeVault({ key: TEST_KEY });
		f.vault.getKey = async () => {
			throw new Error('corrupt');
		};
		await bindRentCastVault(f.vault);
		expect(getRentCastKey()).toBeNull();
		expect(getRentCastKeyState()).toBe('none');
	});
});

describe('registerRentCastKeyTest', () => {
	const cases: [RentCastKeyTestOutcome, string][] = [
		['valid', 'accepted'],
		['valid-billed', 'accepted'],
		['invalid', 'rejected'],
		['restricted', 'rejected'],
		['rate-limited', 'rate-limited'],
		['unverified', 'failed']
	];

	it.each(cases)('maps %s to the Phase 3 status %s and records the raw outcome', async (o, s) => {
		const off = registerRentCastKeyTest(async () => o, { now: () => T0 });
		expect(hasKeyTester('rentcast')).toBe(true);
		const result = await getKeyTester('rentcast')!(TEST_KEY, new AbortController().signal);
		expect(result).toEqual({ status: s });
		expect(getLastRentCastKeyTest()).toEqual({ outcome: o, at: T0 });
		off();
		expect(hasKeyTester('rentcast')).toBe(false);
	});

	it('a throwing test is unverified/failed and the result never echoes the key', async () => {
		registerRentCastKeyTest(
			async (k) => {
				throw new Error(`boom ${k}`);
			},
			{ now: () => T0 }
		);
		const result = await getKeyTester('rentcast')!(TEST_KEY, new AbortController().signal);
		expect(result).toEqual({ status: 'failed' });
		expect(JSON.stringify(result)).not.toContain(TEST_KEY);
		expect(getLastRentCastKeyTest()).toEqual({ outcome: 'unverified', at: T0 });
	});
});

describe('harness helpers', () => {
	it('jsonResponse builds a JSON Response with the given status', async () => {
		const res = jsonResponse(404, { message: 'none' });
		expect(res.status).toBe(404);
		expect(res.headers.get('content-type')).toBe('application/json');
		expect(await res.json()).toEqual({ message: 'none' });
	});

	it('spyFetch records url and headers and delegates to the handler', async () => {
		const spy = spyFetch(() => jsonResponse(200, []));
		const res = await spy.fetch('https://api.rentcast.io/v1/properties?zipCode=00000', {
			headers: { 'X-Api-Key': TEST_KEY }
		});
		expect(res.status).toBe(200);
		expect(spy.calls).toEqual([
			{
				url: 'https://api.rentcast.io/v1/properties?zipCode=00000',
				headers: { 'x-api-key': TEST_KEY }
			}
		]);
	});
});
