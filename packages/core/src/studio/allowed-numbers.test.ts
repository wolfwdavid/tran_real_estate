import { describe, expect, test } from 'vitest';

import { allowedSet, numbersInTexts } from './allowed-numbers.js';

describe('numbersInTexts', () => {
	test('collects every numeral value the memo extractor finds', () => {
		const values = numbersInTexts([
			'3 bedrooms, open house Saturday 1 to 3',
			'$2,450 a month',
			undefined
		]);
		expect(values).toContain(3);
		expect(values).toContain(1);
		expect(values).toContain(2450);
	});

	test('parses typed formatting exactly as the checker does', () => {
		expect(numbersInTexts(['1,450 sq ft', '$1.85k', null])).toEqual([1450, 1850]);
	});

	test('no texts give no numbers', () => {
		expect(numbersInTexts([])).toEqual([]);
		expect(numbersInTexts([null, undefined, ''])).toEqual([]);
	});
});

describe('allowedSet', () => {
	test('finite, de-duplicated, sorted ascending, with numbers from free text', () => {
		expect(allowedSet([3, 2.5, null, NaN, 1450], ['built in 1987'])).toEqual([2.5, 3, 1450, 1987]);
	});

	test('drops infinities and duplicates across values and text', () => {
		expect(allowedSet([Infinity, -Infinity, 3, 3, undefined], ['3 beds, 3 baths'])).toEqual([3]);
	});

	test('texts are optional', () => {
		expect(allowedSet([10, -2, 0])).toEqual([-2, 0, 10]);
	});
});
