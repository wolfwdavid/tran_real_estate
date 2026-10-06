// The shared markets port (07-09, INV-05): canonical request, free peek/estimate, one-call load,
// and the mapping of Phase 4's domain MarketStats (from the committed fixtures) into the core input.
import { describe, expect, it, vi } from 'vitest';
import { canonicalKey, GatewayError, type DataRequest } from '@tran/core/request';
import type { MarketStats } from '@tran/core/listings';
import { rentTrendSeries } from '@tran/core/markets';
// eslint-disable-next-line no-restricted-imports -- test-only: the committed synthetic fixtures prove the real mapper output
import markets from '$lib/data/fixtures/markets.json';
// eslint-disable-next-line no-restricted-imports -- test-only: maps the fixture exactly as the gateway does
import { mapPayload } from '$lib/data/rentcast/mappers';
// eslint-disable-next-line no-restricted-imports -- test-only: validates the fixture exactly as the gateway does
import { parsePayload } from '$lib/data/rentcast/schemas';
import {
	createMarketsPort,
	DataRuntimeNotStartedError,
	MARKET_HISTORY_MONTHS,
	marketStatsRequest,
	type PortRuntime
} from './markets-port';

const fixture = markets[0];
const ZIP = fixture.zipCode;

function domain(): MarketStats {
	const r = parsePayload('markets', fixture);
	if (!r.ok) throw new Error(r.issues.join(', '));
	return mapPayload(r.payload) as MarketStats;
}

const PROV = { source: 'sample' as const, fetchedAt: 1_760_000_000_000, stale: false };
const result = (data: unknown, req: DataRequest) => ({
	data,
	provenance: PROV,
	truncated: false,
	droppedRows: 0,
	requestKey: canonicalKey(req)
});

function fakeRuntime(o: { peek?: unknown; cost?: { calls: number; reason: string } } = {}) {
	const gateway = {
		peek: vi.fn(async (req: DataRequest) =>
			o.peek === undefined ? { kind: 'data', result: result(domain(), req) } : o.peek
		),
		estimateCost: vi.fn(async () => o.cost ?? { calls: 1, reason: 'network' }),
		get: vi.fn(),
		refresh: vi.fn()
	};
	const requestSpend = vi.fn(async (req: DataRequest) => result(domain(), req));
	const runtime = { gateway, requestSpend } as unknown as PortRuntime;
	return { runtime, gateway, requestSpend };
}

describe('marketStatsRequest (canonical, shared with the renter portal and Phase 9)', () => {
	it('asks for all data types and 24 months of history', () => {
		expect(MARKET_HISTORY_MONTHS).toBe(24);
		expect(marketStatsRequest('79999')).toEqual({
			endpoint: 'markets',
			params: { zipCode: '79999', dataType: 'All', historyRange: 24 }
		});
		expect(canonicalKey(marketStatsRequest('79999'))).toBe(
			'markets?dataType=All&historyRange=24&zipCode=79999'
		);
	});
});

describe('createMarketsPort', () => {
	it('estimateCost passes the gateway estimate through for the canonical request', async () => {
		const { runtime, gateway } = fakeRuntime({ cost: { calls: 0, reason: 'cached' } });
		expect(await createMarketsPort(runtime).estimateCost('79999')).toEqual({
			calls: 0,
			reason: 'cached'
		});
		expect(gateway.estimateCost).toHaveBeenCalledWith(marketStatsRequest('79999'));
	});

	it('peek reads only the cache (get/refresh/requestSpend never called) and maps the stats', async () => {
		const { runtime, gateway, requestSpend } = fakeRuntime();
		const r = await createMarketsPort(runtime).peek(ZIP);
		expect(gateway.peek).toHaveBeenCalledTimes(1);
		expect(gateway.get).toHaveBeenCalledTimes(0);
		expect(gateway.refresh).toHaveBeenCalledTimes(0);
		expect(requestSpend).toHaveBeenCalledTimes(0);
		expect(r?.provenance).toEqual(PROV);
		expect(r?.stats.zipCode).toBe(ZIP);
		expect(r?.stats.rentalData?.medianRent).toBe(fixture.rentalData.medianRent);
		expect(r?.stats.saleData?.medianPrice).toBe(fixture.saleData.medianPrice);
		expect(Object.keys(r?.stats.rentalData?.history ?? {})).toHaveLength(24);
	});

	it('carries each month’s bedroom breakdown so the rent-trend series is not empty', async () => {
		const { runtime } = fakeRuntime();
		const r = await createMarketsPort(runtime).peek(ZIP);
		const months = Object.keys(fixture.rentalData.history).sort();
		const first = months[0] as keyof typeof fixture.rentalData.history;
		const raw = fixture.rentalData.history[first].dataByBedrooms[3];
		expect(r?.stats.rentalData?.history?.[first].dataByBedrooms?.[3]).toEqual({
			bedrooms: raw.bedrooms,
			medianRent: raw.medianRent,
			totalListings: raw.totalListings
		});
		const trend = rentTrendSeries(r!.stats);
		expect(trend.months).toHaveLength(24);
		expect(trend.series.map((s) => s.key)).toEqual(['studio', '1', '2', '3', '4plus']);
	});

	it('peek returns undefined when nothing is cached and throws a cached error', async () => {
		const none = fakeRuntime({ peek: null });
		none.gateway.peek.mockResolvedValueOnce(undefined as never);
		expect(await createMarketsPort(none.runtime).peek(ZIP)).toBeUndefined();

		const err = new GatewayError({ kind: 'NoResults' });
		const cachedErr = fakeRuntime({ peek: { kind: 'error', error: err } });
		await expect(createMarketsPort(cachedErr.runtime).peek(ZIP)).rejects.toBe(err);
	});

	it('load spends through requestSpend (get, or refresh when asked) and maps', async () => {
		const { runtime, requestSpend } = fakeRuntime();
		const port = createMarketsPort(runtime);
		const r = await port.load(ZIP);
		expect(requestSpend).toHaveBeenLastCalledWith(marketStatsRequest(ZIP), 'get');
		expect(r.stats.rentalData?.medianRent).toBe(fixture.rentalData.medianRent);
		await port.load(ZIP, { refresh: true });
		expect(requestSpend).toHaveBeenLastCalledWith(marketStatsRequest(ZIP), 'refresh');
		expect(requestSpend).toHaveBeenCalledTimes(2);
	});

	it('a NoResults error from load propagates unchanged', async () => {
		const { runtime, requestSpend } = fakeRuntime();
		const err = new GatewayError({ kind: 'NoResults' });
		requestSpend.mockRejectedValueOnce(err);
		await expect(createMarketsPort(runtime).load('79999')).rejects.toBe(err);
	});

	it('reports a runtime that has not started instead of spending', async () => {
		const port = createMarketsPort({
			gateway: null,
			requestSpend: vi.fn()
		} as unknown as PortRuntime);
		await expect(port.peek(ZIP)).rejects.toBeInstanceOf(DataRuntimeNotStartedError);
		await expect(port.estimateCost(ZIP)).rejects.toBeInstanceOf(DataRuntimeNotStartedError);
	});
});
