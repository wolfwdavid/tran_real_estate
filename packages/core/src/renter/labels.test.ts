import { describe, expect, test } from 'vitest';

import {
	PROPERTY_TYPE_LABELS,
	activeFilterChips,
	defaultSearchName,
	filterCount,
	propertyTypeLabel,
	removeChip,
	resultsHeading,
	savedSearchSummary
} from './labels.js';
import { DEFAULT_FILTERS, RENTER_PROPERTY_TYPES, type RentalFilters } from './types.js';

const f = (o: Partial<RentalFilters>): RentalFilters => ({ ...DEFAULT_FILTERS, ...o });

describe('propertyTypeLabel', () => {
	test('maps RentCast types to UI-SPEC display names', () => {
		expect(propertyTypeLabel('Apartment')).toBe('Apartment');
		expect(propertyTypeLabel('Single Family')).toBe('Single-family home');
		expect(propertyTypeLabel('Condo')).toBe('Condo');
		expect(propertyTypeLabel('Townhouse')).toBe('Townhouse');
		expect(propertyTypeLabel('Multi-Family')).toBe('Multi-family');
		expect(propertyTypeLabel('Manufactured')).toBe('Manufactured home');
	});

	test('unknown, null and prototype keys read "Home"', () => {
		expect(propertyTypeLabel(null)).toBe('Home');
		expect(propertyTypeLabel('Other')).toBe('Home');
		expect(propertyTypeLabel('Land')).toBe('Home');
		expect(propertyTypeLabel('constructor')).toBe('Home');
		expect(propertyTypeLabel('toString')).toBe('Home');
	});

	test('every renter type has a label', () => {
		for (const t of RENTER_PROPERTY_TYPES) expect(PROPERTY_TYPE_LABELS[t]).toBeTruthy();
	});
});

describe('activeFilterChips', () => {
	test('default filters have no chips', () => {
		expect(activeFilterChips(DEFAULT_FILTERS)).toEqual([]);
		expect(filterCount(DEFAULT_FILTERS)).toBe(0);
	});

	test('price chip wording for max, min and both', () => {
		expect(activeFilterChips(f({ priceMax: 2500 }))).toEqual([
			{ key: 'price', label: 'Up to $2,500' }
		]);
		expect(activeFilterChips(f({ priceMin: 1500 }))).toEqual([
			{ key: 'price', label: 'From $1,500' }
		]);
		expect(activeFilterChips(f({ priceMin: 1500, priceMax: 2500 }))).toEqual([
			{ key: 'price', label: '$1,500 to $2,500' }
		]);
		expect(activeFilterChips(f({ priceMin: 0 }))).toEqual([{ key: 'price', label: 'From $0' }]);
	});

	test('bedroom chip wording', () => {
		const beds = (b: RentalFilters['beds']) => activeFilterChips(f({ beds: b }))[0]?.label;
		expect(beds(0)).toBe('Studio');
		expect(beds(1)).toBe('1 bedroom');
		expect(beds(2)).toBe('2 bedrooms');
		expect(beds(3)).toBe('3 bedrooms');
		expect(beds('4+')).toBe('4+ bedrooms');
		expect(activeFilterChips(f({ beds: 2 }))[0]?.key).toBe('beds');
	});

	test('one chip per type in the UI order, labelled with display names', () => {
		expect(activeFilterChips(f({ types: ['Condo'] }))).toEqual([
			{ key: 'type:Condo', label: 'Condo' }
		]);
		expect(activeFilterChips(f({ types: ['Manufactured', 'Condo', 'Single Family'] }))).toEqual([
			{ key: 'type:Single Family', label: 'Single-family home' },
			{ key: 'type:Condo', label: 'Condo' },
			{ key: 'type:Manufactured', label: 'Manufactured home' }
		]);
	});

	test('listed-within chip', () => {
		expect(activeFilterChips(f({ listedWithin: 14 }))).toEqual([
			{ key: 'days', label: 'Listed within 14 days' }
		]);
	});

	test('order is price, beds, each type, listed within; filterCount matches', () => {
		const all = f({
			priceMax: 2500,
			beds: 2,
			types: ['Townhouse', 'Condo'],
			listedWithin: 7
		});
		expect(activeFilterChips(all).map((c) => c.key)).toEqual([
			'price',
			'beds',
			'type:Condo',
			'type:Townhouse',
			'days'
		]);
		expect(filterCount(all)).toBe(5);
	});
});

describe('removeChip', () => {
	const all = f({
		priceMin: 1500,
		priceMax: 2500,
		beds: '4+',
		types: ['Condo', 'Townhouse'],
		listedWithin: 30
	});

	test('type chips remove only their type', () => {
		expect(removeChip(all, 'type:Condo')).toEqual({ ...all, types: ['Townhouse'] });
	});

	test('price clears both bounds; beds and days go back to any', () => {
		expect(removeChip(all, 'price')).toEqual({ ...all, priceMin: null, priceMax: null });
		expect(removeChip(all, 'beds')).toEqual({ ...all, beds: 'any' });
		expect(removeChip(all, 'days')).toEqual({ ...all, listedWithin: 'any' });
	});

	test('removing every chip returns the default filters', () => {
		let cur = all;
		for (const chip of activeFilterChips(all)) cur = removeChip(cur, chip.key);
		expect(cur).toEqual(DEFAULT_FILTERS);
	});

	test('an unknown key changes nothing, and the input is never mutated', () => {
		const frozen = Object.freeze({ ...all, types: Object.freeze([...all.types]) });
		expect(removeChip(frozen, 'nope')).toEqual(all);
		expect(removeChip(frozen, 'type:Land')).toEqual(all);
		removeChip(frozen, 'type:Condo');
		expect(frozen.types).toEqual(['Condo', 'Townhouse']);
	});
});

describe('savedSearchSummary and defaultSearchName', () => {
	const filters = f({ priceMax: 2500, beds: 2, types: ['Townhouse', 'Condo'], listedWithin: 14 });

	test('summary joins location and non-default filters with a middle dot', () => {
		expect(savedSearchSummary('Austin, TX', filters)).toBe(
			'Austin, TX · Up to $2,500 · 2 bedrooms · Condo, Townhouse · Listed within 14 days'
		);
		expect(savedSearchSummary('Austin, TX', DEFAULT_FILTERS)).toBe('Austin, TX');
		expect(savedSearchSummary('78701', f({ beds: 0 }))).toBe('78701 · Studio');
	});

	test('default name is the location plus the first chip only', () => {
		expect(defaultSearchName('Austin, TX', filters)).toBe('Austin, TX · Up to $2,500');
		expect(defaultSearchName('Austin, TX', DEFAULT_FILTERS)).toBe('Austin, TX');
		expect(defaultSearchName('Austin, TX', f({ types: ['Condo'] }))).toBe('Austin, TX · Condo');
	});

	test('default name fits the 60-character name field', () => {
		const long = 'A'.repeat(70);
		expect(defaultSearchName(long, filters)).toBe('A'.repeat(60));
		// A cut that lands on a space does not leave trailing whitespace in the input.
		const name = defaultSearchName('B'.repeat(51), filters);
		expect(name).toBe(`${'B'.repeat(51)} · Up to`);
		expect(name.length).toBeLessThanOrEqual(60);
	});
});

describe('resultsHeading', () => {
	test('total, shown-of-total, and singular wording', () => {
		expect(resultsHeading({ total: 87, shown: 87, location: 'Harlow Springs, OK' })).toBe(
			'87 rentals in Harlow Springs, OK'
		);
		expect(resultsHeading({ total: 87, shown: 24, location: 'Harlow Springs, OK' })).toBe(
			'24 of 87 rentals in Harlow Springs, OK'
		);
		expect(resultsHeading({ total: 1, shown: 1, location: 'Harlow Springs, OK' })).toBe(
			'1 rental in Harlow Springs, OK'
		);
		expect(resultsHeading({ total: 0, shown: 0, location: '78701' })).toBe('0 rentals in 78701');
	});

	test('the noun follows the total, not the shown count', () => {
		expect(resultsHeading({ total: 5, shown: 1, location: 'X' })).toBe('1 of 5 rentals in X');
	});

	test('large counts use thousands separators', () => {
		expect(resultsHeading({ total: 1200, shown: 1200, location: 'X' })).toBe('1,200 rentals in X');
	});
});
