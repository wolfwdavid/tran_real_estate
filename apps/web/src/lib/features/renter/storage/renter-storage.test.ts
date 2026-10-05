// Renter persistence (06-11, RENT-04/RENT-05): the shortlist and saved-search meta tables, their
// repositories (tombstone restore, status history, notes cap) and backup coverage.
// fake-indexeddb with a fresh IDBFactory per test and an injected clock (never fake timers).
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { MAX_NOTES, shortlistItemSchema, type RentalFilters } from '@tran/core/renter';
import { listBackupTables, _resetBackupRegistry } from '$lib/storage/backup-registry';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import { META, getMeta } from '$lib/storage/meta';
import { TranDb } from '$lib/storage/db';
import {
	RENTER_SEARCH_META_LABEL,
	RENTER_SEARCH_META_TABLE,
	RENTER_SHORTLIST_LABEL,
	RENTER_SHORTLIST_TABLE
} from './tables';
import { createShortlistRepo, getShortlistRepo } from './shortlist-repo';
import { createSearchMetaRepo, getSearchMetaRepo } from './search-meta-repo';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const MIN = 60_000;

const dbs: TranDb[] = [];
afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
	_resetBackupRegistry();
});

function freshDb(): TranDb {
	const db = new TranDb({ indexedDB: new IDBFactory(), IDBKeyRange }, `t-${crypto.randomUUID()}`);
	dbs.push(db);
	return db;
}

function setup() {
	const db = freshDb();
	let now = T0;
	const clock = () => now;
	return {
		db,
		shortlist: createShortlistRepo(db, clock),
		meta: createSearchMetaRepo(db, clock),
		at: (t: number) => {
			now = t;
		}
	};
}

/** A synthetic mapped rental row (fictional address). */
function row(id: string, price = 1500) {
	return {
		id,
		kind: 'rental' as const,
		formattedAddress: `12 Fern Row, Harlow Springs, OK 74201`,
		zipCode: '74201',
		propertyType: 'Apartment',
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 850,
		price,
		status: 'Active',
		listedDate: '2026-10-10T00:00:00.000Z',
		history: [{ date: '2026-10-10', event: 'Listed', price }],
		agent: { name: 'Sample Agent', phone: null, email: null, website: null }
	};
}
const PROV = { source: 'sample' as const, fetchedAt: T0 - 5 * MIN, stale: false };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Dexie schema: renter tables', () => {
	const dbSource = readFileSync(new URL('../../../storage/db.ts', import.meta.url), 'utf8');

	it('declares both tables in a version block higher than every earlier block', () => {
		const blocks = [...dbSource.matchAll(/\.version\((\d+)\)\.stores\(([^)]*)\)/g)];
		const renter = blocks.find((b) => b[2].includes(RENTER_SHORTLIST_TABLE));
		expect(renter).toBeDefined();
		const v = Number(renter![1]);
		for (const b of blocks) if (b !== renter) expect(Number(b[1])).toBeLessThan(v);
		expect(renter![2]).toContain(RENTER_SEARCH_META_TABLE);
	});

	it('opens with the renter indexes (unique listingId)', async () => {
		const db = freshDb();
		await db.open();
		const sl = db.table(RENTER_SHORTLIST_TABLE).schema;
		expect(sl.primKey.name).toBe('id');
		expect(sl.indexes.map((i) => i.name).sort()).toEqual(
			['deletedAt', 'listingId', 'status', 'updatedAt'].sort()
		);
		expect(sl.indexes.find((i) => i.name === 'listingId')?.unique).toBe(true);
		const meta = db.table(RENTER_SEARCH_META_TABLE).schema;
		expect(meta.primKey.name).toBe('id');
		expect(meta.indexes.map((i) => i.name).sort()).toEqual(['deletedAt', 'updatedAt']);
	});

	it('upgrades an older database in place, keeping its rows and adding the renter tables', async () => {
		const idb = { indexedDB: new IDBFactory(), IDBKeyRange };
		const target = Math.max(
			...[...dbSource.matchAll(/this\.version\((\d+)\)/g)].map((m) => Number(m[1]))
		);
		// An older build of the app (Phase 3 schema only) left this database behind.
		class Older extends Dexie {
			constructor() {
				super('tran', idb);
				this.version(1).stores({ meta: 'key', prefs: 'id, key, updatedAt' });
			}
		}
		const old = new Older();
		await old.table('meta').put({ key: 'lastBackupAt', value: '2026-10-01T00:00:00.000Z' });
		old.close();

		const db = new TranDb(idb);
		dbs.push(db);
		await db.open();
		expect(db.verno).toBe(target);
		expect(await db.meta.get('lastBackupAt')).toBeDefined();
		expect(await db.table(RENTER_SHORTLIST_TABLE).count()).toBe(0);
	});
});

describe('shortlist repo', () => {
	it('add creates a Saved item with history, empty notes and a full listing snapshot', async () => {
		const { db, shortlist } = setup();
		const item = await shortlist.add(row('L1'), PROV);
		expect(item.id).toMatch(ID);
		expect(item).toMatchObject({
			listingId: 'L1',
			status: 'saved',
			statusChangedAt: T0,
			statusHistory: [{ status: 'saved', at: T0 }],
			notes: '',
			provenance: { source: 'sample', fetchedAt: T0 - 5 * MIN },
			createdAt: new Date(T0).toISOString(),
			updatedAt: new Date(T0).toISOString(),
			ownerId: 'local'
		});
		expect(item.provenance).not.toHaveProperty('stale');
		expect(item.listing).toEqual(row('L1'));
		expect('deletedAt' in item).toBe(false);
		expect(shortlistItemSchema.safeParse(item).success).toBe(true);
		expect(await db.table(RENTER_SHORTLIST_TABLE).get(item.id)).toEqual(item);
		expect(await getMeta(db, META.firstRecordAt)).toBe(new Date(T0).toISOString());
	});

	it('a second add of an active listingId returns the existing item (no throw, no duplicate)', async () => {
		const { db, shortlist, at } = setup();
		const first = await shortlist.add(row('L1'), PROV);
		at(T0 + MIN);
		const again = await shortlist.add(row('L1', 1999), PROV);
		expect(again).toEqual(first);
		expect(await db.table(RENTER_SHORTLIST_TABLE).count()).toBe(1);
	});

	it('remove tombstones; re-adding restores the same row without a ConstraintError', async () => {
		const { db, shortlist, at } = setup();
		const first = await shortlist.add(row('L1'), PROV);
		await shortlist.setStatus('L1', 'toured');
		await shortlist.setNotes('L1', 'Loved the light');

		at(T0 + MIN);
		await shortlist.remove('L1');
		const tomb = await db.table(RENTER_SHORTLIST_TABLE).get(first.id);
		expect(tomb.deletedAt).toBe(new Date(T0 + MIN).toISOString());
		expect(await shortlist.getByListingId('L1')).toBeUndefined();
		expect(await shortlist.count()).toBe(0);

		at(T0 + 2 * MIN);
		let restored;
		let thrown: unknown;
		try {
			restored = await shortlist.add(row('L1', 1700), { ...PROV, fetchedAt: T0 + 2 * MIN });
		} catch (e) {
			thrown = e;
		}
		expect((thrown as Error | undefined)?.name).not.toBe('ConstraintError');
		expect(thrown).toBeUndefined();
		expect(restored).toMatchObject({
			id: first.id,
			createdAt: first.createdAt,
			listingId: 'L1',
			status: 'saved',
			statusChangedAt: T0 + 2 * MIN,
			statusHistory: [{ status: 'saved', at: T0 + 2 * MIN }],
			notes: '',
			updatedAt: new Date(T0 + 2 * MIN).toISOString(),
			provenance: { source: 'sample', fetchedAt: T0 + 2 * MIN }
		});
		expect(restored!.listing.price).toBe(1700);
		// deletedAt is REMOVED (never null): the schema rejects null and backups would fail.
		const stored = await db.table(RENTER_SHORTLIST_TABLE).get(first.id);
		expect('deletedAt' in stored).toBe(false);
		expect(shortlistItemSchema.safeParse(stored).success).toBe(true);
		expect(await db.table(RENTER_SHORTLIST_TABLE).count()).toBe(1);
		expect(await shortlist.count()).toBe(1);
	});

	it('setStatus appends history through changeStatus; the same status writes nothing', async () => {
		const { db, shortlist, at } = setup();
		await shortlist.add(row('L1'), PROV);
		at(T0 + MIN);
		const toured = await shortlist.setStatus('L1', 'toured');
		expect(toured).toMatchObject({
			status: 'toured',
			statusChangedAt: T0 + MIN,
			updatedAt: new Date(T0 + MIN).toISOString(),
			statusHistory: [
				{ status: 'saved', at: T0 },
				{ status: 'toured', at: T0 + MIN }
			]
		});
		expect(await shortlist.getByListingId('L1')).toEqual(toured);

		at(T0 + 2 * MIN);
		const same = await shortlist.setStatus('L1', 'toured');
		expect(same).toEqual(toured);
		const stored = await db.table(RENTER_SHORTLIST_TABLE).where('listingId').equals('L1').first();
		expect(stored.updatedAt).toBe(new Date(T0 + MIN).toISOString());
	});

	it('setNotes saves up to MAX_NOTES and rejects longer text without writing', async () => {
		const { shortlist, at } = setup();
		await shortlist.add(row('L1'), PROV);
		at(T0 + MIN);
		const ok = await shortlist.setNotes('L1', 'x'.repeat(MAX_NOTES));
		expect(ok?.notes).toHaveLength(MAX_NOTES);
		expect(ok?.updatedAt).toBe(new Date(T0 + MIN).toISOString());

		await expect(shortlist.setNotes('L1', 'y'.repeat(MAX_NOTES + 1))).rejects.toThrow(RangeError);
		expect((await shortlist.getByListingId('L1'))?.notes).toBe('x'.repeat(MAX_NOTES));
	});

	it('writes to a missing or removed listing are no-ops that return undefined', async () => {
		const { shortlist } = setup();
		expect(await shortlist.setStatus('nope', 'applied')).toBeUndefined();
		expect(await shortlist.setNotes('nope', 'hi')).toBeUndefined();
		await shortlist.remove('nope');
		await shortlist.add(row('L1'), PROV);
		await shortlist.remove('L1');
		expect(await shortlist.setStatus('L1', 'applied')).toBeUndefined();
		expect(await shortlist.count()).toBe(0);
	});

	it('getByListingId, liveAll and count ignore tombstones', async () => {
		const { shortlist } = setup();
		await shortlist.add(row('L1'), PROV);
		await shortlist.add(row('L2'), PROV);
		await shortlist.add(row('L3'), PROV);
		await shortlist.remove('L2');
		expect(await shortlist.getByListingId('L2')).toBeUndefined();
		expect((await shortlist.getByListingId('L3'))?.listingId).toBe('L3');
		expect((await shortlist.liveAll()).map((i) => i.listingId).sort()).toEqual(['L1', 'L3']);
		expect(await shortlist.count()).toBe(2);
	});

	it('liveCount emits the live count and follows writes', async () => {
		const { shortlist } = setup();
		const seen: number[] = [];
		const sub = shortlist.liveCount().subscribe((n) => seen.push(n));
		const until = async (n: number) => {
			for (let i = 0; i < 100 && seen.at(-1) !== n; i++) await new Promise((r) => setTimeout(r, 5));
		};
		await until(0);
		await shortlist.add(row('L1'), PROV);
		await until(1);
		await shortlist.remove('L1');
		await until(0);
		sub.unsubscribe();
		expect(seen[0]).toBe(0);
		expect(seen).toContain(1);
		expect(seen.at(-1)).toBe(0);
	});
});

describe('search meta repo', () => {
	const SEARCH_ID = '00000000-0000-4000-8000-0000000000c1';
	const FILTERS: RentalFilters = {
		priceMin: 900,
		priceMax: 1800,
		beds: '4+',
		types: ['Condo'],
		listedWithin: 7
	};
	const VALUE = {
		location: { kind: 'zip' as const, zipCode: '74201' },
		filters: FILTERS,
		sort: 'rent-asc' as const
	};

	it('put validates and stores under the Phase 4 saved-search id; get returns it', async () => {
		const { meta, db } = setup();
		const saved = await meta.put(SEARCH_ID, VALUE);
		expect(saved).toMatchObject({
			id: SEARCH_ID,
			...VALUE,
			ownerId: 'local',
			createdAt: new Date(T0).toISOString()
		});
		expect('deletedAt' in saved).toBe(false);
		expect(await meta.get(SEARCH_ID)).toEqual(saved);
		expect(await getMeta(db, META.firstRecordAt)).toBe(new Date(T0).toISOString());
	});

	it('put on an existing id keeps createdAt and bumps updatedAt', async () => {
		const { meta, at } = setup();
		const first = await meta.put(SEARCH_ID, VALUE);
		at(T0 + MIN);
		const next = await meta.put(SEARCH_ID, { ...VALUE, sort: 'newest' });
		expect(next.createdAt).toBe(first.createdAt);
		expect(next.updatedAt).toBe(new Date(T0 + MIN).toISOString());
		expect((await meta.get(SEARCH_ID))?.sort).toBe('newest');
	});

	it('put rejects invalid filters and writes nothing', async () => {
		const { meta } = setup();
		await expect(
			meta.put(SEARCH_ID, { ...VALUE, filters: { ...FILTERS, listedWithin: 5 as 7 } })
		).rejects.toThrow();
		await expect(
			meta.put(SEARCH_ID, { ...VALUE, location: { kind: 'zip', zipCode: '7420' } })
		).rejects.toThrow();
		expect(await meta.get(SEARCH_ID)).toBeUndefined();
	});

	it('remove tombstones it (hidden from get/liveAll); put restores it without deletedAt', async () => {
		const { meta, db, at } = setup();
		await meta.put(SEARCH_ID, VALUE);
		await meta.put('00000000-0000-4000-8000-0000000000c2', VALUE);
		at(T0 + MIN);
		await meta.remove(SEARCH_ID);
		expect(await meta.get(SEARCH_ID)).toBeUndefined();
		expect((await db.table(RENTER_SEARCH_META_TABLE).get(SEARCH_ID)).deletedAt).toBe(
			new Date(T0 + MIN).toISOString()
		);
		expect((await meta.liveAll()).map((m) => m.id)).toEqual([
			'00000000-0000-4000-8000-0000000000c2'
		]);

		const back = await meta.put(SEARCH_ID, VALUE);
		expect('deletedAt' in back).toBe(false);
		expect(await meta.get(SEARCH_ID)).toEqual(back);
	});
});

describe('backups', () => {
	it('registers both renter tables with their labels by default', () => {
		const list = listBackupTables();
		expect(list).toContainEqual({ name: 'renterShortlist', label: 'Rental shortlist' });
		expect(list).toContainEqual({ name: 'renterSearchMeta', label: 'Saved rental searches' });
		expect(RENTER_SHORTLIST_LABEL).toBe('Rental shortlist');
		expect(RENTER_SEARCH_META_LABEL).toBe('Saved rental searches');
	});

	it('export -> import round trip keeps a shortlist item with notes and status history', async () => {
		const src = setup();
		await src.shortlist.add(row('L1'), PROV);
		src.at(T0 + MIN);
		await src.shortlist.setStatus('L1', 'contacted');
		src.at(T0 + 2 * MIN);
		await src.shortlist.setNotes('L1', 'Call back Tuesday');
		await src.shortlist.add(row('L2'), PROV);
		await src.shortlist.remove('L2');
		await src.meta.put('00000000-0000-4000-8000-0000000000c1', {
			location: { kind: 'city', city: 'Harlow Springs', state: 'OK' },
			filters: {
				priceMin: null,
				priceMax: null,
				beds: 'any',
				types: [],
				listedWithin: 'any'
			},
			sort: 'newest'
		});
		const original = await src.shortlist.getByListingId('L1');

		const { text, counts } = await buildBackupText(src.db, {
			now: new Date(T0 + 3 * MIN),
			knownSecrets: []
		});
		expect(counts.renterShortlist).toBe(2);
		expect(counts.renterSearchMeta).toBe(1);

		const dst = setup();
		const preview = await previewImport(dst.db, {
			name: 'backup.json',
			size: text.length,
			text: async () => text
		});
		await applyImport(dst.db, preview, 'replace');

		const copied = await dst.shortlist.getByListingId('L1');
		expect(copied).toEqual(original);
		expect(copied?.notes).toBe('Call back Tuesday');
		expect(copied?.statusHistory.map((h) => h.status)).toEqual(['saved', 'contacted']);
		expect(await dst.shortlist.count()).toBe(1);
		expect(await dst.meta.get('00000000-0000-4000-8000-0000000000c1')).toBeDefined();
	});
});

describe('app singletons', () => {
	it('return one repo each, bound lazily (no database is opened by the call)', () => {
		expect(getShortlistRepo()).toBe(getShortlistRepo());
		expect(getSearchMetaRepo()).toBe(getSearchMetaRepo());
	});
});
