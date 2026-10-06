import { describe, expect, it, vi } from 'vitest';
import { GatewayError } from '@tran/core/request';
import type { Estimate, InvestorDataPort } from '../data/investor-port';
import type { DealSources } from '../deals/schema';
import {
	applyEstimate,
	estimateQueryFromForm,
	markEdited,
	priceComparison,
	runAutofill,
	useEstimate
} from './autofill';
import { defaultForm, type AnalyzerForm } from './form-model';

const FETCHED = 1_790_000_000_000;

function estimate(over: Partial<Estimate> = {}): Estimate {
	return {
		amountCents: 185_000,
		rangeLowCents: 170_000,
		rangeHighCents: 200_000,
		comparables: Array.from({ length: 8 }, (_, i) => ({
			address: `${i + 1} Sample St`,
			amountCents: 180_000,
			bedrooms: 3,
			bathrooms: 2,
			squareFeet: 1400,
			distanceMi: 0.5,
			seenAt: FETCHED
		})),
		provenance: { source: 'rentcast', fetchedAt: FETCHED, stale: false },
		...over
	} as Estimate;
}

function form(over: Partial<AnalyzerForm> = {}): AnalyzerForm {
	return { ...defaultForm(), address: '100 Sample Way, Austin, TX 78701', ...over };
}

function fakePort(impl?: { rent?: () => Promise<Estimate>; value?: () => Promise<Estimate> }) {
	const rentEstimate = vi.fn(impl?.rent ?? (async () => estimate()));
	const valueEstimate = vi.fn(impl?.value ?? (async () => estimate({ amountCents: 30_000_000 })));
	const port = { rentEstimate, valueEstimate } as unknown as InvestorDataPort;
	return { port, rentEstimate, valueEstimate };
}

describe('estimateQueryFromForm', () => {
	it('is null when the address is blank', () => {
		expect(estimateQueryFromForm(form({ address: '  ' }))).toBeNull();
		expect(estimateQueryFromForm(form({ address: '' }))).toBeNull();
	});

	it('sends only the details that are present', () => {
		const q = estimateQueryFromForm(form({ bedrooms: '3', bathrooms: '' }));
		expect(q).toEqual({ address: '100 Sample Way, Austin, TX 78701', bedrooms: 3 });
		expect(q).not.toHaveProperty('bathrooms');
	});

	it('includes property type, baths and square feet (commas allowed)', () => {
		const q = estimateQueryFromForm(
			form({ propertyType: 'condo', bathrooms: '1.5', squareFeet: '1,250' })
		);
		expect(q).toEqual({
			address: '100 Sample Way, Austin, TX 78701',
			propertyType: 'condo',
			bathrooms: 1.5,
			squareFeet: 1250
		});
	});

	it('drops a detail that is not a valid number', () => {
		expect(estimateQueryFromForm(form({ bedrooms: 'three' }))).not.toHaveProperty('bedrooms');
	});
});

describe('runAutofill', () => {
	it("makes no request without an address: 'no-address'", async () => {
		const { port, rentEstimate, valueEstimate } = fakePort();
		expect(await runAutofill(port, 'rent', form({ address: '' }))).toEqual({
			kind: 'no-address'
		});
		expect(rentEstimate).not.toHaveBeenCalled();
		expect(valueEstimate).not.toHaveBeenCalled();
	});

	it('rent calls rentEstimate exactly once', async () => {
		const { port, rentEstimate, valueEstimate } = fakePort();
		const out = await runAutofill(port, 'rent', form());
		expect(out.kind).toBe('ok');
		expect(rentEstimate).toHaveBeenCalledTimes(1);
		expect(valueEstimate).not.toHaveBeenCalled();
	});

	it('value calls valueEstimate exactly once', async () => {
		const { port, rentEstimate, valueEstimate } = fakePort();
		await runAutofill(port, 'value', form());
		expect(valueEstimate).toHaveBeenCalledTimes(1);
		expect(rentEstimate).not.toHaveBeenCalled();
	});

	it("BudgetCapReached -> 'cap'; retry asks once more", async () => {
		let first = true;
		const { port, rentEstimate } = fakePort({
			rent: async () => {
				if (first) {
					first = false;
					throw new GatewayError({ kind: 'BudgetCapReached', detail: 'dismissed' });
				}
				return estimate();
			}
		});
		const out = await runAutofill(port, 'rent', form());
		expect(out.kind).toBe('cap');
		if (out.kind !== 'cap') return;
		expect(out.dismissed).toBe(true);
		const again = await out.retry();
		expect(again.kind).toBe('ok');
		expect(rentEstimate).toHaveBeenCalledTimes(2);
	});

	it("other errors -> 'error'", async () => {
		const boom = new GatewayError({ kind: 'NetworkError' });
		const { port } = fakePort({
			rent: async () => {
				throw boom;
			}
		});
		expect(await runAutofill(port, 'rent', form())).toEqual({ kind: 'error', error: boom });
	});
});

describe('applyEstimate / useEstimate', () => {
	it("fills an empty rent field with a rentcast source: 'filled'", () => {
		const out = applyEstimate(form({ rent: '' }), {}, 'rent', estimate());
		expect(out.kind).toBe('filled');
		expect(out.form.rent).toBe('1,850');
		expect(out.sources.rent).toEqual({
			source: 'rentcast',
			fetchedAt: FETCHED,
			rangeLowCents: 170_000,
			rangeHighCents: 200_000,
			comps: 8
		});
	});

	it('sample provenance gives a sample source', () => {
		const e = estimate({ provenance: { source: 'sample', fetchedAt: FETCHED, stale: false } });
		expect(applyEstimate(form(), {}, 'rent', e).sources.rent?.source).toBe('sample');
	});

	it("keeps a typed number untouched: 'kept'", () => {
		const f = form({ rent: '2,100' });
		const sources: DealSources = {};
		const out = applyEstimate(f, sources, 'rent', estimate());
		expect(out.kind).toBe('kept');
		expect(out.form).toBe(f);
		expect(out.form.rent).toBe('2,100');
		expect(out.sources).toBe(sources);
	});

	it('useEstimate writes the estimate and its source', () => {
		const out = useEstimate(form({ rent: '2,100' }), {}, 'rent', estimate());
		expect(out.form.rent).toBe('1,850');
		expect(out.sources.rent?.source).toBe('rentcast');
	});

	it('value targets the purchase price', () => {
		const out = applyEstimate(form(), {}, 'value', estimate({ amountCents: 31_234_567 }));
		expect(out.form.price).toBe('312,346');
		expect(out.form.rent).toBe('');
		expect(out.sources.price?.source).toBe('rentcast');
		expect(out.sources.rent).toBeUndefined();
	});

	it('omits a missing range from the source', () => {
		const out = applyEstimate(
			form(),
			{},
			'rent',
			estimate({ rangeLowCents: null, rangeHighCents: null })
		);
		expect(out.sources.rent).not.toHaveProperty('rangeLowCents');
	});
});

describe('markEdited', () => {
	it.each(['rentcast', 'sample', 'listing'] as const)(
		'%s -> edited, keeping the reference',
		(s) => {
			const sources: DealSources = {
				rent: { source: s, fetchedAt: FETCHED, rangeLowCents: 1, rangeHighCents: 2, comps: 8 }
			};
			expect(markEdited(sources, 'rent').rent).toEqual({
				source: 'edited',
				fetchedAt: FETCHED,
				rangeLowCents: 1,
				rangeHighCents: 2,
				comps: 8
			});
		}
	);

	it('a field with no source stays without one', () => {
		const sources: DealSources = {};
		expect(markEdited(sources, 'price')).toBe(sources);
		expect(markEdited(sources, 'price').price).toBeUndefined();
	});

	it('an edited source is returned as is', () => {
		const sources: DealSources = { rent: { source: 'edited' } };
		expect(markEdited(sources, 'rent')).toBe(sources);
	});
});

describe('priceComparison', () => {
	it('above / below / matches', () => {
		expect(priceComparison(31_200_000, 30_000_000)).toBe(
			'Your purchase price is 4.0% above this estimate.'
		);
		expect(priceComparison(28_800_000, 30_000_000)).toBe(
			'Your purchase price is 4.0% below this estimate.'
		);
		expect(priceComparison(30_000_000, 30_000_000)).toBe(
			'Your purchase price matches this estimate.'
		);
	});
});
