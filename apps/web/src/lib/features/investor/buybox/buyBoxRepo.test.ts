// Buy-box repository (07-14, INV-04): two rows per box (Phase 4 saved search + criteria), checked on
// app open by the ONE Phase 4 scheduler at most once per 24 hours, Check now = one call, local
// criteria filtering for "new since last visit". A live gateway over fake-indexeddb, a fetch spy
// that counts RentCast calls and an injected clock (never fake timers).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataRequest } from '@tran/core/request';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import type { TranDb } from '$lib/storage/db';
// Test-only harnesses from the data layer (same precedent as the renter saved-search tests).
// eslint-disable-next-line no-restricted-imports
import { jsonResponse, makeDb, spyFetch, T0 } from '$lib/data/testing/harness';
// eslint-disable-next-line no-restricted-imports
import { makeGateway } from '$lib/data/testing/gateway-harness';
// eslint-disable-next-line no-restricted-imports
import { runDueSearches } from '$lib/data/scheduler';
import { createInvestorPort, savedSearchRepo, type InvestorRuntime } from '../data/investor-port';
import {
	BuyBoxNotFoundError,
	BuyBoxValidationError,
	createBuyBoxRepo,
	emptyBuyBox,
	validateBuyBox,
	type BuyBoxInput
} from './buyBoxRepo';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const open: TranDb[] = [];
afterEach(() => {
	for (const db of open.splice(0)) db.close();
});

interface Row {
	id: string;
	price: number;
	bedrooms: number | null;
	propertyType: string;
	zip?: string;
	listedDate?: string;
}

const saleRow = (r: Row, zip: string) => ({
	id: r.id,
	price: r.price,
	status: 'Active',
	zipCode: r.zip ?? zip,
	formattedAddress: `${r.id} Example Way, Harlow Springs, TX ${r.zip ?? zip}`,
	addressLine1: `${r.id} Example Way`,
	city: 'Harlow Springs',
	state: 'TX',
	propertyType: r.propertyType,
	bedrooms: r.bedrooms,
	bathrooms: 2,
	listedDate: r.listedDate ?? '2026-10-01T00:00:00.000Z'
});

const BASE: Row[] = [
	{ id: 's1', price: 250_000, bedrooms: 3, propertyType: 'Single Family' },
	{ id: 's2', price: 180_000, bedrooms: 2, propertyType: 'Condo' }
];

/** RentCast stand-in: rows per location key (zip or city); counts every call. */
function world() {
	const clock = { now: T0 };
	const tick = () => clock.now;
	const rows = new Map<string, Row[]>([
		['79999', [...BASE]],
		['Harlow Springs', [...BASE]]
	]);
	const spy = spyFetch((url) => {
		const key = url.searchParams.get('zipCode') ?? url.searchParams.get('city') ?? '';
		return jsonResponse(
			200,
			(rows.get(key) ?? []).map((r) => saleRow(r, /^\d{5}$/.test(key) ? key : '79999'))
		);
	});
	const db = makeDb();
	open.push(db);
	const g = makeGateway({ fetch: spy.fetch, clock: tick, cap: 40, db });
	const runtime = {
		gateway: g.gateway,
		mode: null,
		requestSpend: vi.fn((req: DataRequest, kind: 'get' | 'refresh' = 'get') =>
			kind === 'refresh'
				? g.gateway.refresh(req, { intent: 'user' })
				: g.gateway.get(req, { intent: 'user' })
		)
	} as unknown as InvestorRuntime;
	const port = createInvestorPort(runtime);
	const phase4 = savedSearchRepo({ db, clock: tick });
	const repo = createBuyBoxRepo({ db: () => db, phase4: () => phase4, port, clock: tick });
	const confirm = vi.fn(async () => true);
	const appOpen = () => runDueSearches({ gateway: g.gateway, repo: phase4, clock: tick, confirm });
	const saleCalls = () => spy.calls.filter((c) => c.url.includes('/listings/sale')).length;
	return { clock, tick, rows, spy, db, g, port, phase4, repo, appOpen, saleCalls, runtime };
}

function box(o: Partial<BuyBoxInput['criteria']> = {}, name = 'Harlow starter homes'): BuyBoxInput {
	const b = emptyBuyBox();
	return { ...b, name, criteria: { ...b.criteria, location: '79999', ...o } };
}

describe('validateBuyBox', () => {
	it('returns stable error codes', () => {
		expect(validateBuyBox(box())).toEqual([]);
		expect(validateBuyBox(box({}, '  '))).toEqual(['name-empty']);
		expect(validateBuyBox(box({ location: '' }))).toEqual(['location-empty']);
		expect(validateBuyBox(box({ location: 'Nowhere' }))).toEqual(['location-unrecognized']);
		expect(
			validateBuyBox(box({ minPriceCents: 400_000 * 100, maxPriceCents: 300_000 * 100 }))
		).toEqual(['min-over-max']);
		expect(validateBuyBox(box({ minPriceCents: 300_000, maxPriceCents: 300_000 }))).toEqual([]);
	});

	it('createBuyBox rejects invalid input and writes nothing', async () => {
		const w = world();
		await expect(w.repo.createBuyBox(box({ location: 'Nowhere' }))).rejects.toBeInstanceOf(
			BuyBoxValidationError
		);
		expect(await w.db.savedSearches.count()).toBe(0);
		expect(await w.db.buyBoxes.count()).toBe(0);
	});
});

describe('createBuyBox', () => {
	it('writes a fetch-wide investor saved search and a same-id criteria row, at 0 calls', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(
			box({ minPriceCents: 10_000_000, maxPriceCents: 30_000_000, minBeds: 3 })
		);
		const [row] = await w.phase4.list();
		expect(row).toMatchObject({
			id: v.id,
			portal: 'investor',
			endpoint: 'sale-listings',
			name: 'Harlow starter homes',
			params: { zipCode: '79999', status: 'Active', limit: 500 },
			lastRunAt: null
		});
		expect(row!.params).not.toHaveProperty('minPrice');
		expect(row!.params).not.toHaveProperty('bedrooms');
		const rec = await w.db.buyBoxes.get(v.id);
		expect(rec).toMatchObject({ id: v.id, criteria: { minBeds: 3 }, expenseBps: 4000 });
		expect(rec!.deletedAt).toBeUndefined();
		expect(v).toMatchObject({ lastRunAt: null, createdAt: T0, expenseBps: 4000 });
		expect(w.spy.calls).toHaveLength(0);
		expect(await w.repo.listBuyBoxes()).toEqual([v]);
	});
});

describe('scheduler integration (Phase 4 check-on-open)', () => {
	it('runs a due buy box once: 1 call, 0 at +1h, 1 again at +24h', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box());
		w.clock.now = T0 + 1000;
		expect((await w.appOpen()).ran).toEqual([v.id]);
		expect(w.saleCalls()).toBe(1);
		expect((await w.repo.getBuyBox(v.id))!.lastRunAt).toBe(T0 + 1000);

		w.clock.now = T0 + 1000 + HOUR;
		expect((await w.appOpen()).ran).toEqual([]);
		expect(w.saleCalls()).toBe(1);

		w.clock.now = T0 + 1000 + DAY;
		expect((await w.appOpen()).ran).toEqual([v.id]);
		expect(w.saleCalls()).toBe(2);
	});

	it('two buy boxes in the same location cost 1 call (shared canonical key)', async () => {
		const w = world();
		await w.repo.createBuyBox(box({ minBeds: 3 }, 'Big'));
		await w.repo.createBuyBox(box({ propertyTypes: ['Condo'] }, 'Condos'));
		w.clock.now = T0 + 1000;
		expect((await w.appOpen()).ran).toHaveLength(2);
		expect(w.saleCalls()).toBe(1);
	});

	it('two tabs opening at once run the box once', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box());
		w.clock.now = T0 + 1000;
		const tab2 = savedSearchRepo({ db: w.db, clock: w.tick });
		const [a, b] = await Promise.all([
			w.appOpen(),
			runDueSearches({ gateway: w.g.gateway, repo: tab2, clock: w.tick, confirm: async () => true })
		]);
		expect([...a.ran, ...b.ran]).toEqual([v.id]);
		expect(w.saleCalls()).toBe(1);
	});
});

describe('checkNow, new since last visit and markSeen', () => {
	it('checkNow is 1 call uncached, 0 when fresh in cache, and counts criteria-matching new ids', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box({ minBeds: 3 }));
		w.clock.now = T0 + 1000;
		// s1 (3 bd) matches, s2 (2 bd) does not.
		expect(await w.repo.checkNow(v.id)).toEqual({ newCount: 1 });
		expect(w.saleCalls()).toBe(1);
		expect(w.runtime.requestSpend).toHaveBeenCalledTimes(1);
		expect(await w.repo.newMatchIds(v.id)).toEqual(new Set(['s1']));

		w.clock.now = T0 + 2000;
		expect(await w.repo.checkNow(v.id)).toEqual({ newCount: 1 });
		expect(w.saleCalls()).toBe(1);
		// The box now counts as run, so the on-open pass does not spend for it.
		expect((await w.appOpen()).ran).toEqual([]);
		expect(w.saleCalls()).toBe(1);
	});

	it('markSeen zeroes the count until a later run brings new matching ids', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box({ maxPriceCents: 30_000_000 }));
		w.clock.now = T0 + 1000;
		await w.appOpen();
		expect(await w.repo.newMatchCount(v.id)).toBe(2);

		w.clock.now = T0 + 2000;
		await w.repo.markSeen(v.id);
		expect(await w.repo.newMatchCount(v.id)).toBe(0);

		w.rows.set('79999', [
			...BASE,
			{ id: 's3', price: 290_000, bedrooms: 4, propertyType: 'Townhouse' },
			// Over the max price: new, but not a match.
			{ id: 's4', price: 900_000, bedrooms: 5, propertyType: 'Single Family' }
		]);
		w.clock.now = T0 + 1000 + DAY;
		await w.appOpen();
		expect(w.saleCalls()).toBe(2);
		expect(await w.repo.newMatchIds(v.id)).toEqual(new Set(['s3']));
		expect(await w.repo.newMatchCount(v.id)).toBe(1);
	});

	it('the new-since rule is strict: an id first seen exactly at lastSeenAt is not new', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box());
		// Same instant as create (lastSeenAt): firstSeenAt === lastSeenAt.
		await w.repo.checkNow(v.id);
		expect(await w.repo.newMatchCount(v.id)).toBe(0);
	});

	it('checkNow on an unknown id rejects without spending', async () => {
		const w = world();
		await expect(w.repo.checkNow('nope')).rejects.toBeInstanceOf(BuyBoxNotFoundError);
		expect(w.spy.calls).toHaveLength(0);
	});
});

describe('updateBuyBox and deleteBuyBox', () => {
	it('a location change resets lastRunAt and drops the snapshot; other edits keep them', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box());
		w.clock.now = T0 + 1000;
		await w.appOpen();

		w.clock.now = T0 + 2000;
		const kept = await w.repo.updateBuyBox(v.id, box({ minBeds: 2 }, 'Renamed'));
		expect(kept).toMatchObject({ name: 'Renamed', lastRunAt: T0 + 1000, criteria: { minBeds: 2 } });
		expect(await w.phase4.snapshot(v.id)).toBeDefined();

		const moved = await w.repo.updateBuyBox(v.id, box({ location: 'Harlow Springs, TX' }));
		expect(moved.lastRunAt).toBeNull();
		expect(await w.phase4.snapshot(v.id)).toBeUndefined();
		const [row] = await w.phase4.list();
		expect(row!.params).toEqual({
			city: 'Harlow Springs',
			state: 'TX',
			status: 'Active',
			limit: 500
		});
		// Due at once for the new geography.
		expect((await w.appOpen()).ran).toEqual([v.id]);
		expect(w.saleCalls()).toBe(2);
	});

	it('updateBuyBox on a missing box rejects', async () => {
		const w = world();
		await expect(w.repo.updateBuyBox('nope', box())).rejects.toBeInstanceOf(BuyBoxNotFoundError);
	});

	it('deleteBuyBox removes the saved search, its snapshot and the criteria row', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box());
		w.clock.now = T0 + 1000;
		await w.appOpen();
		await w.repo.deleteBuyBox(v.id);
		expect(await w.phase4.list()).toEqual([]);
		expect(await w.phase4.snapshot(v.id)).toBeUndefined();
		expect((await w.db.buyBoxes.get(v.id))!.deletedAt).toBeDefined();
		expect(await w.repo.listBuyBoxes()).toEqual([]);
		w.clock.now = T0 + 1000 + DAY;
		expect((await w.appOpen()).due).toBe(0);
	});

	it('lists only investor boxes with a live criteria row', async () => {
		const w = world();
		await w.phase4.create({
			portal: 'renter',
			name: 'Rentals',
			endpoint: 'rental-listings',
			params: { zipCode: '79999', status: 'Active', limit: 500, offset: 0 }
		});
		const v = await w.repo.createBuyBox(box());
		expect((await w.repo.listBuyBoxes()).map((b) => b.id)).toEqual([v.id]);
	});
});

describe('backup', () => {
	it('round-trips the criteria row and the saved search', async () => {
		const w = world();
		const v = await w.repo.createBuyBox(box({ propertyTypes: ['Condo', 'Single Family'] }));
		const { text, counts } = await buildBackupText(w.db, { now: new Date(T0), knownSecrets: [] });
		expect(counts).toMatchObject({ buyBoxes: 1, savedSearches: 1 });

		const fresh = makeDb();
		open.push(fresh);
		const preview = await previewImport(fresh, {
			name: 'tran-backup.json',
			size: text.length,
			text: async () => text
		});
		await applyImport(fresh, preview, 'replace');
		const restored = createBuyBoxRepo({
			db: () => fresh,
			phase4: () => savedSearchRepo({ db: fresh, clock: w.tick }),
			port: w.port,
			clock: w.tick
		});
		expect(await restored.listBuyBoxes()).toEqual([v]);
	});
});
