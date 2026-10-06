import { describe, expect, it } from 'vitest';
import { emptyBuyBox, type BuyBoxInput } from './buyBoxRepo';
import {
	buyBoxToForm,
	criteriaSummary,
	emptyBuyBoxForm,
	toBuyBoxInput,
	type BuyBoxFormState
} from './buybox-form';

const form = (over: Partial<BuyBoxFormState> = {}): BuyBoxFormState => ({
	...emptyBuyBoxForm(),
	name: 'Starter rentals',
	location: 'Austin, TX',
	...over
});

describe('emptyBuyBoxForm', () => {
	it('starts with Any bedrooms, no types, no targets and a 40% expense assumption', () => {
		expect(emptyBuyBoxForm()).toEqual({
			name: '',
			location: '',
			minPrice: '',
			maxPrice: '',
			minBeds: '0',
			propertyTypes: [],
			minCapRate: '',
			minRentToPrice: '',
			expensePct: '40'
		});
	});
});

describe('toBuyBoxInput', () => {
	it('requires a name', () => {
		const r = toBuyBoxInput(form({ name: '  ' }));
		expect(r.input).toBeNull();
		expect(r.errors.name).toBe('Give this buy box a name.');
	});

	it('requires a location', () => {
		expect(toBuyBoxInput(form({ location: '' })).errors.location).toBe(
			'Enter a city and state, or a ZIP code.'
		);
	});

	it('rejects a location it cannot recognize', () => {
		expect(toBuyBoxInput(form({ location: 'Nowhere' })).errors.location).toBe(
			'Use a format like Austin, TX or 78701.'
		);
	});

	it('rejects a minimum price above the maximum', () => {
		const r = toBuyBoxInput(form({ minPrice: '400000', maxPrice: '300000' }));
		expect(r.input).toBeNull();
		expect(r.errors.minPrice).toBe('The minimum price is higher than the maximum.');
	});

	it('reports a price that is not a number with the analyzer copy', () => {
		expect(toBuyBoxInput(form({ maxPrice: 'lots' })).errors.maxPrice).toBe(
			'Enter a number, like 250000.'
		);
	});

	it('reports a target percent out of range', () => {
		expect(toBuyBoxInput(form({ minCapRate: '150' })).errors.minCapRate).toBe(
			'Use a percent from 0 to 100.'
		);
	});

	it('builds the input: cents, percent targets, expense bps', () => {
		const r = toBuyBoxInput(
			form({
				minPrice: '200,000',
				maxPrice: '$350000',
				minBeds: '3',
				propertyTypes: ['Single Family'],
				minCapRate: '6',
				minRentToPrice: '0.75',
				expensePct: '35'
			})
		);
		expect(r.errors).toEqual({});
		expect(r.input).toEqual({
			name: 'Starter rentals',
			criteria: {
				location: 'Austin, TX',
				minPriceCents: 20_000_000,
				maxPriceCents: 35_000_000,
				minBeds: 3,
				propertyTypes: ['Single Family']
			},
			targets: { minCapRatePct: 6, minRentToPricePct: 0.75 },
			expenseBps: 3500
		});
	});

	it('blank optional fields become null, and a blank expense assumption is the 40% default', () => {
		const r = toBuyBoxInput(form({ expensePct: '' }));
		expect(r.input?.criteria.minPriceCents).toBeNull();
		expect(r.input?.criteria.maxPriceCents).toBeNull();
		expect(r.input?.targets).toEqual({ minCapRatePct: null, minRentToPricePct: null });
		expect(r.input?.expenseBps).toBe(4000);
	});

	it('round-trips a saved box through the form', () => {
		const input = toBuyBoxInput(
			form({ minPrice: '200000', minCapRate: '6.5', propertyTypes: ['Condo', 'Townhouse'] })
		).input as BuyBoxInput;
		expect(toBuyBoxInput(buyBoxToForm(input)).input).toEqual(input);
	});
});

describe('criteriaSummary', () => {
	const box = (over: Partial<BuyBoxInput['criteria']>, cap: number | null = null): BuyBoxInput => {
		const b = emptyBuyBox();
		return {
			...b,
			name: 'x',
			criteria: { ...b.criteria, location: 'Harlow Springs, TX', ...over },
			targets: { minCapRatePct: cap, minRentToPricePct: null }
		};
	};

	it('joins every set part', () => {
		expect(
			criteriaSummary(
				box(
					{
						minPriceCents: 20_000_000,
						maxPriceCents: 35_000_000,
						minBeds: 3,
						propertyTypes: ['Single Family']
					},
					6
				)
			)
		).toBe('Harlow Springs, TX · $200,000 to $350,000 · 3+ beds · Single family · Cap rate 6%+');
	});

	it('omits the parts that are not set', () => {
		expect(criteriaSummary(box({}))).toBe('Harlow Springs, TX');
		expect(criteriaSummary(box({ maxPriceCents: 30_000_000 }))).toBe(
			'Harlow Springs, TX · Up to $300,000'
		);
		expect(criteriaSummary(box({ minPriceCents: 10_000_000 }))).toBe(
			'Harlow Springs, TX · $100,000 or more'
		);
	});
});
