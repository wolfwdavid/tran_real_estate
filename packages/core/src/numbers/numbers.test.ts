import { describe, expect, test } from 'vitest';

import { extractNumerals, type NumeralToken } from './extract.js';

function only(text: string): NumeralToken {
	const tokens = extractNumerals(text);
	expect(tokens).toHaveLength(1);
	return tokens[0]!;
}

describe('extractNumerals', () => {
	test('extract: price and rate in one sentence', () => {
		const tokens = extractNumerals('Price $200,000 and rate 7%');
		expect(tokens).toHaveLength(2);
		expect(tokens[0]).toMatchObject({
			raw: '$200,000',
			value: 200000,
			currency: true,
			decimals: 0,
			sig: 1,
			unit: null,
			scale: 1
		});
		expect(tokens[1]).toMatchObject({ raw: '7%', value: 7, unit: '%', currency: false });
	});

	test.each([
		['$1,064.48', 1064.48, 2, 6, 1],
		['15,000', 15000, 0, 2, 1],
		['0.2', 0.2, 1, 1, 1],
		['7.5', 7.5, 1, 2, 1],
		['20', 20, 0, 1, 1],
		['1,850', 1850, 0, 3, 1],
		['1850', 1850, 0, 3, 1],
		['$46k', 46000, 0, 2, 1000],
		['$1.85k', 1850, 2, 3, 1000],
		['1.9k', 1900, 1, 2, 1000],
		['$0.2 million', 200000, 1, 1, 1e6],
		['3M', 3000000, 0, 1, 1e6],
		['12 thousand', 12000, 0, 2, 1000],
		['7.50', 7.5, 2, 3, 1]
	])(
		'extract: %s -> value %d, decimals %d, sig %d, scale %d',
		(raw, value, decimals, sig, scale) => {
			const t = only(`Figure: ${raw} here`);
			expect(t.raw).toBe(raw);
			expect(t.value).toBeCloseTo(value, 9);
			expect(t.decimals).toBe(decimals);
			expect(t.sig).toBe(sig);
			expect(t.scale).toBe(scale);
		}
	);

	test.each([
		['1.17x', 1.17],
		['1.17×', 1.17]
	])('extract: multiple %s has unit x', (raw, value) => {
		const t = only(`DSCR is ${raw}.`);
		expect(t).toMatchObject({ raw, value, unit: 'x' });
	});

	test.each([
		['7 percent', 7],
		['6.4%', 6.4]
	])('extract: percent form %s', (raw, value) => {
		expect(only(`Rate ${raw} today`)).toMatchObject({ raw, value, unit: '%' });
	});

	test.each([
		['-5%', -5, '%'],
		['−$142', -142, null],
		['(183.52)', -183.52, null],
		['($183.52)', -183.52, null]
	])('extract: negative %s', (raw, value, unit) => {
		const t = only(`Cash flow ${raw} monthly`);
		expect(t.raw).toBe(raw);
		expect(t.value).toBeCloseTo(value, 9);
		expect(t.unit).toBe(unit);
	});

	test('extract: a parenthetical percent or multiple is not an accounting negative', () => {
		expect(only('cap rate (7.49%) here')).toMatchObject({ raw: '7.49%', value: 7.49 });
		expect(only('DSCR (1.17x) here')).toMatchObject({ raw: '1.17x', value: 1.17 });
	});

	test('extract: an unclosed parenthesis is not a sign', () => {
		const t = only('a loan (30-year fixed)');
		expect(t).toMatchObject({ raw: '30', value: 30 });
	});

	test('extract: en-dash range 1,800–2,100 yields two positive tokens with exact offsets', () => {
		const text = 'a range of 1,800–2,100 per month';
		const tokens = extractNumerals(text);
		expect(tokens.map((t) => t.value)).toEqual([1800, 2100]);
		expect(tokens.map((t) => t.raw)).toEqual(['1,800', '2,100']);
		expect(tokens[0]!.start).toBe(text.indexOf('1,800'));
		expect(tokens[1]!.start).toBe(text.indexOf('2,100'));
	});

	test('extract: hyphen range also parses the second number positive', () => {
		expect(extractNumerals('between 1,800-2,100').map((t) => t.value)).toEqual([1800, 2100]);
	});

	test('extract: 30-year is one token of 30', () => {
		expect(only('a 30-year mortgage')).toMatchObject({ raw: '30', value: 30 });
	});

	test.each(['the 1% rule', 'The 1%  RULE says', 'the 50% rule', 'per the 50% Rule.'])(
		'extract: named rule "%s" produces no tokens',
		(text) => {
			expect(extractNumerals(text)).toEqual([]);
		}
	);

	test('extract: list enumerators are skipped but later numbers on the line are kept', () => {
		const text = '1. Price is $200,000\n2) Rate is 7%\n  3. Term 30 years';
		const tokens = extractNumerals(text);
		expect(tokens.map((t) => t.raw)).toEqual(['$200,000', '7%', '30']);
	});

	test('extract: markdown bullets are not minus signs', () => {
		const text = '- 30-year fixed\n* 7% rate\n  - $200,000 price';
		expect(extractNumerals(text).map((t) => t.value)).toEqual([30, 7, 200000]);
	});

	test.each(['B2B leads', 'version v1', 'item A1'])(
		'extract: digits inside words (%s) produce no tokens',
		(text) => {
			expect(extractNumerals(text)).toEqual([]);
		}
	);

	test('extract: leading and trailing whitespace never enter the span', () => {
		const text = 'Rate:  7 and price: $200,000 , done';
		const tokens = extractNumerals(text);
		expect(tokens.map((t) => t.raw)).toEqual(['7', '$200,000']);
	});

	test('extract: offsets always slice back to raw', () => {
		const text = [
			'1. Price $200,000 (down 20%), loan $160,000 at 7% for a 30-year term.',
			'Cash flow is −$142 or (183.52); cap rate ≈7.5% and DSCR 1.17×.',
			'Rent rose -5% to $1.85k, about 1.9k, or $0.2 million total; 3M units.',
			'Range 1,800–2,100. The 1% rule passes. B2B v1 version.'
		].join('\n');
		const tokens = extractNumerals(text);
		expect(tokens.length).toBeGreaterThan(15);
		for (const t of tokens) {
			expect(text.slice(t.start, t.end)).toBe(t.raw);
			expect(t.raw).toBe(t.raw.trim());
		}
	});

	test('extract: zero is extracted with sign 0', () => {
		const t = only('vacancy 0%');
		expect(t.value).toBe(0);
		expect(t.sig).toBe(1);
	});
});
