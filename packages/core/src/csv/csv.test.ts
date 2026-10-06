import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
	CsvError,
	detectDelimiter,
	escapeFormula,
	parseCsv,
	toCsv,
	unescapeFormula
} from './csv.js';

const BOM = '\uFEFF';

/** Characters that stress quoting, line endings and formula escaping. */
const NASTY = ['"', ',', ';', '\r', '\n', '=', '+', '-', '@', "'", '\t', 'a', ' ', '\u{1F600}'];
const biasedString = fc.string({ unit: fc.constantFrom(...NASTY), maxLength: 12 });
const graphemeString = fc.string({ unit: 'grapheme', maxLength: 12 });
const cell = fc.oneof(biasedString, graphemeString);

const table = fc.integer({ min: 1, max: 5 }).chain((cols) =>
	fc.array(fc.array(cell, { minLength: cols, maxLength: cols }), {
		minLength: 1,
		maxLength: 8
	})
);

describe('toCsv', () => {
	it('writes a BOM, quotes every field, doubles quotes and ends rows with CRLF', () => {
		expect(
			toCsv([
				['a', 'b'],
				['c,d', 'e"f']
			])
		).toBe(`${BOM}"a","b"\r\n"c,d","e""f"\r\n`);
	});

	it('writes only the BOM for an empty table', () => {
		expect(toCsv([])).toBe(BOM);
	});

	it('escapes formula triggers in every cell', () => {
		expect(toCsv([['=SUM(A1)', '+1', 'ok']])).toBe(`${BOM}"'=SUM(A1)","'+1","ok"\r\n`);
	});

	it('keeps embedded newlines inside the quotes', () => {
		expect(toCsv([['line 1\r\nline 2']])).toBe(`${BOM}"line 1\r\nline 2"\r\n`);
	});
});

describe('escapeFormula / unescapeFormula', () => {
	it.each([
		['=SUM(A1)', "'=SUM(A1)"],
		['+1', "'+1"],
		['-5', "'-5"],
		['@x', "'@x"],
		['\tx', "'\tx"],
		['\rx', "'\rx"],
		['\nx', "'\nx"],
		["'=x", "''=x"],
		["''+x", "'''+x"],
		['plain', 'plain'],
		["'plain", "'plain"],
		["'", "'"],
		['', ''],
		['a=b', 'a=b']
	])('escapeFormula(%j) is %j', (input, expected) => {
		expect(escapeFormula(input)).toBe(expected);
		expect(unescapeFormula(expected)).toBe(input);
	});

	it('leaves unescaped values that merely start with an apostrophe alone', () => {
		expect(unescapeFormula("'plain")).toBe("'plain");
		expect(unescapeFormula("O'Brien")).toBe("O'Brien");
	});

	it('is an exact inverse for arbitrary graphemes', () => {
		fc.assert(
			fc.property(fc.string({ unit: 'grapheme' }), (v) => {
				expect(unescapeFormula(escapeFormula(v))).toBe(v);
			}),
			{ numRuns: 500 }
		);
	});

	it('is an exact inverse for strings biased to triggers and apostrophes', () => {
		const biased = fc.string({
			unit: fc.constantFrom('=', '+', '-', '@', "'", '\t', '\r', '\n', 'x')
		});
		fc.assert(
			fc.property(biased, (v) => {
				const escaped = escapeFormula(v);
				expect(unescapeFormula(escaped)).toBe(v);
				// Escaped output never starts with a bare trigger.
				expect(/^[=+\-@\t\r\n]/.test(escaped)).toBe(false);
			}),
			{ numRuns: 500 }
		);
	});
});

describe('parseCsv', () => {
	it('strips a leading BOM', () => {
		expect(parseCsv(`${BOM}a,b\r\n`)).toEqual([['a', 'b']]);
	});

	it('only strips a BOM at the very start', () => {
		expect(parseCsv(`a,${BOM}b`)).toEqual([['a', `${BOM}b`]]);
	});

	it('handles quoted delimiters, doubled quotes and every line ending inside quotes', () => {
		expect(parseCsv('"a,b","say ""hi""","x\ry","x\ny","x\r\ny"\r\n')).toEqual([
			['a,b', 'say "hi"', 'x\ry', 'x\ny', 'x\r\ny']
		]);
	});

	it('handles unquoted fields', () => {
		expect(parseCsv('name,email\nJo,jo@example.com')).toEqual([
			['name', 'email'],
			['Jo', 'jo@example.com']
		]);
	});

	it('keeps empty fields', () => {
		expect(parseCsv('a,,b')).toEqual([['a', '', 'b']]);
		expect(parseCsv(',')).toEqual([['', '']]);
	});

	it('does not add a row for a trailing newline', () => {
		expect(parseCsv('a,b\r\n')).toEqual([['a', 'b']]);
		expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
		expect(parseCsv('a,b\r')).toEqual([['a', 'b']]);
	});

	it('accepts CR-only, LF-only and CRLF line endings', () => {
		const expected = [['a'], ['b'], ['c']];
		expect(parseCsv('a\rb\rc')).toEqual(expected);
		expect(parseCsv('a\nb\nc')).toEqual(expected);
		expect(parseCsv('a\r\nb\r\nc')).toEqual(expected);
	});

	it('keeps a lone quoted empty field at end of input', () => {
		expect(parseCsv('""')).toEqual([['']]);
		expect(parseCsv('a\r\n""')).toEqual([['a'], ['']]);
	});

	it('returns no rows for empty input', () => {
		expect(parseCsv('')).toEqual([]);
		expect(parseCsv(BOM)).toEqual([]);
	});

	it('throws CsvError unterminated-quote for an open quote', () => {
		expect(() => parseCsv('"abc')).toThrow(CsvError);
		try {
			parseCsv('a,"b\r\nc');
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(CsvError);
			expect((e as CsvError).code).toBe('unterminated-quote');
		}
	});

	it('splits on semicolons when asked', () => {
		expect(parseCsv('a;b,c;"d;e"', ';')).toEqual([['a', 'b,c', 'd;e']]);
	});
});

describe('detectDelimiter', () => {
	it('detects semicolons', () => {
		expect(detectDelimiter('name;email;phone')).toBe(';');
	});
	it('detects commas', () => {
		expect(detectDelimiter('name,email')).toBe(',');
	});
	it('ignores delimiters inside quotes', () => {
		expect(detectDelimiter('"a;b",c')).toBe(',');
		expect(detectDelimiter('"a,b,c";d')).toBe(';');
	});
	it('falls back to comma on a tie or no delimiter', () => {
		expect(detectDelimiter('a,b;c')).toBe(',');
		expect(detectDelimiter('name')).toBe(',');
		expect(detectDelimiter('')).toBe(',');
	});
	it('ignores a BOM and looks at the first line only', () => {
		expect(detectDelimiter(`${BOM}a;b\r\nc,d,e,f`)).toBe(';');
	});
});

describe('round trip', () => {
	it('parseCsv(toCsv(rows)) with unescaped cells equals rows', () => {
		fc.assert(
			fc.property(table, (rows) => {
				const back = parseCsv(toCsv(rows)).map((r) => r.map(unescapeFormula));
				expect(back).toEqual(rows);
			}),
			{ numRuns: 500 }
		);
	});

	it('round-trips a fixed nasty table', () => {
		const rows = [
			['=HYPERLINK("http://example.com","x")', "'=already", '', 'a\r\nb'],
			['"', ',', '\r', '\n']
		];
		expect(parseCsv(toCsv(rows)).map((r) => r.map(unescapeFormula))).toEqual(rows);
	});
});
