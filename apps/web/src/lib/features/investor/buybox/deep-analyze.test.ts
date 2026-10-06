import { describe, expect, it, vi } from 'vitest';
import { GatewayError } from '@tran/core/request';
import type { DraftInput } from '../analyzer/draftRepo';
import type {
	CostEstimate,
	Estimate,
	InvestorDataPort,
	InvestorRequest,
	SaleListing
} from '../data/investor-port';
import { analyzerPropertyType, deepAnalyze } from './deep-analyze';

const FETCHED = 1_790_000_000_000;

const listing = (over: Partial<SaleListing> = {}): SaleListing => ({
	id: 'sale-1',
	address: '12 Sample Way, Harlow Springs, OK 74201',
	zip: '74201',
	priceCents: 28_900_000,
	bedrooms: 3,
	bathrooms: 2,
	squareFeet: 1450,
	daysOnMarket: 12,
	hoaMonthlyCents: 4_500,
	propertyType: 'Single Family',
	listedAt: FETCHED,
	...over
});

function estimate(amountCents: number, source: 'rentcast' | 'sample' = 'rentcast'): Estimate {
	return {
		amountCents,
		rangeLowCents: amountCents - 10_000,
		rangeHighCents: amountCents + 10_000,
		comparables: Array.from({ length: 5 }, (_, i) => ({
			address: `${i + 1} Comp St`,
			amountCents,
			bedrooms: 3,
			bathrooms: 2,
			squareFeet: 1400,
			distanceMi: 0.4,
			seenAt: FETCHED
		})),
		provenance: { source, fetchedAt: FETCHED, stale: false }
	};
}

interface FakeOpts {
	mode?: 'sample' | 'live';
	rent?: () => Promise<Estimate>;
	value?: () => Promise<Estimate>;
}

/** A fake port whose estimateCost reports 0 in sample mode and 1 per uncached call live. */
function fakePort(o: FakeOpts = {}) {
	const mode = o.mode ?? 'live';
	const order: string[] = [];
	const source = mode === 'sample' ? 'sample' : 'rentcast';
	const rentEstimate = vi.fn(async () => {
		order.push('rent');
		return (o.rent ?? (async () => estimate(185_000, source)))();
	});
	const valueEstimate = vi.fn(async () => {
		order.push('value');
		return (o.value ?? (async () => estimate(30_000_000, source)))();
	});
	const estimateCost = vi.fn(async (_req: InvestorRequest): Promise<CostEstimate> =>
		mode === 'sample' ? { calls: 0, reason: 'sample' } : { calls: 1, reason: 'network' }
	);
	const saleListings = vi.fn();
	const port = {
		mode: () => mode,
		estimateCost,
		rentEstimate,
		valueEstimate,
		saleListings
	} as unknown as InvestorDataPort;
	return { port, rentEstimate, valueEstimate, estimateCost, saleListings, order };
}

function deps(confirm = true) {
	const writeDraft = vi.fn(async (_d: DraftInput) => undefined);
	const confirmCap = vi.fn(async () => confirm);
	return { writeDraft, confirmCap };
}

const written = (w: ReturnType<typeof deps>['writeDraft']) => w.mock.calls[0][0];

describe('analyzerPropertyType', () => {
	it('maps RentCast listing types to the analyzer select', () => {
		expect(analyzerPropertyType('Single Family')).toBe('single-family');
		expect(analyzerPropertyType('Condo')).toBe('condo');
		expect(analyzerPropertyType('Townhouse')).toBe('townhouse');
		expect(analyzerPropertyType('Multi-Family')).toBe('multi-family');
		expect(analyzerPropertyType('Manufactured')).toBe('manufactured');
		expect(analyzerPropertyType('Land')).toBe('');
		expect(analyzerPropertyType(null)).toBe('');
	});
});

describe('deepAnalyze', () => {
	it('uncached: exactly 2 spends (rent then value), then one draft write', async () => {
		const f = fakePort();
		const d = deps();
		const r = await deepAnalyze(f.port, listing(), d);
		expect(r).toEqual({ rent: 'ok', value: 'ok', calls: 2 });
		expect(f.rentEstimate).toHaveBeenCalledTimes(1);
		expect(f.valueEstimate).toHaveBeenCalledTimes(1);
		expect(f.order).toEqual(['rent', 'value']);
		expect(f.saleListings).not.toHaveBeenCalled();
		expect(d.writeDraft).toHaveBeenCalledTimes(1);
		expect(d.confirmCap).not.toHaveBeenCalled();
	});

	it('sends the listing facts with each estimate', async () => {
		const f = fakePort();
		await deepAnalyze(f.port, listing(), deps());
		const q = {
			address: '12 Sample Way, Harlow Springs, OK 74201',
			propertyType: 'single-family',
			bedrooms: 3,
			bathrooms: 2,
			squareFeet: 1450
		};
		expect(f.rentEstimate).toHaveBeenCalledWith(q);
		expect(f.valueEstimate).toHaveBeenCalledWith(q);
	});

	it('writes the listing facts (From listing), the rent estimate and both estimates', async () => {
		const f = fakePort();
		const d = deps();
		await deepAnalyze(f.port, listing(), d);
		const draft = written(d.writeDraft);
		expect(draft.dealId).toBeNull();
		expect(draft.savedSnapshot).toBeNull();
		expect(draft.form).toMatchObject({
			address: '12 Sample Way, Harlow Springs, OK 74201',
			propertyType: 'single-family',
			bedrooms: '3',
			bathrooms: '2',
			squareFeet: '1,450',
			// The listing price, never the value estimate.
			price: '289,000',
			rent: '1,850'
		});
		expect(draft.form.expenses.find((l) => l.kind === 'hoa')?.amount).toBe('45');
		const fromListing = { source: 'listing', listingId: 'sale-1' };
		for (const key of [
			'address',
			'propertyType',
			'bedrooms',
			'bathrooms',
			'squareFeet',
			'price'
		] as const) {
			expect(draft.sources[key]).toEqual(fromListing);
		}
		expect(draft.sources.rent).toEqual({
			source: 'rentcast',
			fetchedAt: FETCHED,
			rangeLowCents: 175_000,
			rangeHighCents: 195_000,
			comps: 5
		});
		expect((draft.estimates?.rent as Estimate).amountCents).toBe(185_000);
		expect((draft.estimates?.value as Estimate).amountCents).toBe(30_000_000);
		expect(draft.estimateErrors).toEqual({});
	});

	it('omits facts the listing does not have (no chip, no HOA amount)', async () => {
		const f = fakePort();
		const d = deps();
		await deepAnalyze(
			f.port,
			listing({ bedrooms: null, squareFeet: null, hoaMonthlyCents: null, propertyType: 'Land' }),
			d
		);
		const draft = written(d.writeDraft);
		expect(draft.form.bedrooms).toBe('');
		expect(draft.form.propertyType).toBe('');
		expect(draft.sources.bedrooms).toBeUndefined();
		expect(draft.sources.squareFeet).toBeUndefined();
		expect(draft.sources.propertyType).toBeUndefined();
		expect(draft.form.expenses.find((l) => l.kind === 'hoa')?.amount).toBe('');
		expect(f.rentEstimate).toHaveBeenCalledWith({
			address: '12 Sample Way, Harlow Springs, OK 74201',
			bathrooms: 2
		});
	});

	it('a failed value estimate: rent ok, value error, draft still written with the error kind', async () => {
		const f = fakePort({
			value: async () => {
				throw new GatewayError({ kind: 'NetworkError' });
			}
		});
		const d = deps();
		const r = await deepAnalyze(f.port, listing(), d);
		expect(r).toEqual({ rent: 'ok', value: 'error', calls: 1 });
		expect(d.writeDraft).toHaveBeenCalledTimes(1);
		const draft = written(d.writeDraft);
		expect(draft.estimateErrors).toEqual({ value: 'NetworkError' });
		expect(draft.estimates?.value).toBeUndefined();
		expect(draft.form.rent).toBe('1,850');
	});

	it('a non-gateway failure reads as NetworkError', async () => {
		const f = fakePort({
			rent: async () => {
				throw new Error('storage');
			}
		});
		const d = deps();
		const r = await deepAnalyze(f.port, listing(), d);
		expect(r.rent).toBe('error');
		expect(written(d.writeDraft).estimateErrors).toEqual({ rent: 'NetworkError' });
		expect(written(d.writeDraft).form.rent).toBe('');
		expect(written(d.writeDraft).sources.rent).toBeUndefined();
	});

	it('cap on the first call, confirmed: retried once, then the value estimate runs', async () => {
		let first = true;
		const f = fakePort({
			rent: async () => {
				if (first) {
					first = false;
					throw new GatewayError({ kind: 'BudgetCapReached', used: 40, cap: 40 });
				}
				return estimate(185_000);
			}
		});
		const d = deps(true);
		const r = await deepAnalyze(f.port, listing(), d);
		expect(d.confirmCap).toHaveBeenCalledTimes(1);
		expect(f.rentEstimate).toHaveBeenCalledTimes(2);
		expect(f.valueEstimate).toHaveBeenCalledTimes(1);
		expect(r).toEqual({ rent: 'ok', value: 'ok', calls: 2 });
	});

	it('cap on the first call, declined: rent skipped (BudgetCapReached), value still runs', async () => {
		const f = fakePort({
			rent: async () => {
				throw new GatewayError({ kind: 'BudgetCapReached', used: 40, cap: 40 });
			}
		});
		const d = deps(false);
		const r = await deepAnalyze(f.port, listing(), d);
		expect(d.confirmCap).toHaveBeenCalledTimes(1);
		expect(f.rentEstimate).toHaveBeenCalledTimes(1);
		expect(f.valueEstimate).toHaveBeenCalledTimes(1);
		expect(r).toEqual({ rent: 'error', value: 'ok', calls: 1 });
		expect(written(d.writeDraft).estimateErrors).toEqual({ rent: 'BudgetCapReached' });
	});

	it('a "Not now" on the runtime prompt skips without asking again', async () => {
		const f = fakePort({
			rent: async () => {
				throw new GatewayError({ kind: 'BudgetCapReached', detail: 'dismissed' });
			}
		});
		const d = deps(true);
		await deepAnalyze(f.port, listing(), d);
		expect(d.confirmCap).not.toHaveBeenCalled();
		expect(f.rentEstimate).toHaveBeenCalledTimes(1);
	});

	it('retries at most once', async () => {
		const f = fakePort({
			rent: async () => {
				throw new GatewayError({ kind: 'BudgetCapReached', used: 40, cap: 40 });
			}
		});
		const d = deps(true);
		const r = await deepAnalyze(f.port, listing(), d);
		expect(f.rentEstimate).toHaveBeenCalledTimes(2);
		expect(d.confirmCap).toHaveBeenCalledTimes(1);
		expect(r.rent).toBe('error');
	});

	it('sample mode: 0 network calls, the draft is written the same way with Sample chips', async () => {
		const f = fakePort({ mode: 'sample' });
		const d = deps();
		const r = await deepAnalyze(f.port, listing(), d);
		expect(r).toEqual({ rent: 'ok', value: 'ok', calls: 0 });
		expect(f.estimateCost).toHaveBeenCalledTimes(2);
		const draft = written(d.writeDraft);
		expect(draft.sources.rent?.source).toBe('sample');
		expect(draft.sources.price).toEqual({ source: 'listing', listingId: 'sale-1' });
		expect(draft.form.rent).toBe('1,850');
	});

	it('cached estimates count as 0 calls', async () => {
		const f = fakePort();
		f.estimateCost.mockImplementation(async (req: InvestorRequest) =>
			req.kind === 'rent' ? { calls: 0, reason: 'cached' } : { calls: 1, reason: 'network' }
		);
		const r = await deepAnalyze(f.port, listing(), deps());
		expect(r.calls).toBe(1);
	});
});
