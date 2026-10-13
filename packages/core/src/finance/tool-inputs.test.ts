import { describe, expect, test } from 'vitest';

import * as financeIndex from './index.js';
import {
	FIELD_LIMITS,
	formatMoneyInput,
	parseToolNumber,
	toolMoney,
	toolPercent,
	toolRatio,
	validateToolField
} from './tool-inputs.js';

// Built in code so no invisible or look-alike character lives in the source.
const MINUS = String.fromCharCode(0x2212);

describe('parseToolNumber', () => {
	test.each([
		['250,000', 250000],
		['$250,000', 250000],
		[' 5% ', 5],
		['7.25', 7.25],
		['-5', -5],
		['0', 0]
	])('%j -> %j', (raw, expected) => {
		expect(parseToolNumber(raw)).toBe(expected);
	});

	test.each(['', '   '])('blank %j -> null', (raw) => {
		expect(parseToolNumber(raw)).toBeNull();
	});

	test.each([
		'abc',
		'1,2,3x',
		'--5',
		'1e5',
		'$',
		'%',
		'1.2.3',
		'5%%',
		'$$5',
		'Infinity',
		'.5',
		'5.'
	])('%j -> NaN', (raw) => {
		expect(parseToolNumber(raw)).toBeNaN();
	});
});

describe('validateToolField', () => {
	test('required empty -> required; optional empty -> 0', () => {
		expect(validateToolField('', { kind: 'money', required: true })).toStrictEqual({
			ok: false,
			code: 'required'
		});
		expect(validateToolField('  ', { kind: 'money' })).toStrictEqual({ ok: true, value: 0 });
	});

	test('not a number -> nan', () => {
		expect(validateToolField('abc', { kind: 'money', required: true })).toStrictEqual({
			ok: false,
			code: 'nan'
		});
	});

	test.each([
		['-5', 'money', 'min', { min: 0 }],
		['100,000,001', 'money', 'max', { max: 100000000 }],
		['101', 'percent', 'max', { max: 100 }],
		['31', 'rate', 'max', { max: 30 }],
		['0', 'years', 'min', { min: 1 }],
		['41', 'years', 'max', { max: 40 }]
	] as const)('%j as %s -> %s', (raw, kind, code, bound) => {
		expect(validateToolField(raw, { kind, required: true })).toStrictEqual({
			ok: false,
			code,
			...bound
		});
	});

	test('fractional years -> nan (whole years only)', () => {
		expect(validateToolField('30.5', { kind: 'years', required: true })).toStrictEqual({
			ok: false,
			code: 'nan'
		});
	});

	test('zero price -> price-zero', () => {
		expect(validateToolField('0', { kind: 'money', required: true, positive: true })).toStrictEqual(
			{ ok: false, code: 'price-zero' }
		);
	});

	test('money returns integer cents', () => {
		expect(validateToolField('250,000', { kind: 'money', required: true })).toStrictEqual({
			ok: true,
			value: 25_000_000
		});
		expect(validateToolField('1,247.44', { kind: 'money', required: true })).toStrictEqual({
			ok: true,
			value: 124_744
		});
		expect(validateToolField('$0.29', { kind: 'money' })).toStrictEqual({ ok: true, value: 29 });
		expect(validateToolField('100,000,000', { kind: 'money' })).toStrictEqual({
			ok: true,
			value: 10_000_000_000
		});
	});

	test('percent, rate and years return the plain number', () => {
		expect(validateToolField('5%', { kind: 'percent', required: true })).toStrictEqual({
			ok: true,
			value: 5
		});
		expect(validateToolField('7.125', { kind: 'rate', required: true })).toStrictEqual({
			ok: true,
			value: 7.125
		});
		expect(validateToolField('30', { kind: 'years', required: true })).toStrictEqual({
			ok: true,
			value: 30
		});
	});

	test('FIELD_LIMITS matches the UI-SPEC validation ranges', () => {
		expect(FIELD_LIMITS).toStrictEqual({
			money: { min: 0, max: 100_000_000 },
			percent: { min: 0, max: 100 },
			rate: { min: 0, max: 30 },
			years: { min: 1, max: 40, integer: true }
		});
	});
});

describe('formatting', () => {
	test('formatMoneyInput shows cents only when present', () => {
		expect(formatMoneyInput(25_000_000)).toBe('250,000');
		expect(formatMoneyInput(124_744)).toBe('1,247.44');
		expect(formatMoneyInput(150)).toBe('1.50');
		expect(formatMoneyInput(0)).toBe('0');
	});

	test('toolMoney is whole dollars with a true minus sign', () => {
		expect(toolMoney(1_560_000)).toBe('$15,600');
		expect(toolMoney(63_072)).toBe('$631');
		expect(toolMoney(5_256)).toBe('$53');
		expect(toolMoney(-12_000)).toBe(MINUS + '$120');
	});

	test('toolPercent and toolRatio use two decimals; null stays null', () => {
		expect(toolPercent(0.0624)).toBe('6.24%');
		expect(toolPercent(0.0090103)).toBe('0.90%');
		expect(toolPercent(-0.0125)).toBe(MINUS + '1.25%');
		expect(toolRatio(1.04213)).toBe('1.04');
		expect(toolPercent(null)).toBeNull();
		expect(toolRatio(null)).toBeNull();
	});

	test('the finance index exports the tool helpers', () => {
		expect(financeIndex.validateToolField).toBe(validateToolField);
		expect(financeIndex.toolMoney).toBe(toolMoney);
	});
});
