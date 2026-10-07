import { describe, expect, test } from 'vitest';

import { assertSafePattern, compilePattern, p } from './pattern.js';
import { CATEGORY_LABELS, STATE_SCOPE_NOTE } from './types.js';

const matches = (source: string, text: string): boolean => compilePattern(source).test(text);

describe('p`` authoring helper', () => {
	test.each(['able bodied', 'able-bodied', 'able\u00A0bodied', 'able  bodied'])(
		'able bodied matches %j',
		(text) => {
			expect(matches(p`able bodied`, text)).toBe(true);
		}
	);

	test('hyphenated and capitalized variants match', () => {
		expect(matches(p`mother in law suite`, 'mother-in-law suite')).toBe(true);
		expect(matches(p`mother in law suite`, 'Mother in law suite')).toBe(true);
	});

	test('apostrophe matches straight and curly forms', () => {
		expect(matches(p`no one's`, "no one's")).toBe(true);
		expect(matches(p`no one's`, 'no one’s')).toBe(true);
	});

	test('spaces inside a non-capturing group are made tolerant too', () => {
		expect(matches(p`christian (?:home|family home)`, 'Christian family-home')).toBe(true);
		expect(matches(p`christian (?:home|family home)`, 'Christian home')).toBe(true);
	});

	test('rejects a space or hyphen authored inside a character class', () => {
		expect(() => p`no[ -]kids`).toThrow(/Unsafe lexicon pattern/);
		expect(() => p`no[a-z]kids`).toThrow(/Unsafe lexicon pattern/);
	});

	test('rejects a nested quantifier at authoring time', () => {
		expect(() => p`(?:no+)+`).toThrow(/Unsafe lexicon pattern/);
	});
});

describe('compilePattern', () => {
	test('Unicode-aware word boundaries', () => {
		const source = p`christian`;
		expect(matches(source, 'Christiansen Avenue')).toBe(false);
		expect(matches(source, 'Christian.')).toBe(true);
		expect(matches(source, 'café christian')).toBe(true);
		expect(matches(source, 'xchristian')).toBe(false);
		expect(matches(source, 'christianá')).toBe(false);
		expect(matches(source, '7christian')).toBe(false);
	});

	test("flags are exactly 'giu'", () => {
		expect(compilePattern(p`no kids`).flags).toBe('giu');
	});

	test('returns a fresh RegExp each call so lastIndex is never shared', () => {
		const a = compilePattern(p`no kids`);
		const b = compilePattern(p`no kids`);
		expect(a).not.toBe(b);
		a.exec('no kids no kids');
		expect(a.lastIndex).toBeGreaterThan(0);
		expect(b.lastIndex).toBe(0);
	});
});

describe('assertSafePattern (ReDoS guard)', () => {
	test.each([
		'(?:a+)+',
		'(?:\\w+ )*',
		'(?:x{2,})+',
		'(?:(?:ab)+)+',
		'(?:a*)+?',
		'(a+)*',
		'(?:a+){2}'
	])('rejects %j', (source) => {
		expect(() => assertSafePattern(source)).toThrow('Unsafe lexicon pattern: ' + source);
	});

	test.each([
		'(?:no|not)+',
		'(?:[\\s\\u00A0-]+the)?',
		'no[\\s\\u00A0-]+kids',
		'(?:[+*]x)+',
		'(?:\\+)+',
		'\\p{L}+',
		'(?:x{2,5})+'
	])('accepts %j', (source) => {
		expect(() => assertSafePattern(source)).not.toThrow();
	});
});

describe('types', () => {
	test('CATEGORY_LABELS has the 11 UI-SPEC labels plus the Phase 9 advertising label', () => {
		expect(Object.keys(CATEGORY_LABELS)).toHaveLength(12);
		expect(Object.values(CATEGORY_LABELS)).toEqual([
			'Race',
			'Color',
			'Religion',
			'Sex',
			'Familial status',
			'National origin',
			'Disability',
			'Source of income',
			'Age',
			'Marital status',
			'Sexual orientation or gender identity',
			'Advertising claim'
		]);
	});

	test('STATE_SCOPE_NOTE copy', () => {
		expect(STATE_SCOPE_NOTE).toBe('Protected under many state and local laws.');
	});
});
