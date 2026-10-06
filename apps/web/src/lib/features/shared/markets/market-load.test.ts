// market-load (07-13): the view read never spends; the click load maps over-cap and errors.
import { describe, expect, it, vi } from 'vitest';
import { GatewayError } from '$lib/data';
import type { MarketResult, MarketsPort } from './markets-port';
import { loadMarket, readMarketOnMount } from './market-load';

const RESULT = {
	stats: { zipCode: '79999', rentalData: null, saleData: null },
	provenance: { source: 'rentcast', fetchedAt: 0 }
} as unknown as MarketResult;

function fakePort(load: MarketsPort['load'] = async () => RESULT) {
	const port = {
		estimateCost: vi.fn(async () => ({ calls: 1, reason: 'network' })),
		peek: vi.fn(async () => RESULT),
		load: vi.fn(load)
	};
	return port as typeof port & MarketsPort;
}

const capError = (detail?: 'dismissed') =>
	new GatewayError({ kind: 'BudgetCapReached', used: 40, cap: 40, requestKey: 'k', detail });

describe('readMarketOnMount', () => {
	it('reads with peek only: the load spy stays at 0', async () => {
		const port = fakePort();
		await expect(readMarketOnMount(port, '79999')).resolves.toBe(RESULT);
		expect(port.peek).toHaveBeenCalledExactlyOnceWith('79999');
		expect(port.load).toHaveBeenCalledTimes(0);
		expect(port.estimateCost).toHaveBeenCalledTimes(0);
	});

	it('returns undefined when nothing is cached, still without loading', async () => {
		const port = fakePort();
		port.peek.mockResolvedValueOnce(undefined as unknown as MarketResult);
		await expect(readMarketOnMount(port, '79999')).resolves.toBeUndefined();
		expect(port.load).toHaveBeenCalledTimes(0);
	});

	it('throws a cached error for the caller to render', async () => {
		const port = fakePort();
		const err = new GatewayError({ kind: 'NoResults' });
		port.peek.mockRejectedValueOnce(err);
		await expect(readMarketOnMount(port, '79999')).rejects.toBe(err);
		expect(port.load).toHaveBeenCalledTimes(0);
	});
});

describe('loadMarket', () => {
	it('returns ok with the result on success (one load)', async () => {
		const port = fakePort();
		await expect(loadMarket(port, '79999')).resolves.toEqual({ ok: true, result: RESULT });
		expect(port.load).toHaveBeenCalledExactlyOnceWith('79999', {});
	});

	it('passes refresh through', async () => {
		const port = fakePort();
		await loadMarket(port, '79999', { refresh: true });
		expect(port.load).toHaveBeenCalledExactlyOnceWith('79999', { refresh: true });
	});

	it('maps BudgetCapReached to kind cap; retry loads exactly once more', async () => {
		let calls = 0;
		const port = fakePort(async () => {
			calls += 1;
			if (calls === 1) throw capError();
			return RESULT;
		});
		const out = await loadMarket(port, '79999');
		expect(out).toMatchObject({ ok: false, kind: 'cap', dismissed: false });
		expect(port.load).toHaveBeenCalledTimes(1);
		if (out.ok || out.kind !== 'cap') throw new Error('expected cap');
		await expect(out.retry()).resolves.toEqual({ ok: true, result: RESULT });
		expect(port.load).toHaveBeenCalledTimes(2);
	});

	it('marks a "Not now" answer as dismissed (nothing spent)', async () => {
		const port = fakePort(async () => {
			throw capError('dismissed');
		});
		await expect(loadMarket(port, '79999')).resolves.toMatchObject({
			ok: false,
			kind: 'cap',
			dismissed: true
		});
	});

	it('returns kind error for any other failure and never throws', async () => {
		const net = new GatewayError({ kind: 'NetworkError', detail: 'server' });
		const port = fakePort(async () => {
			throw net;
		});
		await expect(loadMarket(port, '79999')).resolves.toEqual({
			ok: false,
			kind: 'error',
			error: net
		});
		const boom = new Error('boom');
		const port2 = fakePort(async () => {
			throw boom;
		});
		await expect(loadMarket(port2, '79999')).resolves.toEqual({
			ok: false,
			kind: 'error',
			error: boom
		});
	});
});
