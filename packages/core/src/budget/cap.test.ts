import { describe, expect, test } from 'vitest';

import {
	CAP_MAX,
	CAP_MIN,
	DEFAULT_CAP,
	METER_THRESHOLDS,
	OVERAGE_USD,
	PLAN_LIMIT,
	canSpend,
	confirmVariant,
	matchesOverageWord,
	meterState,
	meterTransition,
	overageCostUsd,
	validateCap,
	type MeterState
} from './index.js';

describe('constants', () => {
	test('match the RentCast free plan and the locked defaults', () => {
		expect(PLAN_LIMIT).toBe(50);
		expect(DEFAULT_CAP).toBe(40);
		expect(CAP_MIN).toBe(1);
		expect(CAP_MAX).toBe(1000);
		expect(OVERAGE_USD).toBe(0.2);
		expect(METER_THRESHOLDS.nearMaxLeft).toBe(5);
	});
});

describe('validateCap', () => {
	test.each(['', '   '])('%j is empty', (input) => {
		expect(validateCap(input)).toEqual({ ok: false, error: 'empty' });
	});

	test.each(['4.5', 'abc', '40a', '1e2'])('%j is not an integer', (input) => {
		expect(validateCap(input)).toEqual({ ok: false, error: 'not-integer' });
	});

	test.each(['0', '-3'])('%j is below the minimum', (input) => {
		expect(validateCap(input)).toEqual({ ok: false, error: 'below-min' });
	});

	test('1001 is above the maximum', () => {
		expect(validateCap('1001')).toEqual({ ok: false, error: 'above-max' });
	});

	test.each([
		[' 40 ', 40, false],
		['1', 1, false],
		['50', 50, false],
		['51', 51, true],
		['1000', 1000, true]
	])('%j is valid (%i, aboveLimit %s)', (input, value, aboveLimit) => {
		expect(validateCap(input)).toEqual({ ok: true, value, aboveLimit });
	});
});

describe('matchesOverageWord', () => {
	test.each(['overage', 'Overage ', '  OVERAGE'])('%j matches', (input) => {
		expect(matchesOverageWord(input)).toBe(true);
	});

	test.each(['overag', 'overages', ''])('%j does not match', (input) => {
		expect(matchesOverageWord(input)).toBe(false);
	});
});

describe('canSpend', () => {
	test('blocks the call that would exceed the cap', () => {
		expect(canSpend(39, 40)).toBe(true);
		expect(canSpend(40, 40)).toBe(false);
		expect(canSpend(0, 1)).toBe(true);
		expect(canSpend(39, 40, 2)).toBe(false);
	});
});

describe('meterState', () => {
	test.each<[number, number, MeterState]>([
		[34, 40, 'ok'], // left 6
		[35, 40, 'near'], // left 5
		[39, 40, 'near'], // left 1
		[40, 40, 'at'], // left 0
		[45, 40, 'at'],
		[49, 60, 'ok'], // left 11
		[50, 60, 'past'],
		[50, 40, 'past'],
		[55, 60, 'past'] // past takes priority even with headroom under cap
	])('used %i, cap %i -> %s', (used, cap, expected) => {
		expect(meterState(used, cap)).toBe(expected);
	});

	test('honors an explicit plan limit', () => {
		expect(meterState(10, 1000, 10)).toBe('past');
	});
});

describe('meterTransition', () => {
	test.each<[MeterState | null, MeterState, MeterState | null]>([
		[null, 'near', null], // never announce on load
		[null, 'past', null],
		['ok', 'near', 'near'],
		['near', 'at', 'at'],
		['at', 'past', 'past'],
		['ok', 'at', 'at'],
		['near', 'near', null],
		['at', 'near', null], // cap raised
		['near', 'ok', null]
	])('%s -> %s announces %s', (prev, next, expected) => {
		expect(meterTransition(prev, next)).toBe(expected);
	});
});

describe('confirmVariant', () => {
	test('switches to past-plan for call 51', () => {
		expect(confirmVariant(48)).toBe('within-plan');
		expect(confirmVariant(49)).toBe('within-plan');
		expect(confirmVariant(50)).toBe('past-plan');
	});
});

describe('overageCostUsd', () => {
	test('is exact for caps above the plan limit and zero at or below it', () => {
		expect(overageCostUsd(60)).toBe(2);
		expect(overageCostUsd(40)).toBe(0);
		expect(overageCostUsd(50)).toBe(0);
		expect(overageCostUsd(51)).toBe(0.2);
		expect(overageCostUsd(1000)).toBe(190);
	});
});
