// InvestorDataPort (07-09, INV-02/INV-03): one adapter over the Phase 4 runtime. Free peeks and cost
// estimates, one-call spends through requestSpend, request shapes, and dollars -> cents once.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { canonicalKey, type DataRequest } from '@tran/core/request';
import type { Listing, PriceEstimate, RentEstimate } from '@tran/core/listings';
import {
	createInvestorPort,
	DataRuntimeNotStartedError,
	InvalidLocationError,
	investorRequest,
	toCents,
	type InvestorRuntime
} from './investor-port';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const DAY = 86_400_000;
const PROV = { source: 'sample' as const, fetchedAt: T0, stale: false };
const ADDRESS = '100 Example Way, Harlow Springs, TX 79999';

const comp = {
	id: 'c1',
	formattedAddress: '102 Example Way, Harlow Springs, TX 79999',
	price: 1810.5,
	distance: 0.4,
	daysOld: 3,
	correlation: 0.97,
	bedrooms: 3,
	bathrooms: 2,
	squareFootage: 1400,
	propertyType: 'Single Family' as const
};

const rentData: RentEstimate = {
	kind: 'rent',
	estimate: 1850.4,
	low: 1700,
	high: 2000.25,
	subjectAddress: ADDRESS,
	comparables: [comp]
};
const valueData: PriceEstimate = {
	kind: 'price',
	estimate: 245_000,
	low: 230_000,
	high: null,
	subjectAddress: ADDRESS,
	comparables: [{ ...comp, price: 239_999.99 }]
};

function listing(i: number, o: Partial<Listing> = {}): Listing {
	return {
		id: `sale-${i}`,
		kind: 'sale',
		formattedAddress: `${100 + i} Example Way, Harlow Springs, TX 79999`,
		addressLine1: null,
		city: 'Harlow Springs',
		state: 'TX',
		zipCode: '79999',
		latitude: null,
		longitude: null,
		propertyType: 'Single Family',
		bedrooms: 3,
		bathrooms: 2,
		squareFootage: 1450,
		yearBuilt: 1995,
		hoaFee: null,
		price: 210_000,
		status: 'Active',
		listingType: 'Standard',
		listedDate: '2026-09-01T00:00:00.000Z',
		removedDate: null,
		lastSeenDate: null,
		daysOnMarket: 44,
		mlsName: null,
		mlsNumber: null,
		agent: null,
		office: null,
		history: [],
		...o
	};
}

const result = (data: unknown, req: DataRequest, truncated = false) => ({
	data,
	provenance: PROV,
	truncated,
	droppedRows: 0,
	requestKey: canonicalKey(req)
});

function dataFor(req: DataRequest, sale: Listing[]): unknown {
	if (req.endpoint === 'rent-estimate') return rentData;
	if (req.endpoint === 'value-estimate') return valueData;
	return sale;
}

function fake(o: { sale?: Listing[]; source?: 'sample' | 'rentcast'; empty?: boolean } = {}) {
	const sale = o.sale ?? [listing(1, { hoaFee: 85.5 }), listing(2)];
	const gateway = {
		source: o.source ?? 'sample',
		peek: vi.fn(async (req: DataRequest) =>
			o.empty ? undefined : { kind: 'data', result: result(dataFor(req, sale), req) }
		),
		estimateCost: vi.fn(async (req: DataRequest) => ({
			calls: 1,
			reason: 'network',
			key: canonicalKey(req)
		})),
		get: vi.fn(),
		refresh: vi.fn()
	};
	const requestSpend = vi.fn(async (req: DataRequest) => result(dataFor(req, sale), req));
	const runtime = {
		gateway,
		requestSpend,
		mode: { source: o.source ?? 'sample', reason: 'no-key' }
	} as unknown as InvestorRuntime;
	return { port: createInvestorPort(runtime), gateway, requestSpend };
}

describe('request shapes', () => {
	it('rent estimate: address and only the provided facts, 15 comps', () => {
		expect(investorRequest({ kind: 'rent', q: { address: ADDRESS, bedrooms: 3 } })).toEqual({
			endpoint: 'rent-estimate',
			params: { address: ADDRESS, bedrooms: 3, compCount: 15 }
		});
		expect(
			investorRequest({
				kind: 'value',
				q: {
					address: ADDRESS,
					propertyType: 'single-family',
					bedrooms: null,
					bathrooms: 2,
					squareFeet: 1450
				}
			})
		).toEqual({
			endpoint: 'value-estimate',
			params: {
				address: ADDRESS,
				propertyType: 'Single Family',
				bathrooms: 2,
				squareFootage: 1450,
				compCount: 15
			}
		});
	});

	it('sale listings: Phase 4 location normalizer + fetch-wide (Active, limit 500)', () => {
		expect(investorRequest({ kind: 'sale', location: 'harlow springs, tx' })).toEqual({
			endpoint: 'sale-listings',
			params: { city: 'Harlow Springs', state: 'TX', status: 'Active', limit: 500 }
		});
		expect(investorRequest({ kind: 'sale', location: '79999' }).params).toEqual({
			zipCode: '79999',
			status: 'Active',
			limit: 500
		});
		expect(() => investorRequest({ kind: 'sale', location: 'Nowhere' })).toThrow(
			InvalidLocationError
		);
	});
});

describe('createInvestorPort', () => {
	it('rentEstimate spends exactly once and maps rent, range and comparables to cents', async () => {
		const { port, requestSpend, gateway } = fake();
		const e = await port.rentEstimate({ address: ADDRESS, bedrooms: 3 });
		expect(requestSpend).toHaveBeenCalledTimes(1);
		expect(requestSpend).toHaveBeenCalledWith(
			investorRequest({ kind: 'rent', q: { address: ADDRESS, bedrooms: 3 } })
		);
		expect(gateway.get).not.toHaveBeenCalled();
		expect(e).toEqual({
			amountCents: 185_040,
			rangeLowCents: 170_000,
			rangeHighCents: 200_025,
			comparables: [
				{
					address: comp.formattedAddress,
					amountCents: 181_050,
					bedrooms: 3,
					bathrooms: 2,
					squareFeet: 1400,
					distanceMi: 0.4,
					seenAt: T0 - 3 * DAY
				}
			],
			provenance: PROV
		});
	});

	it('valueEstimate maps price, range (null kept) and comparables', async () => {
		const { port } = fake();
		const e = await port.valueEstimate({ address: ADDRESS });
		expect(e.amountCents).toBe(24_500_000);
		expect(e.rangeLowCents).toBe(23_000_000);
		expect(e.rangeHighCents).toBeNull();
		expect(e.comparables[0].amountCents).toBe(23_999_999);
	});

	it('every peek calls gateway.peek only (0 get/refresh/requestSpend)', async () => {
		const { port, gateway, requestSpend } = fake();
		expect((await port.peekRent({ address: ADDRESS }))?.amountCents).toBe(185_040);
		expect((await port.peekValue({ address: ADDRESS }))?.amountCents).toBe(24_500_000);
		expect((await port.peekSaleListings('79999'))?.listings).toHaveLength(2);
		expect(gateway.peek).toHaveBeenCalledTimes(3);
		expect(gateway.get).toHaveBeenCalledTimes(0);
		expect(gateway.refresh).toHaveBeenCalledTimes(0);
		expect(requestSpend).toHaveBeenCalledTimes(0);
	});

	it('peeks return undefined when nothing is cached', async () => {
		const { port } = fake({ empty: true });
		expect(await port.peekRent({ address: ADDRESS })).toBeUndefined();
		expect(await port.peekValue({ address: ADDRESS })).toBeUndefined();
		expect(await port.peekSaleListings('79999')).toBeUndefined();
	});

	it('estimateCost uses the same canonical key the spend would use', async () => {
		const { port, gateway, requestSpend } = fake();
		const q = { address: ADDRESS, bedrooms: 3, propertyType: 'condo' as const };
		const cost = (await port.estimateCost({ kind: 'rent', q })) as unknown as { key: string };
		await port.rentEstimate(q);
		const spent = requestSpend.mock.calls[0][0] as DataRequest;
		expect(cost.key).toBe(canonicalKey(spent));
		expect(gateway.estimateCost).toHaveBeenCalledWith(spent);
	});

	it('saleListings maps price and HOA to cents and flags a 500-row result as truncated', async () => {
		const { port, requestSpend } = fake();
		const r = await port.saleListings('Harlow Springs, TX');
		expect(requestSpend).toHaveBeenCalledTimes(1);
		expect(r.truncated).toBe(false);
		expect(r.listings[0]).toEqual({
			id: 'sale-1',
			address: '101 Example Way, Harlow Springs, TX 79999',
			zip: '79999',
			priceCents: 21_000_000,
			bedrooms: 3,
			bathrooms: 2,
			squareFeet: 1450,
			daysOnMarket: 44,
			hoaMonthlyCents: 8550,
			propertyType: 'Single Family',
			listedAt: Date.parse('2026-09-01T00:00:00.000Z')
		});
		expect(r.listings[1].hoaMonthlyCents).toBeNull();

		const full = fake({ sale: Array.from({ length: 500 }, (_, i) => listing(i)) });
		expect((await full.port.saleListings('79999')).truncated).toBe(true);
	});

	it('mode mirrors the gateway source', () => {
		expect(fake().port.mode()).toBe('sample');
		expect(fake({ source: 'rentcast' }).port.mode()).toBe('live');
	});

	it('converts dollars to cents once: 1850.4 -> 185040', () => {
		expect(toCents(1850.4)).toBe(185_040);
		expect(toCents(0.1 + 0.2)).toBe(30);
	});

	it('reports a runtime that has not started instead of spending', async () => {
		const port = createInvestorPort({
			gateway: null,
			requestSpend: vi.fn(),
			mode: null
		} as unknown as InvestorRuntime);
		await expect(port.peekRent({ address: ADDRESS })).rejects.toBeInstanceOf(
			DataRuntimeNotStartedError
		);
		await expect(port.estimateCost({ kind: 'sale', location: '79999' })).rejects.toBeInstanceOf(
			DataRuntimeNotStartedError
		);
	});
});

describe('boundary: only this adapter imports $lib/data at runtime', () => {
	const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((f) => {
			const p = join(dir, f);
			return statSync(p).isDirectory() ? files(p) : /\.(ts|svelte)$/.test(f) ? [p] : [];
		});

	it('no other features/investor file has a value import from $lib/data', () => {
		const offenders = files(root)
			.filter((f) => !/investor-port\.(test\.)?ts$/.test(f))
			.filter((f) => /import\s+(?!type\b)[^;]*from\s+'\$lib\/data'/.test(readFileSync(f, 'utf8')));
		expect(offenders).toEqual([]);
	});
});
