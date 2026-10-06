import { describe, expect, test } from 'vitest';

import { analyze } from './analyze.js';
import { REFERENCE_CASES } from './reference-cases.js';
import { validateDealInputs } from './expenses.js';

describe('reference cases (exact)', () => {
	test('there are nine cases, A to I', () => {
		expect(REFERENCE_CASES.map((c) => c.id).join('')).toBe('ABCDEFGHI');
	});

	test.each(REFERENCE_CASES)('$id. $title', ({ inputs, expected }) => {
		expect(validateDealInputs(inputs)).toEqual([]);
		const a = analyze(inputs);

		for (const [key, value] of Object.entries(expected.ints)) {
			expect(a[key as keyof typeof expected.ints], key).toBe(value);
		}
		for (const [id, cents] of Object.entries(expected.lines ?? {})) {
			expect(a.lines.find((l) => l.id === id)?.monthlyCents, `line ${id}`).toBe(cents);
		}
		for (const [key, fraction] of Object.entries(expected.ratios)) {
			const actual = a[key as keyof typeof expected.ratios];
			if (fraction === null) expect(actual, key).toBeNull();
			else expect(actual, key).toBeCloseTo(fraction.num / fraction.den, 9);
		}
		for (const [key, reason] of Object.entries(expected.reasons ?? {})) {
			expect(a.reasons[key as keyof typeof a.reasons], `reason ${key}`).toBe(reason);
		}
		expect(a.meetsOnePct).toBe(expected.meetsOnePct);
		expect(a.missing).toEqual([]);
	});
});
