import { describe, expect, test } from 'vitest';

import {
	allowedFromText,
	checkNumbers,
	matchesAllowed,
	NUMERIC_CATEGORY,
	type AllowedNumber
} from './check.js';
import { extractNumerals, type NumeralToken } from './extract.js';
import { findSpelledQuantities } from './spelled.js';

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

/** Case A facts (RESEARCH Pattern 5 prototype). Down payment % deliberately absent. */
const A = [
	200000, 160000, 1064.48, 7, 30, 1900, 1248, 14976, 183.52, 2202.24, 46000, 7.488, 4.787478,
	1.172403, 8.333333, 1
];

describe('checkNumbers: prototype allowed set A', () => {
	test.each([
		'$200,000',
		'7.49%',
		'≈7.5%',
		'$183.52',
		'$2,202.24',
		'4.79%',
		'1.17x',
		'8.3',
		'$1,064.48',
		'30-year',
		'7%',
		'$46k',
		'$15,000',
		'$0.2 million', // coincidental match with the $200,000 price: acceptable, the number is present
		'the 1% rule'
	])('passes %s', (phrase) => {
		expect(checkNumbers(`The memo says ${phrase} in this sentence.`, A)).toEqual([]);
	});

	test('the 1% rule passes even with an empty allowed set', () => {
		expect(checkNumbers('It meets the 1% rule.', [])).toEqual([]);
	});

	test.each(['20%', '-5%'])('flags invented %s as a block finding', (phrase) => {
		const text = `Rents could move ${phrase} next year.`;
		const findings = checkNumbers(text, A);
		expect(findings).toEqual([
			{
				start: text.indexOf(phrase),
				end: text.indexOf(phrase) + phrase.length,
				text: phrase,
				severity: 'block',
				category: NUMERIC_CATEGORY,
				reason: 'not-in-allowed'
			}
		]);
	});

	test('flags both ends of an invented range 1,800–2,100', () => {
		const text = 'Expect a range of 1,800–2,100 in rent.';
		const findings = checkNumbers(text, A);
		expect(findings.map((f) => f.text)).toEqual(['1,800', '2,100']);
		for (const f of findings) {
			expect(text.slice(f.start, f.end)).toBe(f.text);
			expect(f.severity).toBe('block');
		}
	});

	test('flags (183.52) because the sign does not match', () => {
		const text = 'Cash flow is (183.52) monthly.';
		expect(checkNumbers(text, A)).toMatchObject([{ text: '(183.52)', reason: 'not-in-allowed' }]);
	});

	test('a full sample memo flags exactly the prototype set', () => {
		const memo = [
			'At $200,000 with 20% down, the $160,000 loan at 7% over a 30-year term costs $1,064.48 a month.',
			'Estimated cash flow is $183.52 (about $2,202.24 a year), a cap rate of ≈7.5% (7.49%), and',
			'a cash-on-cash return of 4.79%. DSCR is 1.17x and GRM is 8.3. Cash invested is about $46k,',
			'and NOI is roughly $15,000. It passes the 1% rule. Comparable rents run 1,800–2,100, and',
			'a -5% shift in rent would change the picture.'
		].join('\n');
		expect(checkNumbers(memo, A).map((f) => f.text)).toEqual(['20%', '1,800', '2,100', '-5%']);
	});
});

describe('checkNumbers: UI-SPEC tolerance examples', () => {
	test.each(['$1,850', '1850', '$1.85k', '1.9k'])('%s matches 1,850', (phrase) => {
		expect(checkNumbers(`Rent ${phrase} monthly`, [1850])).toEqual([]);
	});

	test('$1,900 does not match 1,850', () => {
		expect(checkNumbers('Rent $1,900 monthly', [1850])).toHaveLength(1);
	});

	test('6.4% matches 6.4 and 6.5% does not', () => {
		expect(checkNumbers('Cap 6.4% today', [6.4])).toEqual([]);
		expect(checkNumbers('Cap 6.5% today', [6.4])).toHaveLength(1);
	});
});

/**
 * Mutation boundaries: each tolerance rule has one case just inside and one
 * just outside, so weakening or tightening any rule flips a test.
 */
describe('matchesAllowed: rule boundaries', () => {
	const tok = (raw: string): NumeralToken => {
		const tokens = extractNumerals(`x ${raw} y`);
		expect(tokens).toHaveLength(1);
		return tokens[0]!;
	};

	test.each([
		// half-unit rule at display precision
		['7.5', 7.45, true],
		['7.5', 7.4499, false],
		['8', 8.5, true],
		['8', 8.51, false],
		['1.9k', 1850, true],
		['1.9k', 1849.9, false],
		['$0.2 million', 250000, true],
		['$0.2 million', 250001, false],
		// relative 0.5% rule, only for sig >= 2
		['15,000', 14925.38, true],
		['15,000', 14925, false],
		['210', 211, true],
		['210', 209, true],
		['210', 212.2, false],
		['3', 3.01, true],
		['20', 21, false],
		// sign rule
		['-5', -5, true],
		['-5', 5, false],
		['5', -5, false],
		['0', 0, true],
		['0', 0.4, false],
		['(183.52)', -183.52, true],
		['(183.52)', 183.52, false]
	])('%s vs %d -> %s', (raw, allowed, expected) => {
		expect(matchesAllowed(tok(raw), allowed)).toBe(expected);
	});

	test('a single-significant-digit numeral gets no relative slack', () => {
		expect(matchesAllowed(tok('20'), 20.4)).toBe(true);
		expect(matchesAllowed(tok('20'), 20.6)).toBe(false);
		// "300" has sig 1: 301.4 is within 0.5% but outside the half unit, so it must not match.
		expect(matchesAllowed(tok('300'), 301.4)).toBe(false);
		// "310" has sig 2: 311.4 is within 0.5% (1.557), so it matches.
		expect(matchesAllowed(tok('310'), 311.4)).toBe(true);
	});
});

describe('checkNumbers: options and allowed forms', () => {
	test('category label is a parameter', () => {
		expect(checkNumbers('20%', [], { category: 'Number not in your facts' })[0]!.category).toBe(
			'Number not in your facts'
		);
	});

	test('AllowedNumber objects and bare numbers are both accepted', () => {
		const allowed: (number | AllowedNumber)[] = [{ value: 2000, source: 'your notes' }, 30];
		expect(checkNumbers('Rent $2,000 for 30 years', allowed)).toEqual([]);
	});

	test('allowedFromText extracts values with the source tag', () => {
		const allowed = allowedFromText('Rent: $2,000. Term: 30 years', 'your notes');
		expect(allowed.map((a) => a.value)).toEqual([2000, 30]);
		expect(allowed.every((a) => a.source === 'your notes')).toBe(true);
	});

	test('everything in the facts text passes against its own allowedFromText', () => {
		const facts = 'Price: $200,000\nDown payment: 20%\nMonthly cash flow: −$142.18\nDSCR: 1.17x';
		expect(checkNumbers(facts, allowedFromText(facts))).toEqual([]);
	});

	test('non-finite allowed values are ignored', () => {
		expect(checkNumbers('7%', [Number.NaN, Number.POSITIVE_INFINITY])).toHaveLength(1);
	});
});

describe('spelled-out quantities', () => {
	test.each([
		['rents rose twelve percent', 'twelve percent'],
		['eleven units', 'eleven'],
		['a dozen comparables', 'dozen'],
		['twenty thousand dollars', 'twenty thousand'],
		['five percent', 'five percent'],
		['Twenty-five units', 'Twenty-five'],
		['one hundred and fifty homes', 'one hundred and fifty']
	])('%s -> one warn for "%s"', (text, phrase) => {
		const findings = checkNumbers(text, []);
		expect(findings).toEqual([
			{
				start: text.indexOf(phrase),
				end: text.indexOf(phrase) + phrase.length,
				text: phrase,
				severity: 'warn',
				category: NUMERIC_CATEGORY,
				reason: 'spelled-out'
			}
		]);
	});

	test.each(['two bedrooms', 'three baths', 'ten minutes', 'one of the comparables', 'often'])(
		'"%s" produces no finding',
		(text) => {
			expect(checkNumbers(text, [])).toEqual([]);
		}
	);

	test('a scale word inside a digit numeral is not double-reported', () => {
		expect(checkNumbers('about 12 thousand', [12000])).toEqual([]);
		expect(checkNumbers('about 20 million', [])).toMatchObject([
			{ text: '20 million', reason: 'not-in-allowed' }
		]);
	});

	test('findSpelledQuantities takes its own category', () => {
		expect(findSpelledQuantities('eleven units', 'Studio check')[0]!.category).toBe('Studio check');
	});

	test('findings are sorted by start across both kinds', () => {
		const text = 'Twelve percent, then 20%, then a dozen more, then 30%.';
		const findings = checkNumbers(text, []);
		expect(findings.map((f) => f.text)).toEqual(['Twelve percent', '20%', 'dozen', '30%']);
		const starts = findings.map((f) => f.start);
		expect([...starts].sort((a, b) => a - b)).toEqual(starts);
	});
});
