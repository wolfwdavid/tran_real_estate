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

	// Timing budget against the FASTEST of several runs: ReDoS backtracking is slow on every run, a
	// preempted run under a loaded parallel test run is slow once (a 2-3 ms fair-housing scan measured
	// 153 ms with 40 CPU burners running, 10-23). The budget itself is unchanged.
	const RUNS = 5;
	function fastest(fn: () => void): number {
		let best = Infinity;
		for (let i = 0; i < RUNS; i++) {
			const started = performance.now();
			fn();
			best = Math.min(best, performance.now() - started);
		}
		return best;
	}

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
		const elapsed = fastest(() => {
			checkNumbers(text, [1, 2, 3]);
			checkNumbers(commaChain, [1]);
			checkNumbers(digitRun, [1]);
		});
		expect(elapsed, `${elapsed.toFixed(1)} ms (fastest of ${RUNS})`).toBeLessThan(250);
	});
});
