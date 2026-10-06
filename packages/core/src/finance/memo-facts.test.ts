import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { pct, ratio, usd } from '../format/index.js';
import { extractNumerals } from '../numbers/index.js';
import { analyze } from './analyze.js';
import { dealArb } from './arbitraries.js';
import { buildMemoFacts, type MemoFactsInput } from './memo-facts.js';
import { divRoundHalfAway } from './money.js';
import { REFERENCE_CASES } from './reference-cases.js';
import type { DealInputs } from './types.js';

const ADDRESS = '100 Example Way, Harlow Springs, TX 79999';
const caseA = REFERENCE_CASES[0].inputs;

function input(inputs: DealInputs, extra: Partial<MemoFactsInput> = {}): MemoFactsInput {
	return {
		dealName: 'Sample duplex',
		address: ADDRESS,
		inputs,
		analysis: analyze(inputs),
		...extra
	};
}

const texts = (f: { lines: { label: string; value: string }[] }) =>
	f.lines.map((l) => `${l.label}: ${l.value}`);

describe('buildMemoFacts', () => {
	test('reference case A lines, in order', () => {
		const f = buildMemoFacts(input(caseA));
		const expected = [
			'Purchase price: $200,000',
			'Closing costs: $6,000',
			'Repairs before renting: $0',
			'Payment method: Mortgage',
			'Down payment: 20% ($40,000)',
			'Interest rate: 7%',
			'Loan term: 30 years',
			'Loan amount: $160,000',
			'Monthly loan payment (principal and interest): $1,064',
			'Monthly rent: $2,000',
			'Other monthly income: $0',
			'Vacancy allowance: 5% of rent ($100 a month)',
			'Property tax: $200 a month',
			'Operating expenses before vacancy: $652 a month',
			'Net operating income (NOI), annual: $14,976',
			'Monthly cash flow: $184',
			'Cash-on-cash return: 4.8%',
			'Cap rate: 7.5%',
			'Debt service coverage ratio (DSCR): 1.17',
			'Gross rent multiplier (GRM): 8.3',
			'1% rule: rent is 1.00% of the purchase price (meets the 1% rule)',
			'Total cash needed: $46,000'
		];
		const got = texts(f);
		let at = -1;
		for (const line of expected) {
			const i = got.indexOf(line);
			expect(i, line).toBeGreaterThan(at);
			at = i;
		}
		expect(got).toContain('Property management: 8% of collected rent ($152 a month)');
		expect(got).toContain('Insurance: $100 a month');
		expect(got).toContain('HOA dues: $0 a month');
	});

	test('factsText layout and no raw floats', () => {
		const f = buildMemoFacts(input(caseA));
		expect(f.factsText.startsWith(`Deal: Sample duplex\nAddress: ${ADDRESS}\n`)).toBe(true);
		expect(f.factsText).toBe(`Deal: Sample duplex\nAddress: ${ADDRESS}\n` + texts(f).join('\n'));
		for (const c of REFERENCE_CASES) {
			const facts = buildMemoFacts(input(c.inputs)).factsText;
			expect(facts, c.id).not.toMatch(/\d+\.\d{3,}/);
			expect(facts, c.id).not.toMatch(/NaN|Infinity|undefined|null|—/);
		}
	});

	test('all cash drops loan lines and words the DSCR', () => {
		const cash: DealInputs = { ...caseA, financing: { kind: 'cash' } };
		const got = texts(buildMemoFacts(input(cash)));
		expect(got).toContain('Payment method: All cash');
		for (const label of ['Down payment', 'Interest rate', 'Loan term', 'Loan amount']) {
			expect(got.some((l) => l.startsWith(`${label}:`))).toBe(false);
		}
		expect(got).toContain('Debt service coverage ratio (DSCR): not applicable (no loan)');
	});

	test('null metrics are written in words', () => {
		const noRent: DealInputs = { ...caseA, rentCents: 0 };
		const got = texts(buildMemoFacts(input(noRent)));
		expect(got).toContain('Gross rent multiplier (GRM): not applicable (no rent)');
		const noRate: DealInputs = {
			...caseA,
			financing: { kind: 'mortgage', downBps: 2000, annualRatePct: null, termYears: 30 }
		};
		const g2 = texts(buildMemoFacts(input(noRate)));
		expect(g2).toContain('Interest rate: not entered');
		expect(g2).toContain('Monthly cash flow: not available (needs an interest rate)');
		const blankTax: DealInputs = {
			...caseA,
			expenses: caseA.expenses.map((l) => (l.kind === 'tax' ? { ...l, cents: null } : l))
		};
		expect(texts(buildMemoFacts(input(blankTax)))).toContain('Property tax: not entered');
	});

	test('vacancy base reads "of rent and other income" only with other income', () => {
		const withOther: DealInputs = { ...caseA, otherIncomeCents: 10_000 };
		const got = texts(buildMemoFacts(input(withOther)));
		expect(got.some((l) => l.startsWith('Vacancy allowance: 5% of rent and other income ('))).toBe(
			true
		);
	});

	test('rent source lines', () => {
		const rent = {
			source: 'rentcast' as const,
			asOf: Date.UTC(2026, 9, 1),
			rangeLowCents: 170_000,
			rangeHighCents: 200_000,
			comps: 8
		};
		const got = texts(buildMemoFacts(input(caseA, { sources: { rent } })));
		expect(got).toContain(
			'Monthly rent source: RentCast estimate as of Oct 1, 2026, range $1,700 to $2,000, based on 8 comparables'
		);
		const sample = texts(
			buildMemoFacts(input(caseA, { sources: { rent: { ...rent, source: 'sample' } } }))
		);
		expect(sample).toContain(
			'Monthly rent source: sample data estimate, range $1,700 to $2,000, based on 8 comparables'
		);
		const listing = texts(
			buildMemoFacts(input(caseA, { sources: { rent: { source: 'listing' } } }))
		);
		expect(listing).toContain('Monthly rent source: from the for-sale listing');
		for (const sources of [undefined, { rent: { source: 'you' as const } }]) {
			const none = texts(buildMemoFacts(input(caseA, { sources })));
			expect(none.some((l) => l.startsWith('Monthly rent source'))).toBe(false);
		}
	});

	test('allowed set comes from the facts text plus the notes', () => {
		const f = buildMemoFacts(input(caseA, { notes: '  Plan to repaint for $3,500  ' }));
		expect(f.notes).toBe('Plan to repaint for $3,500');
		expect(f.allowed.some((a) => a.value === 3500 && a.source === 'your notes')).toBe(true);
		for (const v of [200_000, 184, 14_976, 4.8, 7.5, 1.17, 8.3, 46_000, 79999]) {
			expect(
				f.allowed.some((a) => a.value === v && a.source === 'analysis'),
				String(v)
			).toBe(true);
		}
		// Every numeral in FACTS is in the allowed set.
		for (const tok of extractNumerals(f.factsText)) {
			expect(f.allowed.some((a) => a.value === tok.value)).toBe(true);
		}
	});

	test('property: every FACTS numeral is allowed and no 4+ decimal floats', () => {
		fc.assert(
			fc.property(dealArb, (deal) => {
				const f = buildMemoFacts(input(deal));
				expect(f.factsText).not.toMatch(/\d+\.\d{4,}/);
				expect(f.factsText).not.toMatch(/NaN|Infinity|undefined|null/);
				const values = new Set(f.allowed.map((a) => a.value));
				for (const tok of extractNumerals(f.factsText)) expect(values.has(tok.value)).toBe(true);
			}),
			{ numRuns: 300 }
		);
	});
});

describe('format / extract round trip', () => {
	test('usd', () => {
		fc.assert(
			fc.property(fc.integer({ min: -1e10, max: 1e10 }), (c) => {
				const v = extractNumerals(usd(c))[0].value;
				const abs = divRoundHalfAway(Math.abs(c), 100);
				const want = abs === 0 ? 0 : Math.sign(c) * abs;
				expect(v === want).toBe(true);
			}),
			{ numRuns: 500 }
		);
	});

	test('pct(v, 1)', () => {
		fc.assert(
			fc.property(fc.double({ min: -100, max: 100, noNaN: true }), (v) => {
				const got = extractNumerals(pct(v, 1))[0].value;
				expect(Math.abs(got - v)).toBeLessThanOrEqual(0.05 + 1e-9);
			}),
			{ numRuns: 500 }
		);
	});

	test('ratio(v, 2)', () => {
		fc.assert(
			fc.property(fc.double({ min: -100, max: 100, noNaN: true }), (v) => {
				const got = extractNumerals(ratio(v, 2))[0].value;
				expect(Math.abs(got - v)).toBeLessThanOrEqual(0.005 + 1e-9);
			}),
			{ numRuns: 500 }
		);
	});
});
