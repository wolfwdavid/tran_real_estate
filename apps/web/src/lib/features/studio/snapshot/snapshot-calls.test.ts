// Market Snapshot call budget (STU-04, ROADMAP SC5): cached ZIP 0 calls, new ZIP 1, new ZIP plus
// the active-listings summary 2, a second snapshot for the same ZIP 0, and keyless sample mode
// never reaches any host. Runs the REAL data runtime (mode selection, requestSpend, cap prompt)
// over the REAL live gateway (cache, ledger, RentCast client) with an injected fetch spy, so every
// counted request went through the gateway and its budget guard.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGatewayError } from '@tran/core/request';
import { AGGREGATED_SAMPLE_KEYS, BEDROOM_AGGREGATE_KEYS } from '@tran/core/studio';
import { createDataRuntime, type DataRuntime } from '$lib/data';
// eslint-disable-next-line no-restricted-imports -- test-only: committed synthetic market fixture, re-keyed to a fictional ZIP
import markets from '$lib/data/fixtures/markets.json';
// eslint-disable-next-line no-restricted-imports -- test-only: the real sample-mode fixture loader
import { loadFixtureSet } from '$lib/data/fixtures/load';
// eslint-disable-next-line no-restricted-imports -- test-only: the Phase 4 key-port contract for a fake key
import type { KeyPort } from '$lib/data/runtime.svelte';
// eslint-disable-next-line no-restricted-imports -- test-only: isolated fake-indexeddb, fetch spy, fixed clock
import { jsonResponse, makeDb, spyFetch, T0, TEST_KEY } from '$lib/data/testing/harness';
// eslint-disable-next-line no-restricted-imports -- test-only: synthetic listing rows (fictional addresses)
import { listingRows } from '$lib/data/testing/gateway-harness';
import { loadMarket } from '$lib/features/shared/markets/market-load';
import { createMarketsPort, type PortRuntime } from '$lib/features/shared/markets/markets-port';
import { createSnapshotData, listingsSummaryRequest } from './snapshot-data';

const ZIP = '00199';
const SAMPLE_ZIP = '74201';

/** Synthetic RentCast /v1/markets body (the committed fixture, re-keyed to the fictional ZIP). */
const marketsBody = (zip: string) => ({ ...structuredClone(markets[0]), zipCode: zip });

function keys(key: string | null): KeyPort {
	return {
		get: () => key,
		state: () => (key ? 'available' : 'none'),
		onChange: () => () => undefined
	};
}

function network() {
	return spyFetch((url) => {
		const zip = url.searchParams.get('zipCode') ?? ZIP;
		if (url.pathname === '/v1/markets') return jsonResponse(200, marketsBody(zip));
		if (url.pathname === '/v1/listings/sale' || url.pathname === '/v1/listings/rental/long-term') {
			return jsonResponse(200, listingRows(6, zip));
		}
		return jsonResponse(404, { status: 404 });
	});
}

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.unstubAllGlobals();
});

async function runtime(key: string | null) {
	const net = network();
	const rt = createDataRuntime({
		db: makeDb(),
		clock: () => T0,
		fetch: net.fetch,
		keys: keys(key),
		channel: null,
		reactiveGuard: () => false,
		loadFixtures: loadFixtureSet
	});
	cleanups.push(await rt.start());
	return { rt, calls: net.calls };
}

const billed = async (rt: DataRuntime) => (await rt.gateway!.usage()).billed;
const toMarkets = (calls: { url: string }[]) =>
	calls.filter((c) => new URL(c.url).pathname === '/v1/markets');
const toSales = (calls: { url: string }[]) =>
	calls.filter((c) => new URL(c.url).pathname === '/v1/listings/sale');

describe('snapshot data with a RentCast key (live gateway)', () => {
	it('new ZIP: the cost says 1 call, loading spends exactly 1 markets call, a repeat spends 0', async () => {
		const { rt, calls } = await runtime(TEST_KEY);
		const data = createSnapshotData(rt);

		expect(await data.snapshotZipCost(ZIP)).toEqual({ calls: 1, cached: false, sample: false });
		expect(calls).toHaveLength(0);

		const first = await data.loadZipData(ZIP);
		expect(calls).toHaveLength(1);
		expect(toMarkets(calls)).toHaveLength(1);
		expect(await billed(rt)).toBe(1);
		expect(first.source).toBe('rentcast');
		expect(first.placeName).toBeNull();
		expect(first.stats.zipCode).toBe(ZIP);
		expect(first.fetchedAt).toBe(new Date(T0).toISOString());

		// A second snapshot for the same ZIP: cached, 0 calls.
		expect(await data.snapshotZipCost(ZIP)).toEqual({ calls: 0, cached: true, sample: false });
		const second = await data.loadZipData(ZIP);
		expect(calls).toHaveLength(1);
		expect(await billed(rt)).toBe(1);
		expect(second.fetchedAt).toBe(first.fetchedAt);
	});

	it('a ZIP the investor dashboard already loaded is a cache hit (same canonical key): 0 calls', async () => {
		const { rt, calls } = await runtime(TEST_KEY);
		const outcome = await loadMarket(createMarketsPort(rt), ZIP);
		expect(outcome.ok).toBe(true);
		expect(calls).toHaveLength(1);

		const data = createSnapshotData(rt);
		expect(await data.snapshotZipCost(ZIP)).toEqual({ calls: 0, cached: true, sample: false });
		const zip = await data.loadZipData(ZIP);
		expect(calls).toHaveLength(1);
		expect(await billed(rt)).toBe(1);
		// The domain shape keeps what the snapshot needs (the port's chart input drops it).
		expect(zip.stats.sale).not.toBeNull();
		expect(zip.stats.rental).not.toBeNull();
	});

	it('new ZIP + sale listings summary = 2 calls in total, and the summary is aggregate-only', async () => {
		const { rt, calls } = await runtime(TEST_KEY);
		const data = createSnapshotData(rt);
		await data.loadZipData(ZIP);

		expect(await data.listingsSummaryCost(ZIP, 'sale')).toEqual({
			calls: 1,
			cached: false,
			sample: false
		});
		const summary = await data.loadListingsSummary(ZIP, 'sale');
		expect(calls).toHaveLength(2);
		expect(toMarkets(calls)).toHaveLength(1);
		expect(toSales(calls)).toHaveLength(1);
		expect(new URL(toSales(calls)[0].url).searchParams.get('zipCode')).toBe(ZIP);
		expect(await billed(rt)).toBe(2);

		expect(Object.keys(summary).sort()).toEqual(['fetchedAt', 'sample']);
		expect(Object.keys(summary.sample)).toEqual([...AGGREGATED_SAMPLE_KEYS]);
		expect(summary.sample.kind).toBe('sale');
		expect(summary.sample.total).toBe(6);
		for (const row of summary.sample.byBedroom) {
			expect(Object.keys(row)).toEqual([...BEDROOM_AGGREGATE_KEYS]);
		}
		const json = JSON.stringify(summary);
		for (const banned of ['formattedAddress', 'addressLine1', 'Sample Way', 'SAMPLE-00199']) {
			expect(json).not.toContain(banned);
		}

		// Both cached now: a second full snapshot spends 0.
		expect(await data.listingsSummaryCost(ZIP, 'sale')).toEqual({
			calls: 0,
			cached: true,
			sample: false
		});
		await data.loadZipData(ZIP);
		await data.loadListingsSummary(ZIP, 'sale');
		expect(calls).toHaveLength(2);
		expect(await billed(rt)).toBe(2);
	});

	it('calls the gateway exactly once per load, and the listings request is the ZIP search request', async () => {
		const { rt, calls } = await runtime(TEST_KEY);
		const get = vi.spyOn(rt.gateway!, 'get');
		const requestSpend = vi.fn(rt.requestSpend.bind(rt));
		const port: PortRuntime = {
			get gateway() {
				return rt.gateway;
			},
			requestSpend
		} as PortRuntime;
		const data = createSnapshotData(port);

		await data.snapshotZipCost(ZIP);
		await data.listingsSummaryCost(ZIP, 'rental');
		expect(requestSpend).toHaveBeenCalledTimes(0);
		expect(get).toHaveBeenCalledTimes(0);

		await data.loadZipData(ZIP);
		await data.loadListingsSummary(ZIP, 'rental');
		expect(requestSpend).toHaveBeenCalledTimes(2);
		expect(get).toHaveBeenCalledTimes(2);
		expect(requestSpend.mock.calls[1][0]).toEqual(listingsSummaryRequest(ZIP, 'rental'));
		expect(listingsSummaryRequest(ZIP, 'rental')).toEqual({
			endpoint: 'rental-listings',
			params: { zipCode: ZIP, status: 'Active', limit: 500, offset: 0 }
		});
		expect(calls).toHaveLength(2);
	});

	it('at the cap the listings summary waits on the confirm prompt; "Not now" spends nothing', async () => {
		const { rt, calls } = await runtime(TEST_KEY);
		await rt.saveCap(1);
		const data = createSnapshotData(rt);
		await data.loadZipData(ZIP);
		expect(calls).toHaveLength(1);

		const pending = data.loadListingsSummary(ZIP, 'sale');
		await vi.waitFor(() => expect(rt.capPrompt).not.toBeNull());
		rt.cancelCapPrompt();
		const err = await pending.catch((e: unknown) => e);
		expect(isGatewayError(err) && err.kind === 'BudgetCapReached').toBe(true);
		expect(calls).toHaveLength(1);
		expect(await billed(rt)).toBe(1);
	});
});

describe('snapshot data without a key (sample mode)', () => {
	it('costs 0, loads fixture stats badged sample, and makes 0 requests to any host', async () => {
		const globalFetch = vi.fn();
		vi.stubGlobal('fetch', globalFetch);
		const { rt, calls } = await runtime(null);
		expect(rt.gateway!.source).toBe('sample');
		const data = createSnapshotData(rt);

		expect(await data.snapshotZipCost(SAMPLE_ZIP)).toEqual({
			calls: 0,
			cached: false,
			sample: true
		});
		expect(await data.listingsSummaryCost(SAMPLE_ZIP, 'sale')).toEqual({
			calls: 0,
			cached: false,
			sample: true
		});
		const zip = await data.loadZipData(SAMPLE_ZIP);
		expect(zip.source).toBe('sample');
		expect(zip.stats.zipCode).toBe(SAMPLE_ZIP);
		expect(zip.placeName).toBe('Harlow Springs, OK');
		const summary = await data.loadListingsSummary(SAMPLE_ZIP, 'sale');
		expect(summary.sample.total).toBeGreaterThan(0);

		expect(calls).toHaveLength(0);
		expect(globalFetch).not.toHaveBeenCalled();
		expect(await billed(rt)).toBe(0);
	});
});

describe('module load', () => {
	it('importing snapshot-data issues no request', async () => {
		const globalFetch = vi.fn();
		vi.stubGlobal('fetch', globalFetch);
		vi.resetModules();
		const mod = await import('./snapshot-data');
		expect(typeof mod.createSnapshotData).toBe('function');
		expect(globalFetch).not.toHaveBeenCalled();
	});
});
