// The renter search controller (06-13, RENT-01/RENT-02). Spends only on an explicit search() or
// narrow(); URL restore and every filter/sort change are 0 calls. Runs through the public
// $lib/data port in live mode with a spy fetch, an injected clock and an isolated fake IndexedDB
// (never vi.useFakeTimers with fake-indexeddb).
import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { encodeSearchParams } from '@tran/core/renter';
import type { Listing } from '@tran/core/listings';
import { createDataRuntime, type DataGateway, type DataRequest } from '$lib/data';
import { TranDb } from '$lib/storage/db';
import { createRenterSearch } from './search-state.svelte';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const HOUR = 3_600_000;
const KEY = 'test-key-not-real';

type Row = Record<string, unknown>;

/** A schema-valid synthetic rental row (fictional address). */
function row(i: number, zip: string, over: Row = {}): Row {
	const types = ['Apartment', 'Condo', 'Single Family', 'Townhouse'];
	return {
		id: `SAMPLE-${zip}-R${String(i).padStart(3, '0')}`,
		price: 1000 + (i % 10) * 200,
		status: 'Active',
		zipCode: zip,
		formattedAddress: `${100 + i} Sample Way, Testville, OK ${zip}`,
		addressLine1: `${100 + i} Sample Way`,
		city: 'Testville',
		state: 'OK',
		propertyType: types[i % types.length],
		bedrooms: i % 4,
		bathrooms: 1,
		listedDate: new Date(T0 - (i % 40) * 86_400_000).toISOString(),
		...over
	};
}

const rows = (n: number, zip: string): Row[] =>
	Array.from({ length: n }, (_, i) => row(i + 1, zip));

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

interface Setup {
	calls: string[];
	gateway: DataGateway;
	runtime: ReturnType<typeof createDataRuntime>;
	at(t: number): void;
	controller(): ReturnType<typeof createRenterSearch>;
	announced: string[];
}

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const c of cleanups.splice(0)) c();
});

/** Live mode: 74201 has 12 rows, 74299 is a 404, 70201 returns exactly 500 rows. */
async function setup(): Promise<Setup> {
	let now = T0;
	const calls: string[] = [];
	const fetchSpy = (async (input: RequestInfo | URL) => {
		const url = new URL(
			typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		);
		calls.push(url.href);
		const zip = url.searchParams.get('zipCode') ?? '';
		if (zip === '74201') return json(200, rows(12, zip));
		if (zip === '70201') return json(200, rows(500, zip));
		return json(404, { error: 'resource/not-found' });
	}) as typeof fetch;
	const db = new TranDb({ indexedDB: new IDBFactory(), IDBKeyRange }, `t-${crypto.randomUUID()}`);
	const runtime = createDataRuntime({
		db,
		clock: () => now,
		fetch: fetchSpy,
		keys: { get: () => KEY, state: () => 'available', onChange: () => () => {} },
		channel: null,
		reactiveGuard: () => false
	});
	const stop = await runtime.start();
	cleanups.push(() => {
		stop();
		db.close();
	});
	expect(runtime.mode?.source).toBe('rentcast');
	const announced: string[] = [];
	return {
		calls,
		gateway: runtime.gateway as DataGateway,
		runtime,
		announced,
		at: (t) => {
			now = t;
		},
		controller: () =>
			createRenterSearch({
				gateway: () => runtime.gateway,
				spend: (req: DataRequest, kind?: 'get' | 'refresh') =>
					runtime.requestSpend<Listing[]>(req, kind),
				now: () => new Date(now),
				announce: (m) => announced.push(m)
			})
	};
}

describe('restoreFromUrl never spends', () => {
	it('an uncached location prefills the form and waits (0 fetches)', async () => {
		const s = await setup();
		const search = s.controller();
		await search.restoreFromUrl(new URLSearchParams('loc=74201&max=2000'));
		expect(search.locInput).toBe('74201');
		expect(search.location).toEqual({ kind: 'zip', zipCode: '74201' });
		expect(search.filters.priceMax).toBe(2000);
		expect(search.rows).toEqual([]);
		expect(search.status).toBe('idle');
		expect(s.calls).toHaveLength(0);
	});

	it('a cached location renders from cache with the original fetchedAt (0 more fetches)', async () => {
		const s = await setup();
		const first = s.controller();
		first.locInput = '74201';
		await first.search();
		expect(s.calls).toHaveLength(1);

		s.at(T0 + 3 * HOUR);
		const second = s.controller();
		await second.restoreFromUrl(new URLSearchParams('loc=74201&sort=rent-asc'));
		expect(second.status).toBe('ready');
		expect(second.rows).toHaveLength(12);
		expect(second.provenance?.fetchedAt).toBe(T0);
		expect(second.sort).toBe('rent-asc');
		expect(s.calls).toHaveLength(1);
	});

	it('an unparseable or empty loc stays idle without an error or a fetch', async () => {
		const s = await setup();
		const search = s.controller();
		await search.restoreFromUrl(new URLSearchParams('loc=Austin&beds=2'));
		expect(search.locInput).toBe('Austin');
		expect(search.location).toBeNull();
		expect(search.locationError).toBeNull();
		expect(search.filters.beds).toBe(2);
		await search.restoreFromUrl(new URLSearchParams(''));
		expect(search.status).toBe('idle');
		expect(s.calls).toHaveLength(0);
	});
});

describe('search() validates before spending', () => {
	it("an empty location is 'empty' and 'Austin' is 'city-without-state', 0 fetches", async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '';
		await search.search();
		expect(search.locationError).toBe('empty');
		search.locInput = 'Austin';
		await search.search();
		expect(search.locationError).toBe('city-without-state');
		expect(search.status).toBe('idle');
		expect(s.calls).toHaveLength(0);
	});

	it('min > max sets rentError and does not fetch', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '74201';
		search.setFilters({ ...search.filters, priceMin: 3000, priceMax: 2000 });
		expect(search.rentError).toBe(true);
		await search.search();
		expect(s.calls).toHaveLength(0);
		search.setFilters({ ...search.filters, priceMin: 1000 });
		expect(search.rentError).toBe(false);
	});
});

describe('fetch wide, filter local', () => {
	it('one search spends exactly 1 call; five filter/sort changes spend 0 and apply at once', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '74201';
		await search.search();
		expect(s.calls).toHaveLength(1);
		expect(new URL(s.calls[0]).searchParams.toString()).toBe(
			'zipCode=74201&status=Active&limit=500'
		);
		expect(search.status).toBe('ready');
		expect(search.rows).toHaveLength(12);
		expect(search.filtered).toHaveLength(12);
		expect(s.announced).toContain('12 rentals found in 74201.');

		search.setFilters({ ...search.filters, priceMax: 1600 });
		const afterMax = search.filtered.length;
		expect(afterMax).toBeLessThan(12);
		expect(search.filtered.every((r) => (r.price ?? 0) <= 1600)).toBe(true);

		search.setFilters({ ...search.filters, beds: 2 });
		expect(search.filtered.every((r) => r.bedrooms === 2)).toBe(true);

		search.setFilters({ ...search.filters, types: ['Condo', 'Apartment'] });
		search.setFilters({ ...search.filters, listedWithin: 14 });
		search.setSort('rent-asc');
		const prices = search.sorted.map((r) => r.price ?? 0);
		expect(prices).toEqual([...prices].sort((a, b) => a - b));

		// Five changes later, still the one call.
		expect(s.calls).toHaveLength(1);
	});

	it('removeFilter and clearFilters are local too', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '74201';
		await search.search();
		search.setFilters({ ...search.filters, beds: 1, priceMax: 1400 });
		const narrowed = search.filtered.length;
		search.removeFilter('beds');
		expect(search.filters.beds).toBe('any');
		expect(search.filtered.length).toBeGreaterThanOrEqual(narrowed);
		search.clearFilters();
		expect(search.filtered).toHaveLength(12);
		expect(s.calls).toHaveLength(1);
	});

	it('a repeat search of the same location is served from cache (0 more calls)', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '74201';
		await search.search();
		search.showMore();
		expect(search.shownCount).toBe(48);
		search.select('x');
		await search.search();
		expect(s.calls).toHaveLength(1);
		expect(search.shownCount).toBe(24);
		expect(search.selectedListingId).toBeNull();
	});
});

describe('truncation and narrow()', () => {
	it('a 500-row answer is truncated; narrow() spends 1 more call with price bounds, never offset', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '70201';
		await search.search();
		expect(search.rows).toHaveLength(500);
		expect(search.truncated).toBe(true);

		search.setFilters({ ...search.filters, priceMax: 2000 });
		expect(s.calls).toHaveLength(1);
		await search.narrow();
		expect(s.calls).toHaveLength(2);
		expect(s.calls[1]).toMatch(/price=0(%3A|:)2000/);
		for (const url of s.calls) expect(url).not.toContain('offset');
	});
});

describe('errors', () => {
	it('a 404 location is NoResults with no rows', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '74299';
		await search.search();
		expect(search.status).toBe('error');
		expect(search.error?.kind).toBe('NoResults');
		expect(search.rows).toEqual([]);
		expect(s.calls).toHaveLength(1);
	});
});

describe('URL state', () => {
	it('toUrlParams() is encodeSearchParams of the current state', async () => {
		const s = await setup();
		const search = s.controller();
		search.locInput = '74201';
		await search.search();
		search.setFilters({ ...search.filters, priceMax: 2000, beds: 2, types: ['Condo'] });
		search.setSort('rent-asc');
		search.setView('map');
		const expected = encodeSearchParams({
			locInput: '74201',
			filters: search.filters,
			sort: 'rent-asc',
			view: 'map'
		});
		expect(search.toUrlParams().toString()).toBe(expected.toString());
		expect(search.toUrlParams().toString()).toBe(
			'loc=74201&max=2000&beds=2&type=Condo&sort=rent-asc&view=map'
		);
	});

	it('typing in the location box does not change the URL until a search commits it', async () => {
		const s = await setup();
		const search = s.controller();
		await search.restoreFromUrl(new URLSearchParams('loc=74201'));
		search.locInput = '7420';
		expect(search.toUrlParams().get('loc')).toBe('74201');
		expect(s.calls).toHaveLength(0);
	});
});
