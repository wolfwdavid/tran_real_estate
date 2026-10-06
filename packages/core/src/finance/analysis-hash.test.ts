import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { analysisHash, canonicalJson, fnv1a32 } from './analysis-hash.js';
import { ANALYZER_VERSION } from './analyze.js';
import { dealArb } from './arbitraries.js';
import { REFERENCE_CASES } from './reference-cases.js';
import type { DealInputs, ExpenseLine } from './types.js';

const A = REFERENCE_CASES[0].inputs;

/** Rebuild an object with every key order reversed, recursively. */
function reversed(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(reversed);
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(value).reverse())
			out[k] = reversed((value as Record<string, unknown>)[k]);
		return out;
	}
	return value;
}

describe('canonicalJson', () => {
	test('sorted keys, no whitespace, arrays keep order', () => {
		expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
		expect(canonicalJson([3, 1, { z: null, y: 'x' }])).toBe('[3,1,{"y":"x","z":null}]');
		expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
	});
});

describe('fnv1a32', () => {
	test('known vectors, 8 lowercase hex chars', () => {
		expect(fnv1a32('')).toBe('811c9dc5');
		expect(fnv1a32('a')).toBe('e40c292c');
		expect(fnv1a32('foobar')).toBe('bf9cf968');
	});
});

describe('analysisHash', () => {
	test('8 lowercase hex, stable across calls and key order', () => {
		const h = analysisHash(A);
		expect(h).toMatch(/^[0-9a-f]{8}$/);
		expect(analysisHash(A)).toBe(h);
		expect(analysisHash(reversed(A) as DealInputs)).toBe(h);
	});

	test('includes the analyzer version', () => {
		expect(analysisHash(A)).toBe(fnv1a32(canonicalJson(A) + `|v${ANALYZER_VERSION}`));
		expect(ANALYZER_VERSION).toBe(1);
		expect(analysisHash(A)).toBe(fnv1a32(canonicalJson(A) + '|v1'));
	});

	test('one input change -> new hash', () => {
		const h = analysisHash(A);
		expect(analysisHash({ ...A, rentCents: A.rentCents + 1 })).not.toBe(h);
		const toggled: ExpenseLine[] = A.expenses.map((l, i) =>
			i === 0 && l.unit === 'pct'
				? { id: l.id, kind: l.kind, name: l.name, unit: 'usd', cents: l.bps }
				: l
		);
		expect(analysisHash({ ...A, expenses: toggled })).not.toBe(h);
		expect(analysisHash({ ...A, financing: { kind: 'cash' } })).not.toBe(h);
		expect(analysisHash({ ...A, closing: { unit: 'pct', bps: 300 } })).not.toBe(h);
	});

	test('property: stable under key reordering; a 1-cent rent change alters it', () => {
		fc.assert(
			fc.property(dealArb, (deal) => {
				const h = analysisHash(deal);
				expect(analysisHash(reversed(deal) as DealInputs)).toBe(h);
				expect(analysisHash({ ...deal, rentCents: deal.rentCents + 1 })).not.toBe(h);
			}),
			{ numRuns: 300 }
		);
	});
});
