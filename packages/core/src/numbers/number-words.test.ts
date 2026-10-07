import { describe, expect, test } from 'vitest';

import { checkNumbers, extractNumerals, findNumberWords } from './index.js';
import { findNumberWords as direct } from './number-words.js';

const E_ACUTE = String.fromCharCode(0xe9);

function words(text: string): string[] {
	return findNumberWords(text).map((h) => h.word);
}

describe('numbers barrel', () => {
	test('exposes the memo extractor, matcher and the number-word detector', () => {
		expect(typeof extractNumerals).toBe('function');
		expect(typeof checkNumbers).toBe('function');
		expect(findNumberWords).toBe(direct);
	});
});

describe('findNumberWords', () => {
	test('a spelled-out quantity and a bare percent are both reported', () => {
		expect(words('Rents rose twelve percent.')).toEqual(['twelve', 'percent']);
	});

	test('percent after a numeral is fine', () => {
		expect(findNumberWords('Rents rose 12 percent.')).toEqual([]);
		expect(findNumberWords('Up 12% percent-wise')).toEqual([]);
	});

	test('one through ten as words are normal prose', () => {
		expect(findNumberWords('two bedrooms and ten minutes to the park')).toEqual([]);
		expect(findNumberWords('one, two, three, four, five, six, seven, eight, nine')).toEqual([]);
	});

	test('compound tens, scale words and dozen are reported; one is not', () => {
		expect(
			words('twenty-five homes, a hundred listings, a dozen offers, one million views')
		).toEqual(['twenty-five', 'hundred', 'dozen', 'million']);
	});

	test('twenty-five is one hit spanning the hyphen', () => {
		const hits = findNumberWords('about twenty-five homes');
		expect(hits).toHaveLength(1);
		expect(hits[0]).toEqual({ start: 6, end: 17, word: 'twenty-five' });
	});

	test('each word above ten is reported', () => {
		for (const w of [
			'eleven',
			'thirteen',
			'fourteen',
			'fifteen',
			'sixteen',
			'seventeen',
			'eighteen',
			'nineteen',
			'twenty',
			'thirty',
			'forty',
			'fifty',
			'sixty',
			'seventy',
			'eighty',
			'ninety',
			'thousand',
			'billion'
		]) {
			expect(words(`about ${w} homes`)).toEqual([w]);
		}
	});

	test('case-insensitive', () => {
		expect(words('Fifteen homes sold')).toEqual(['fifteen']);
		expect(words('TWENTY homes')).toEqual(['twenty']);
	});

	test('Unicode-boundary safe: ordinals and embedded words are not hits', () => {
		expect(findNumberWords('the Seventeenth floor')).toEqual([]);
		expect(findNumberWords('the eleventh hour')).toEqual([]);
		expect(findNumberWords(`pr${E_ACUTE}eleven`)).toEqual([]);
		expect(findNumberWords(`${E_ACUTE}twenty`)).toEqual([]);
		expect(findNumberWords(`twenty${E_ACUTE}`)).toEqual([]);
		expect(findNumberWords('percentage points')).toEqual([]);
	});

	test('scale words that belong to a digit numeral are not reported', () => {
		expect(findNumberWords('listed at $1.2 million')).toEqual([]);
		expect(findNumberWords('a 20 thousand dollar budget')).toEqual([]);
	});

	test('offsets slice back to the reported word', () => {
		const text = 'Rents rose Twelve PERCENT, with Twenty-Five homes and a Dozen offers.';
		const hits = findNumberWords(text);
		expect(hits.map((h) => h.word)).toEqual(['twelve', 'percent', 'twenty-five', 'dozen']);
		for (const hit of hits) {
			expect(text.slice(hit.start, hit.end).toLowerCase()).toBe(hit.word);
		}
	});

	test('empty text has no hits', () => {
		expect(findNumberWords('')).toEqual([]);
	});

	test('stays fast on long adversarial input', () => {
		const text = 'twenty-'.repeat(20000) + 'x ' + 'percent '.repeat(20000);
		const t0 = Date.now();
		findNumberWords(text);
		expect(Date.now() - t0).toBeLessThan(2000);
	});
});
