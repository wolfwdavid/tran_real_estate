import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { checkFairHousing } from '../fair-housing/index.js';
import { checkNumbers } from '../numbers/index.js';
import { analyze } from './analyze.js';
import { dealArb } from './arbitraries.js';
import { buildMemoFacts, type FieldSourceFact, type MemoFactsInput } from './memo-facts.js';
import { checkAdviceLanguage } from './memo-language.js';
import { sampleMemo } from './memo-sample.js';
import { REFERENCE_CASES } from './reference-cases.js';
import type { DealInputs } from './types.js';

const ADDRESS = '100 Example Way, Harlow Springs, TX 79999';

function facts(inputs: DealInputs, extra: Partial<MemoFactsInput> = {}) {
	return buildMemoFacts({
		dealName: 'Sample duplex',
		address: ADDRESS,
		inputs,
		analysis: analyze(inputs),
		...extra
	});
}

const RENT_SOURCE: FieldSourceFact = {
	source: 'rentcast',
	asOf: Date.UTC(2026, 9, 1),
	rangeLowCents: 170_000,
	rangeHighCents: 200_000,
	comps: 8
};

describe('sampleMemo', () => {
	for (const c of REFERENCE_CASES) {
		test(`reference case ${c.id} passes every check`, () => {
			const f = facts(c.inputs);
			const memo = sampleMemo(f);
			expect(checkNumbers(memo, f.allowed)).toEqual([]);
			expect(checkFairHousing(memo)).toEqual([]);
			expect(checkAdviceLanguage(memo)).toEqual([]);
			expect(memo).toContain(ADDRESS);
			expect(memo.trimEnd()).toMatch(
				/These figures are arithmetic on the inputs above, not a forecast\.$/
			);
		});
	}

	test('sources, notes and all-cash variants also pass every check', () => {
		const a = REFERENCE_CASES[0].inputs;
		for (const f of [
			facts(a, { sources: { rent: RENT_SOURCE, price: { source: 'listing' } } }),
			facts(a, { sources: { rent: { ...RENT_SOURCE, source: 'sample', comps: 1 } } }),
			facts({ ...a, financing: { kind: 'cash' } }),
			facts(a, { propertyType: 'Single family', bedrooms: 3, bathrooms: 2.5, squareFeet: 1450 })
		]) {
			const memo = sampleMemo(f);
			expect(checkNumbers(memo, f.allowed)).toEqual([]);
			expect(checkFairHousing(memo)).toEqual([]);
			expect(checkAdviceLanguage(memo)).toEqual([]);
		}
	});

	test('rent source makes the rent "estimated" with the comparables count', () => {
		const memo = sampleMemo(facts(REFERENCE_CASES[0].inputs, { sources: { rent: RENT_SOURCE } }));
		expect(memo).toContain('estimated');
		expect(memo).toContain('based on 8 comparables');
		const plain = sampleMemo(facts(REFERENCE_CASES[0].inputs));
		expect(plain).not.toContain('estimated');
	});

	test('notes are included verbatim as the final paragraph', () => {
		const f = facts(REFERENCE_CASES[0].inputs, { notes: 'Plan to repaint for $3,500.' });
		const memo = sampleMemo(f);
		const paragraphs = memo.split('\n\n');
		expect(paragraphs.at(-1)).toBe('Your notes: Plan to repaint for $3,500.');
		expect(checkNumbers(memo, f.allowed)).toEqual([]);
		expect(sampleMemo(facts(REFERENCE_CASES[0].inputs))).not.toContain('Your notes');
	});

	test('every digit sits inside an interpolated fact string', () => {
		const f = facts(REFERENCE_CASES[0].inputs, { sources: { rent: RENT_SOURCE } });
		let rest = sampleMemo(f);
		const values = [f.factsText.split('\n')[0].slice(6), ADDRESS, ...f.lines.map((l) => l.value)];
		// Longest first so a value is never partly removed by a shorter one.
		for (const v of values.sort((x, y) => y.length - x.length)) rest = rest.split(v).join('');
		// "1% rule" is a fixed name, not a figure.
		expect(rest.replace(/1% rule/g, '')).not.toMatch(/\d/);
	});

	test('property: the sample memo passes the numeric check for random deals', () => {
		const sourceArb = fc.option(
			fc.record({
				source: fc.constantFrom('rentcast' as const, 'sample' as const, 'listing' as const),
				asOf: fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
				rangeLowCents: fc.integer({ min: 0, max: 1_000_000 }),
				rangeHighCents: fc.integer({ min: 0, max: 2_000_000 }),
				comps: fc.integer({ min: 1, max: 30 })
			}),
			{ nil: undefined }
		);
		fc.assert(
			fc.property(dealArb, sourceArb, (deal, rent) => {
				const f = facts(deal, { sources: rent ? { rent } : undefined });
				expect(checkNumbers(sampleMemo(f), f.allowed)).toEqual([]);
			}),
			{ numRuns: 300 }
		);
	});

	test('mutation guard: a changed dollar amount is blocked', () => {
		for (const c of REFERENCE_CASES) {
			const f = facts(c.inputs);
			const memo = sampleMemo(f);
			const m = /\$([\d,]+)/.exec(memo);
			expect(m, c.id).not.toBeNull();
			const n = Number(m![1].replace(/,/g, ''));
			// +$500 on a large price sits inside the 0.5% relative tolerance, so double it as well.
			const bumped = `$${(n * 2 + 500).toLocaleString('en-US')}`;
			const mutated = memo.slice(0, m!.index) + bumped + memo.slice(m!.index + m![0].length);
			const blocks = checkNumbers(mutated, f.allowed).filter((x) => x.severity === 'block');
			expect(blocks.length, c.id).toBeGreaterThanOrEqual(1);
		}
		// The plan's literal mutation, on the monthly cash flow figure ($184 -> $684).
		const f = facts(REFERENCE_CASES[0].inputs);
		const memo = sampleMemo(f).replace('$184', '$684');
		expect(checkNumbers(memo, f.allowed).some((x) => x.severity === 'block')).toBe(true);
	});
});
