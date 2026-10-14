import { describe, expect, test } from 'vitest';

import { ALLOW_PHRASES } from './allow.js';
import { checkFairHousing } from './check.js';
import { LEXICON } from './lexicon.js';
import { compilePattern } from './pattern.js';
import { BAD_PHRASES, NEUTRAL_PHRASES, flagsRow } from './suite.js';
import type { LexiconEntry } from './types.js';

const entries = LEXICON.map((e) => [e.id, e] as const);

describe('leave-one-out', () => {
	test('there are 63 entries to prove', () => {
		expect(entries).toHaveLength(63);
	});

	test.each(entries)('entry %s is load-bearing', (_id, entry) => {
		const without = LEXICON.filter((e) => e !== entry);
		const missed = entry.examples.filter((ex) => checkFairHousing(ex, without).length === 0);
		// Removing the entry must make at least one of its own examples go unflagged.
		expect(missed.length).toBeGreaterThan(0);
	});

	test.each(entries)('examples of %s are matched by that entry only', (_id, entry) => {
		for (const ex of entry.examples) {
			const ids = [
				...new Set(checkFairHousing(ex).flatMap((f) => f.members.map((m) => m.entryId)))
			];
			expect(ids).toEqual([entry.id]);
		}
	});
});

describe('planted mutations are detected', () => {
	test('dropping all familial-status entries un-flags "No kids, please."', () => {
		const mutated = LEXICON.filter((e) => e.category !== 'familial-status');
		expect(mutated.length).toBeLessThan(LEXICON.length);
		expect(checkFairHousing('No kids, please.', mutated)).toHaveLength(0);
		expect(checkFairHousing('No kids, please.').length).toBeGreaterThanOrEqual(1);
	});

	test('downgrading soi.no-section-8 to warn fails the suite severity check', () => {
		const row = BAD_PHRASES.find((r) => r.text === 'no Section 8');
		expect(row).toBeDefined();
		if (!row) return;
		const mutated: LexiconEntry[] = LEXICON.map((e) =>
			e.id === 'soi.no-section-8' ? { ...e, severity: 'warn' } : e
		);
		expect(flagsRow(row.text, row)).toBe(true);
		expect(flagsRow(row.text, row, mutated)).toBe(false);
	});
});

/** Repeats `parts` joined by spaces until the result is at least `size` characters. */
function fill(parts: readonly string[], size: number): string {
	const unit = parts.join(' ') + ' ';
	return unit.repeat(Math.ceil(size / unit.length)).slice(0, size);
}

const ADVERSARIAL: ReadonlyArray<readonly [string, string]> = [
	['no-repeat', 'no '.repeat(17000)],
	['spaces', ' '.repeat(50000)],
	['letters', 'a'.repeat(50000)],
	['perfect-for', 'perfect for '.repeat(4200)],
	['christian', 'christian '.repeat(5000)],
	['space-hyphen', ' -'.repeat(25000)],
	['neutral-mix', fill(NEUTRAL_PHRASES, 50000)]
];

const SOURCES: ReadonlyArray<readonly [string, string]> = [
	...LEXICON.map((e) => [e.id, e.pattern] as const),
	...ALLOW_PHRASES.map((src, i) => [`allow[${i}]`, src] as const)
];

// Timing budgets are checked against the FASTEST of several runs. A ReDoS-prone pattern is slow on
// every run (backtracking is deterministic), while a preempted run under a loaded parallel test
// run is slow only once: one 2-3 ms scan measured 153 ms with 40 CPU burners running (10-23).
// The budgets themselves are unchanged.
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

describe('ReDoS budget', () => {
	test.each(SOURCES)('%s scans 50 KB of adversarial text in < 50 ms', (_id, source) => {
		for (const [name, text] of ADVERSARIAL) {
			expect(text.length, name).toBeGreaterThanOrEqual(50000);
			// Warm once so JIT compilation is not timed.
			for (const _ of text.matchAll(compilePattern(source))) void _;
			const elapsed = fastest(() => {
				for (const _ of text.matchAll(compilePattern(source))) void _;
			});
			expect(elapsed, `${name}: ${elapsed.toFixed(1)} ms (fastest of ${RUNS})`).toBeLessThan(50);
		}
	});

	test('checkFairHousing on 50 KB of mixed copy finishes in < 500 ms', () => {
		const text = fill([...NEUTRAL_PHRASES, ...BAD_PHRASES.map((r) => r.text)], 50000);
		checkFairHousing(text.slice(0, 2000));
		let findings: ReturnType<typeof checkFairHousing> = [];
		const elapsed = fastest(() => {
			findings = checkFairHousing(text);
		});
		expect(findings.length).toBeGreaterThan(0);
		expect(elapsed, `${elapsed.toFixed(1)} ms (fastest of ${RUNS})`).toBeLessThan(500);
	});
});
