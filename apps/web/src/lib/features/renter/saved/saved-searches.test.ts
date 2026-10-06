// Renter saved searches (06-20, RENT-04): save / rename / delete, the 10-search limit, the filtered
// "N new since your last visit" count and View results (newIds + markSeen). Real Phase 4 saved-search
// repo and renter meta repo on fresh fake-indexeddb databases, an injected clock and a gateway fake
// whose spend methods throw: the service only ever peeks (0 calls).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { Listing } from '@tran/core/listings';
import { buildSnapshot } from '@tran/core/alerts';
import {
	DEFAULT_FILTERS,
	MAX_SAVED_SEARCHES,
	type RentalFilters,
	type RenterLocation
} from '@tran/core/renter';
import { savedSearchRepo, type DataGateway, type Provenance } from '$lib/data';
// eslint-disable-next-line no-restricted-imports -- test-only isolated DataDb (DataShell.browser.test precedent); the port never exposes createDataDb
import { makeDb, T0 } from '$lib/data/testing/harness';
import { TranDb } from '$lib/storage/db';
import { createSearchMetaRepo } from '../storage/search-meta-repo';
import { searchRequest } from '../data/requests';
import { createRenterSavedSearches } from './saved-searches';

const HOUR = 3_600_000;
const ZIP: RenterLocation = { kind: 'zip', zipCode: '74201' };
const MAX_2000: RentalFilters = { ...DEFAULT_FILTERS, priceMax: 2000 };

function row(id: string, price: number): Listing {
	return {
		id,
		price,
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900,
		propertyType: 'Apartment',
		listedDate: new Date(T0 - 2 * 86_400_000).toISOString(),
		lastSeenDate: new Date(T0).toISOString(),
		daysOnMarket: 2,
		status: 'Active',
		removedDate: null,
		formattedAddress: `${id} Main St, Tulsa, OK 74201`
	} as unknown as Listing;
}

const dbs: { close(): void }[] = [];
afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
});

function setup(opts: { source?: Provenance['source'] } = {}) {
	let now = T0;
	const clock = () => now;
	const dataDb = makeDb();
	const tranDb = new TranDb(
		{ indexedDB: new IDBFactory(), IDBKeyRange },
		`t-${crypto.randomUUID()}`
	);
	dbs.push(dataDb, tranDb);
	let rows: Listing[] = [row('a', 1500), row('b', 1900), row('c', 2500)];
	const provenance: Provenance = { source: opts.source ?? 'rentcast', fetchedAt: T0, stale: false };
	const peek = vi.fn(async () => ({
		kind: 'data' as const,
		result: { data: rows, provenance, truncated: false }
	}));
	const spend = vi.fn(() => {
		throw new Error('the saved-search service must never spend');
	});
	const gateway = { peek, get: spend, refresh: spend } as unknown as DataGateway;
	const phase4 = savedSearchRepo({ db: dataDb, clock });
	const meta = createSearchMetaRepo(tranDb, clock);
	const svc = createRenterSavedSearches({ phase4, meta, gateway: () => gateway, clock });
	const base = () => ({
		location: ZIP,
		filters: MAX_2000,
		sort: 'newest' as const,
		rows,
		provenance,
		truncated: false
	});
	/** What Phase 4's scheduler does on a due pass: snapshot the current rows, then complete(). */
	async function schedulerPass(id: string) {
		const prev = (await phase4.snapshot(id)) ?? null;
		const observed = rows.map((r) => ({
			id: r.id,
			price: r.price,
			status: r.status,
			removedDate: r.removedDate
		}));
		await phase4.complete(id, buildSnapshot(prev, observed, { takenAt: now, truncated: false }));
	}
	return {
		svc,
		phase4,
		meta,
		peek,
		spend,
		base,
		schedulerPass,
		setNow: (t: number) => (now = t),
		setRows: (r: Listing[]) => (rows = r)
	};
}

describe('save', () => {
	it('creates the Phase 4 search, a baseline snapshot and the meta row with one id (0 calls)', async () => {
		const t = setup();
		t.setNow(T0 + HOUR);
		const res = await t.svc.save({ name: '74201 · Up to $2,000', ...t.base() });
		if (!('id' in res)) throw new Error('expected a saved search');
		const [p4] = await t.phase4.list();
		expect(p4).toMatchObject({
			id: res.id,
			portal: 'renter',
			endpoint: 'rental-listings',
			name: '74201 · Up to $2,000',
			params: searchRequest(ZIP).params,
			lastRunAt: T0,
			lastSeenAt: T0 + HOUR,
			claimedAt: null
		});
		const snap = await t.phase4.snapshot(res.id);
		expect(Object.keys(snap!.items).sort()).toEqual(['a', 'b', 'c']);
		const m = (await t.meta.liveAll())[0]!;
		expect(m).toMatchObject({ id: res.id, location: ZIP, sort: 'newest' });
		expect(m.filters.priceMax).toBe(2000);
		expect(await t.svc.newCount(res.id)).toBe(0);
		expect(t.spend).not.toHaveBeenCalled();
	});

	it('trims the name, rejects an empty one and slices to 60 characters', async () => {
		const t = setup();
		expect(await t.svc.save({ name: '   ', ...t.base() })).toEqual({ error: 'empty' });
		expect(await t.phase4.list()).toHaveLength(0);
		const res = await t.svc.save({ name: `  ${'x'.repeat(70)}  `, ...t.base() });
		expect('name' in res && res.name).toBe('x'.repeat(60));
	});

	it(`blocks the ${MAX_SAVED_SEARCHES + 1}th save and writes nothing`, async () => {
		const t = setup();
		for (let i = 0; i < MAX_SAVED_SEARCHES; i++) {
			const r = await t.svc.save({ name: `Search ${i}`, ...t.base() });
			expect('id' in r).toBe(true);
		}
		expect(await t.svc.canSave()).toBe(false);
		expect(await t.svc.save({ name: 'One more', ...t.base() })).toEqual({ error: 'limit' });
		expect(await t.phase4.list()).toHaveLength(MAX_SAVED_SEARCHES);
		expect(await t.meta.liveAll()).toHaveLength(MAX_SAVED_SEARCHES);
	});

	it('counts only renter searches toward the limit', async () => {
		const t = setup();
		await t.phase4.create({
			portal: 'investor',
			name: 'Sales',
			endpoint: 'sale-listings',
			params: { zipCode: '74201' }
		});
		for (let i = 0; i < MAX_SAVED_SEARCHES; i++) await t.svc.save({ name: `S${i}`, ...t.base() });
		expect(await t.svc.listRenter()).toHaveLength(MAX_SAVED_SEARCHES);
	});
});

describe('rename and remove', () => {
	it('renames with a trim, rejects empty and slices to 60', async () => {
		const t = setup();
		const res = await t.svc.save({ name: 'Old', ...t.base() });
		if (!('id' in res)) throw new Error('expected a saved search');
		expect(await t.svc.rename(res.id, '  New name ')).toEqual({ name: 'New name' });
		expect((await t.phase4.list())[0]!.name).toBe('New name');
		expect(await t.svc.rename(res.id, '  ')).toEqual({ error: 'empty' });
		expect((await t.phase4.list())[0]!.name).toBe('New name');
		await t.svc.rename(res.id, 'y'.repeat(61));
		expect((await t.phase4.list())[0]!.name).toBe('y'.repeat(60));
	});

	it('tombstones the search and its meta', async () => {
		const t = setup();
		const res = await t.svc.save({ name: 'Gone', ...t.base() });
		if (!('id' in res)) throw new Error('expected a saved search');
		await t.svc.remove(res.id);
		expect(await t.phase4.list()).toHaveLength(0);
		expect(await t.meta.liveAll()).toHaveLength(0);
		expect(await t.svc.listRenter()).toHaveLength(0);
	});
});

describe('new since last visit', () => {
	it('counts new ids that match the saved filters, then 0 after View results', async () => {
		const t = setup();
		const res = await t.svc.save({ name: '74201 · Up to $2,000', ...t.base() });
		if (!('id' in res)) throw new Error('expected a saved search');
		// 25 h later the scheduler sees 3 new listings; 2 are within Max $2,000.
		t.setNow(T0 + 25 * HOUR);
		t.setRows([...t.base().rows, row('n1', 1200), row('n2', 2000), row('n3', 3000)]);
		await t.schedulerPass(res.id);
		expect(await t.svc.newCount(res.id)).toBe(2);
		const list = await t.svc.listRenter();
		expect(list[0]).toMatchObject({ id: res.id, newCount: 2, checkedAt: T0 + 25 * HOUR });

		t.setNow(T0 + 26 * HOUR);
		const opened = await t.svc.openForResults(res.id);
		expect(opened).not.toBeNull();
		expect([...opened!.newIds].sort()).toEqual(['n1', 'n2']);
		expect(opened!.state).toMatchObject({ locInput: '74201', sort: 'newest', view: 'list' });
		expect(opened!.state.filters.priceMax).toBe(2000);
		expect((await t.phase4.list())[0]!.lastSeenAt).toBe(T0 + 26 * HOUR);
		expect(await t.svc.newCount(res.id)).toBe(0);
		expect(t.spend).not.toHaveBeenCalled();
	});

	it('openForResults of an unknown id returns null and writes nothing', async () => {
		const t = setup();
		expect(await t.svc.openForResults('missing')).toBeNull();
	});

	it('sample mode: a fresh saved search shows no fake drift', async () => {
		const t = setup({ source: 'sample' });
		const res = await t.svc.save({ name: 'Sample', ...t.base() });
		if (!('id' in res)) throw new Error('expected a saved search');
		t.setNow(T0 + 25 * HOUR);
		await t.schedulerPass(res.id);
		expect(await t.svc.newCount(res.id)).toBe(0);
	});

	it('lists renter searches by new count, then name', async () => {
		const t = setup();
		const ids: Record<string, string> = {};
		for (const name of ['Charlie', 'alpha', 'Bravo']) {
			const r = await t.svc.save({ name, ...t.base() });
			if (!('id' in r)) throw new Error('expected a saved search');
			ids[name] = r.id;
		}
		t.setNow(T0 + 25 * HOUR);
		t.setRows([...t.base().rows, row('n1', 1200)]);
		await t.schedulerPass(ids.Charlie!);
		const list = await t.svc.listRenter();
		expect(list.map((s) => s.name)).toEqual(['Charlie', 'alpha', 'Bravo']);
		expect(list[1]).toMatchObject({ newCount: 0, summary: '74201 · Up to $2,000' });
		expect(list[0]!.query).toBe('loc=74201&max=2000');
	});

	it('findMatching finds a saved search with the same location and filters', async () => {
		const t = setup();
		const r = await t.svc.save({ name: 'Mine', ...t.base() });
		if (!('id' in r)) throw new Error('expected a saved search');
		expect((await t.svc.findMatching(ZIP, MAX_2000))?.id).toBe(r.id);
		expect(await t.svc.findMatching(ZIP, DEFAULT_FILTERS)).toBeUndefined();
	});
});
