import { describe, expect, it } from 'vitest';
import { SAMPLE_LISTING_FACTS } from '../fixtures/sample-listing-facts';
import {
	emptyListingForm,
	factsToForm,
	fieldId,
	firstInvalidKey,
	formatNumberText,
	parseNumberText,
	restoreListingForm,
	sameForm,
	toFactsInput,
	validateListingForm
} from './listing-form';

const NOW = new Date('2026-10-07T12:00:00Z');

describe('listing form model', () => {
	it('parses typed numbers, keeping bad text as an error value', () => {
		expect(parseNumberText('')).toBeUndefined();
		expect(parseNumberText(' $425,000 ')).toBe(425000);
		expect(parseNumberText('2.5')).toBe(2.5);
		expect(parseNumberText('two')).toBeNaN();
	});

	it('formats on blur: separators for price and square feet only', () => {
		expect(formatNumberText('price', '425000')).toBe('425,000');
		expect(formatNumberText('squareFeet', '1650')).toBe('1,650');
		expect(formatNumberText('yearBuilt', '1994')).toBe('1994');
		expect(formatNumberText('bathrooms', '2.50')).toBe('2.5');
		expect(formatNumberText('price', 'lots')).toBe('lots');
	});

	it('an empty form fails on the required facts, first the listing type', () => {
		const r = validateListingForm(emptyListingForm(), NOW);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.errors.listingType).toBe('Choose For sale or For rent.');
		expect(r.errors.propertyType).toBe('Choose a property type.');
		expect(r.errors.bedrooms).toBe('Enter the number of bedrooms, from 0 to 20.');
		expect(r.errors.bathrooms).toBe('Enter the number of bathrooms, like 2 or 2.5.');
		expect(firstInvalidKey(r.errors)).toBe('listingType');
		expect(fieldId('listingType')).toBe('listing-listing-type-sale');
	});

	it('format errors use the core copy', () => {
		const form = { ...factsToForm(SAMPLE_LISTING_FACTS), squareFeet: 'big', yearBuilt: '1600' };
		const r = validateListingForm(form, NOW);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.errors.squareFeet).toBe('Enter a number, like 1450.');
		expect(r.errors.yearBuilt).toBe('Enter a year from 1700 to 2026.');
		expect(firstInvalidKey(r.errors)).toBe('squareFeet');
		expect(fieldId('squareFeet')).toBe('listing-square-feet');
	});

	it('round-trips the sample facts through the form', () => {
		const form = factsToForm(SAMPLE_LISTING_FACTS);
		expect(form.price).toBe('425,000');
		const r = validateListingForm(form, NOW);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value).toEqual({ ...SAMPLE_LISTING_FACTS });
		expect(sameForm(form, factsToForm(SAMPLE_LISTING_FACTS))).toBe(true);
		expect(sameForm({ ...form, bedrooms: '4' }, form)).toBe(false);
	});

	it('produces whitelisted keys only', () => {
		const keys = Object.keys(toFactsInput(factsToForm(SAMPLE_LISTING_FACTS)));
		for (const k of keys) expect(k).not.toMatch(/school|crime|safety|worship|demograph/i);
	});

	it('restores a stored form and ignores junk', () => {
		const form = factsToForm(SAMPLE_LISTING_FACTS);
		expect(restoreListingForm(JSON.parse(JSON.stringify(form)))).toEqual(form);
		expect(restoreListingForm(null)).toEqual(emptyListingForm());
		const junk = restoreListingForm({ tone: 'loud', features: [1], schools: 'x', bedrooms: 3 });
		expect(junk.tone).toBe('warm');
		expect(junk.features).toEqual([]);
		expect(junk.bedrooms).toBe('');
		expect('schools' in junk).toBe(false);
	});
});
