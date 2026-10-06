import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { monthlyPayment } from './amortization.js';
import { centsArb, rateArb, termArb } from './arbitraries.js';
import { MAX_CENTS, divRoundHalfAway } from './money.js';

const principalArb = centsArb(1, MAX_CENTS / 10);

describe('monthlyPayment published anchors', () => {
	test.each([
		[10_000_000, 6, 30, 59_955], // $100,000 @ 6% / 30y = $599.55
		[16_000_000, 7, 30, 106_448], // $160,000 @ 7% / 30y = $1,064.48
		[20_000_000, 6.5, 30, 126_414], // $200,000 @ 6.5% / 30y = $1,264.14
		[20_000_000, 7, 30, 133_060], // $200,000 @ 7% / 30y = $1,330.60
		[32_000_000, 7.5, 30, 223_749], // $320,000 @ 7.5% / 30y = $2,237.49
		[7_500_000, 6, 30, 44_966],
		[11_852_393, 6.25, 15, 101_625],
		[8_000_000, 7, 30, 53_224]
	])('monthlyPayment(%i, %d, %i) === %i', (principal, rate, years, expected) => {
		expect(monthlyPayment(principal, rate, years)).toBe(expected);
	});

	test('0% rate divides the principal evenly without dividing by zero', () => {
		expect(monthlyPayment(9_000_000, 0, 15)).toBe(50_000);
	});

	test('zero principal pays nothing', () => {
		expect(monthlyPayment(0, 7, 30)).toBe(0);
		expect(monthlyPayment(0, 0, 30)).toBe(0);
	});
});

describe('monthlyPayment properties', () => {
	test('is a finite non-negative integer', () => {
		fc.assert(
			fc.property(principalArb, rateArb, termArb, (l, rate, years) => {
				const p = monthlyPayment(l, rate, years);
				return Number.isFinite(p) && Number.isInteger(p) && p >= 0;
			}),
			{ numRuns: 500 }
		);
	});

	test('is non-decreasing in rate', () => {
		fc.assert(
			fc.property(principalArb, rateArb, rateArb, termArb, (l, a, b, years) => {
				const [lo, hi] = a <= b ? [a, b] : [b, a];
				return monthlyPayment(l, lo, years) <= monthlyPayment(l, hi, years);
			}),
			{ numRuns: 500 }
		);
	});

	test('is non-increasing in term', () => {
		fc.assert(
			fc.property(principalArb, rateArb, termArb, termArb, (l, rate, a, b) => {
				const [short, long] = a <= b ? [a, b] : [b, a];
				return monthlyPayment(l, rate, short) >= monthlyPayment(l, rate, long);
			}),
			{ numRuns: 500 }
		);
	});

	test('with a positive rate, total paid covers the principal (up to per-payment rounding)', () => {
		fc.assert(
			fc.property(
				principalArb,
				rateArb.filter((r) => r > 0),
				termArb,
				(l, rate, years) => {
					const n = years * 12;
					const p = monthlyPayment(l, rate, years);
					// Never below the interest-free payment, so P*n >= L whenever L/n is not rounded down.
					return p >= divRoundHalfAway(l, n) && p * n + n / 2 >= l;
				}
			),
			{ numRuns: 500 }
		);
	});

	test('with a positive rate and a principal of at least $1,000, P*n >= L strictly', () => {
		fc.assert(
			fc.property(
				centsArb(100_000, MAX_CENTS / 10),
				fc.integer({ min: 1000, max: 15000 }).map((t) => t / 1000),
				termArb,
				(l, rate, years) => monthlyPayment(l, rate, years) * years * 12 >= l
			),
			{ numRuns: 500 }
		);
	});

	test('at 0% the payments sum to the principal within half a cent per payment', () => {
		fc.assert(
			fc.property(principalArb, termArb, (l, years) => {
				const n = years * 12;
				return Math.abs(monthlyPayment(l, 0, years) * n - l) <= n / 2;
			}),
			{ numRuns: 500 }
		);
	});
});
