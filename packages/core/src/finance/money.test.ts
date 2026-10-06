import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import {
	MAX_CENTS,
	divRoundHalfAway,
	mulBps,
	parseMoneyInput,
	parsePercentInput,
	parseRateInput,
	roundHalfAway
} from './money.js';

/** BigInt reference for mulBps: exact product, then half away from zero. */
function mulBpsReference(c: number, bps: number): number {
	const n = BigInt(c) * BigInt(bps);
	const q = n / 10000n;
	const r = n % 10000n;
	const abs = r < 0n ? -r : r;
	const sign = n < 0n ? -1n : n > 0n ? 1n : 0n;
	return Number(abs * 2n >= 10000n ? q + sign : q);
}

describe('mulBps', () => {
	test.each([
		[10000, 500, 500],
		[190000, 800, 15200],
		[177777, 333, 5920],
		[17777700, 3333, 5925307]
	])('mulBps(%i, %i) === %i', (c, bps, expected) => {
		expect(mulBps(c, bps)).toBe(expected);
	});

	test.each([
		[1, 5000, 1],
		[-1, 5000, -1],
		[3, 5000, 2],
		[-3, 5000, -2],
		[1, 4999, 0]
	])('rounds half away from zero: mulBps(%i, %i) === %i', (c, bps, expected) => {
		expect(mulBps(c, bps)).toBe(expected);
	});

	test('never returns negative zero', () => {
		expect(Object.is(mulBps(-1, 1), 0)).toBe(true);
		expect(Object.is(mulBps(0, 500), 0)).toBe(true);
	});

	test('matches a BigInt reference for random cents (including negatives) and bps', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: -MAX_CENTS, max: MAX_CENTS }),
				fc.integer({ min: 0, max: 10000 }),
				(c, bps) => mulBps(c, bps) === mulBpsReference(c, bps)
			),
			{ numRuns: 2000 }
		);
	});
});

describe('divRoundHalfAway', () => {
	test.each([
		[900000000, 180, 5000000],
		[5, 2, 3],
		[-5, 2, -3],
		[7, 3, 2],
		[-7, 3, -2],
		[0, 7, 0]
	])('divRoundHalfAway(%i, %i) === %i', (num, den, expected) => {
		expect(divRoundHalfAway(num, den)).toBe(expected);
	});

	test('matches a BigInt reference', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: -MAX_CENTS, max: MAX_CENTS }),
				fc.integer({ min: 1, max: 1_000_000 }),
				(num, den) => {
					const n = BigInt(num);
					const d = BigInt(den);
					const q = n / d;
					const r = n % d;
					const abs = r < 0n ? -r : r;
					const sign = n < 0n ? -1n : 1n;
					const ref = Number(abs * 2n >= d ? q + sign : q);
					return divRoundHalfAway(num, den) === ref;
				}
			),
			{ numRuns: 2000 }
		);
	});
});

describe('roundHalfAway', () => {
	test.each([
		[2.5, 3],
		[-2.5, -3],
		[2.4, 2],
		[-2.4, -2],
		[0.5, 1],
		[-0.5, -1]
	])('roundHalfAway(%d) === %d', (x, expected) => {
		expect(roundHalfAway(x)).toBe(expected);
	});

	test('never returns negative zero', () => {
		expect(Object.is(roundHalfAway(-0.2), 0)).toBe(true);
	});
});

describe('parseMoneyInput', () => {
	test.each([
		['', null],
		['   ', null],
		['250000', 25000000],
		['250,000', 25000000],
		['$250,000', 25000000],
		[' $1,234.56 ', 123456],
		['1,234.5', 123450],
		['$ 99', 9900],
		['0', 0],
		['100000000', MAX_CENTS]
	])('%j -> %j', (input, value) => {
		expect(parseMoneyInput(input)).toEqual({ ok: true, value });
	});

	test.each([
		['-5', 'negative'],
		['−5', 'negative'],
		['$-5', 'negative'],
		['abc', 'not-a-number'],
		['1,23', 'not-a-number'],
		['$', 'not-a-number'],
		['1.', 'not-a-number'],
		['1e5', 'not-a-number'],
		['1.234', 'too-precise'],
		['100000001', 'too-large'],
		['100000000.01', 'too-large']
	])('%j -> error %s', (input, error) => {
		expect(parseMoneyInput(input)).toEqual({ ok: false, error });
	});
});

describe('parsePercentInput', () => {
	test.each([
		['5', 500],
		['5.5%', 550],
		['5.25', 525],
		[' 20 % ', 2000],
		['0', 0],
		['100', 10000],
		['', null]
	])('%j -> %j bps', (input, value) => {
		expect(parsePercentInput(input)).toEqual({ ok: true, value });
	});

	test.each([
		['5.255', 'too-precise'],
		['101', 'out-of-range'],
		['-1', 'negative'],
		['−1', 'negative'],
		['1,000', 'not-a-number'],
		['%', 'not-a-number']
	])('%j -> error %s', (input, error) => {
		expect(parsePercentInput(input)).toEqual({ ok: false, error });
	});

	test('honours custom min/max (in percent)', () => {
		expect(parsePercentInput('3', { min: 5, max: 50 })).toEqual({
			ok: false,
			error: 'out-of-range'
		});
		expect(parsePercentInput('60', { min: 5, max: 50 })).toEqual({
			ok: false,
			error: 'out-of-range'
		});
		expect(parsePercentInput('25', { min: 5, max: 50 })).toEqual({ ok: true, value: 2500 });
	});
});

describe('parseRateInput', () => {
	test.each([
		['7', 7],
		['7.125%', 7.125],
		['0', 0],
		['25', 25],
		['6.25', 6.25],
		['', null]
	])('%j -> %j', (input, value) => {
		expect(parseRateInput(input)).toEqual({ ok: true, value });
	});

	test.each([
		['7.1255', 'too-precise'],
		['26', 'out-of-range'],
		['25.001', 'out-of-range'],
		['-1', 'negative'],
		['seven', 'not-a-number']
	])('%j -> error %s', (input, error) => {
		expect(parseRateInput(input)).toEqual({ ok: false, error });
	});
});
