import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { checkNumbers } from './check.js';

describe('numeric post-check properties', () => {
	test('every allowed number passes in any display formatting', () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.record({
						cents: fc.integer({ min: 100, max: 1_000_000_000 }),
						digits: fc.integer({ min: 0, max: 2 }),
						affix: fc.constantFrom('', '$', '%')
					}),
					{ minLength: 1, maxLength: 8 }
				),
				(rows) => {
					const allowed = rows.map((r) => r.cents / 100);
					const parts = rows.map((r) => {
						const n = (r.cents / 100).toLocaleString('en-US', {
							maximumFractionDigits: r.digits
						});
						return r.affix === '$' ? `$${n}` : r.affix === '%' ? `${n}%` : n;
					});
					const text = 'Values: ' + parts.join(' and ');
					expect(checkNumbers(text, allowed)).toEqual([]);
				}
			),
			{ numRuns: 500 }
		);
	});

	test('a number 1.5x an allowed integer is always flagged', () => {
		fc.assert(
			fc.property(fc.integer({ min: 100, max: 10_000_000 }), (a) => {
				const findings = checkNumbers(`${Math.round(a * 1.5)}`, [a]);
				expect(findings).toHaveLength(1);
				expect(findings[0]!.severity).toBe('block');
			}),
			{ numRuns: 500 }
		);
	});

	test('ReDoS budget: 100,000 characters of digits, commas, dots and spaces', () => {
		const alphabet = '0123456789,. ';
		let seed = 42;
		let text = '';
		for (let i = 0; i < 100_000; i++) {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			text += alphabet[seed % alphabet.length];
		}
		const commaChain = '1,'.repeat(50_000);
		const digitRun = '9'.repeat(100_000);
		const t0 = performance.now();
		checkNumbers(text, [1, 2, 3]);
		checkNumbers(commaChain, [1]);
		checkNumbers(digitRun, [1]);
		expect(performance.now() - t0).toBeLessThan(250);
	});
});
