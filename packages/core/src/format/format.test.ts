import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { MAX_CENTS, parseMoneyInput } from '../finance/money.js';
import {
	MINUS,
	NOT_AVAILABLE,
	longDate,
	monthYear,
	pct,
	pctTrim,
	ratio,
	rateLabel,
	usd,
	usdRange
} from './index.js';

describe('constants', () => {
	test('MINUS is U+2212 and NOT_AVAILABLE is an em dash', () => {
		expect(MINUS).toBe('−');
		expect(NOT_AVAILABLE).toBe('—');
	});
});

describe('usd', () => {
	test.each([
		[185000, '$1,850'],
		[31200000, '$312,000'],
		[-14200, '−$142'],
		[18352, '$184'],
		[-114999, '−$1,150'],
		[-40, '$0'],
		[50, '$1'],
		[-50, '−$1'],
		[0, '$0'],
		[149, '$1'],
		[MAX_CENTS, '$100,000,000']
	])('usd(%i) === %j', (cents, expected) => {
		expect(usd(cents)).toBe(expected);
	});

	test('negative uses U+2212 before the dollar sign', () => {
		expect(usd(-14200).codePointAt(0)).toBe(0x2212);
		expect(usd(-14200)[1]).toBe('$');
	});
});

describe('usdRange', () => {
	test('joins with "to"', () => {
		expect(usdRange(170000, 200000)).toBe('$1,700 to $2,000');
	});
});

describe('pct', () => {
	test.each([
		[7.488, 1, '7.5%'],
		[4.787478, 1, '4.8%'],
		[6.43, 1, '6.4%'],
		[1, 2, '1.00%'],
		[0.625, 2, '0.63%'],
		[0.8213, 2, '0.82%'],
		[-14.99987, 1, '−15.0%'],
		[-0.04, 1, '0.0%'],
		[-0.004, 2, '0.00%'],
		[1234.5, 1, '1,234.5%']
	] as const)('pct(%d, %i) === %j', (value, dp, expected) => {
		expect(pct(value, dp)).toBe(expected);
	});
});

describe('pctTrim', () => {
	test.each([
		[2000, '20%'],
		[550, '5.5%'],
		[525, '5.25%'],
		[0, '0%'],
		[5, '0.05%'],
		[10000, '100%']
	])('pctTrim(%i) === %j', (bps, expected) => {
		expect(pctTrim(bps)).toBe(expected);
	});
});

describe('ratio', () => {
	test.each([
		[1.172403, 2, '1.17'],
		[8.3333, 1, '8.3'],
		[-0.281828, 2, '−0.28'],
		[12.7, 1, '12.7'],
		[-0.001, 2, '0.00']
	] as const)('ratio(%d, %i) === %j', (value, dp, expected) => {
		expect(ratio(value, dp)).toBe(expected);
	});
});

describe('rateLabel', () => {
	test.each([
		[7, '7%'],
		[6.25, '6.25%'],
		[7.125, '7.125%'],
		[0, '0%']
	])('rateLabel(%d) === %j', (rate, expected) => {
		expect(rateLabel(rate)).toBe(expected);
	});
});

describe('dates', () => {
	test('monthYear accepts YYYY-MM or a Date, in UTC', () => {
		expect(monthYear('2025-10')).toBe('Oct 2025');
		expect(monthYear(new Date(Date.UTC(2026, 0, 1)))).toBe('Jan 2026');
		expect(monthYear('2025-12')).toBe('Dec 2025');
	});

	test('longDate formats in UTC', () => {
		expect(longDate(Date.UTC(2026, 9, 1))).toBe('Oct 1, 2026');
		expect(longDate(new Date(Date.UTC(2026, 9, 1)))).toBe('Oct 1, 2026');
	});
});

describe('properties', () => {
	test('usd round-trips through parseMoneyInput for whole dollars', () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 100_000_000 }), (d) => {
				const parsed = parseMoneyInput(usd(d * 100));
				return parsed.ok && parsed.value === d * 100;
			}),
			{ numRuns: 1000 }
		);
	});

	test('no output ever uses parentheses or an ASCII hyphen-minus', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: -MAX_CENTS, max: MAX_CENTS }),
				fc.double({ min: -1e6, max: 1e6, noNaN: true }),
				fc.constantFrom(1 as const, 2 as const),
				(cents, value, dp) => {
					for (const out of [usd(cents), pct(value, dp), ratio(value, dp)]) {
						if (out.includes('(') || out.includes('-')) return false;
					}
					return true;
				}
			),
			{ numRuns: 1000 }
		);
	});

	test('negative usd always carries the MINUS prefix unless it rounds to $0', () => {
		fc.assert(
			fc.property(fc.integer({ min: -MAX_CENTS, max: -1 }), (cents) => {
				const out = usd(cents);
				return out === '$0' ? cents > -50 : out.startsWith(MINUS + '$');
			}),
			{ numRuns: 1000 }
		);
	});
});
