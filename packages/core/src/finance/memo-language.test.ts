import { describe, expect, test } from 'vitest';

import { checkAdviceLanguage } from './memo-language.js';

const cases: Array<[string, string, 'block' | 'warn']> = [
	['guaranteed cash flow', 'guaranteed', 'block'],
	['We guarantee a return.', 'guarantee', 'block'],
	['risk-free', 'risk-free', 'block'],
	['risk free', 'risk free', 'block'],
	['this home will appreciate', 'will appreciate', 'block'],
	["you can't lose", "can't lose", 'block'],
	['you can’t lose', 'can’t lose', 'block'],
	['a great investment', 'great investment', 'warn'],
	['the best investment', 'best investment', 'warn'],
	['a good deal', 'good deal', 'warn'],
	['a great deal', 'great deal', 'warn'],
	['a bad deal', 'bad deal', 'warn'],
	['we recommend buying', 'we recommend', 'warn'],
	['passive income', 'passive income', 'warn'],
	['a no-brainer', 'no-brainer', 'warn'],
	['a cash cow', 'cash cow', 'warn'],
	['You should buy it', 'You should', 'warn']
];

describe('checkAdviceLanguage', () => {
	test.each(cases)('%s', (text, matched, severity) => {
		const found = checkAdviceLanguage(text);
		expect(found).toHaveLength(1);
		const [f] = found;
		expect(f.severity).toBe(severity);
		expect(f.category).toBe('advice-language');
		expect(f.text.toLowerCase()).toBe(matched.toLowerCase());
		expect(text.slice(f.start, f.end)).toBe(f.text);
	});

	test('neutral text has no findings', () => {
		expect(checkAdviceLanguage('The cap rate is 7.5%.')).toEqual([]);
		expect(checkAdviceLanguage('Cash flow is $184 a month. Capital reserves are $100.')).toEqual(
			[]
		);
		expect(checkAdviceLanguage('')).toEqual([]);
	});

	test('case-insensitive, sorted by start, wraps across whitespace', () => {
		const text = 'A NO BRAINER, and\nwe   recommend it. Guaranteed.';
		const found = checkAdviceLanguage(text);
		expect(found.map((f) => f.phrase)).toEqual(['no-brainer', 'we recommend', 'guaranteed']);
		for (let i = 1; i < found.length; i++)
			expect(found[i].start).toBeGreaterThan(found[i - 1].start);
		for (const f of found) expect(text.slice(f.start, f.end)).toBe(f.text);
	});

	test('word boundaries: no partial-word matches', () => {
		expect(checkAdviceLanguage('unguaranteedly cashcows')).toEqual([]);
	});
});
