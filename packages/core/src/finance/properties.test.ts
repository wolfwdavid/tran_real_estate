// Analyzer invariants over random realistic deals (RESEARCH "Property Invariants" 1-6).
// On failure fast-check prints the seed and a shrunk counterexample.
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { analyze } from './analyze.js';
import { centsArb, dealArb, financingArb } from './arbitraries.js';
import { validateDealInputs } from './expenses.js';
import type { DealInputs, ExpenseLine } from './types.js';

const RUNS = { numRuns: 500 };

/** Every number anywhere in the value is finite (null, booleans and strings are fine). */
function allFinite(value: unknown): boolean {
	if (typeof value === 'number') return Number.isFinite(value);
	if (value === null || typeof value !== 'object') return true;
	return Object.values(value).every(allFinite);
}

/** Scales percent lines down so they total at most `cap` basis points. */
function capPercentLines(lines: ExpenseLine[], cap: number): ExpenseLine[] {
	const total = lines.reduce((s, l) => s + (l.unit === 'pct' ? (l.bps ?? 0) : 0), 0);
	if (total <= cap) return lines;
	return lines.map((l) =>
		l.unit === 'pct' ? { ...l, bps: Math.floor(((l.bps ?? 0) * cap) / total) } : l
	);
}

describe('finance invariants', () => {
	test('(0) generated deals are valid inputs', () => {
		fc.assert(
			fc.property(dealArb, (d) => {
				expect(validateDealInputs(d)).toEqual([]);
			}),
			RUNS
		);
	});

	test('(1) no NaN or Infinity anywhere in the analysis', () => {
		fc.assert(
			fc.property(dealArb, (d) => allFinite(analyze(d))),
			RUNS
		);
	});

	test('(2) accounting identities', () => {
		fc.assert(
			fc.property(dealArb, (d) => {
				const a = analyze(d);
				if (a.cashFlowMonthly !== null && a.paymentMonthly !== null) {
					expect(a.cashFlowMonthly).toBe(a.noiMonthly - a.paymentMonthly);
					expect(a.cashFlowAnnual).toBe(12 * a.cashFlowMonthly);
				}
				expect(a.noiAnnual).toBe(12 * a.noiMonthly);
				expect(a.egiMonthly).toBe(a.gsiMonthly - a.vacancyMonthly);
				expect(a.opexMonthly).toBe(
					a.lines.filter((l) => l.kind !== 'vacancy').reduce((s, l) => s + l.monthlyCents, 0)
				);
				expect(a.vacancyMonthly).toBe(
					a.lines.filter((l) => l.kind === 'vacancy').reduce((s, l) => s + l.monthlyCents, 0)
				);
				expect(a.expensesInclVacancyMonthly).toBe(a.vacancyMonthly + a.opexMonthly);
				expect(a.noiMonthly).toBe(a.egiMonthly - a.opexMonthly);
				expect(a.loanCents + a.downPaymentCents).toBe(d.priceCents);
			}),
			RUNS
		);
	});

	test('(3) financing does not change NOI or cap rate', () => {
		fc.assert(
			fc.property(dealArb, financingArb, (d, other) => {
				const a = analyze(d);
				const b = analyze({ ...d, financing: other });
				expect(b.noiMonthly).toBe(a.noiMonthly);
				expect(b.capRatePct).toBe(a.capRatePct);
			}),
			RUNS
		);
	});

	test('(4) NOI never falls when rent rises by at least $1', () => {
		fc.assert(
			fc.property(dealArb, centsArb(100, 1_000_000), (raw, step) => {
				const d: DealInputs = { ...raw, expenses: capPercentLines(raw.expenses, 6000) };
				const lower = analyze(d).noiMonthly;
				const higher = analyze({ ...d, rentCents: d.rentCents + step }).noiMonthly;
				expect(higher).toBeGreaterThanOrEqual(lower);
			}),
			RUNS
		);
	});

	test('(5) all cash: no payment, no DSCR, cash flow equals NOI', () => {
		fc.assert(
			fc.property(dealArb, (raw) => {
				const a = analyze({ ...raw, financing: { kind: 'cash' } });
				expect(a.paymentMonthly).toBe(0);
				expect(a.loanCents).toBe(0);
				expect(a.dscr).toBeNull();
				expect(a.reasons.dscr).toBe('no-loan');
				expect(a.cashFlowMonthly).toBe(a.noiMonthly);
			}),
			RUNS
		);
	});

	test('(6) the 1% rule is exact at the boundary', () => {
		fc.assert(
			fc.property(dealArb, centsArb(1, 999_999), (raw, rent) => {
				const at = analyze({ ...raw, rentCents: rent, priceCents: rent * 100 });
				expect(at.meetsOnePct).toBe(true);
				const under = analyze({ ...raw, rentCents: rent, priceCents: rent * 100 + 1 });
				expect(under.meetsOnePct).toBe(false);
			}),
			RUNS
		);
	});
});
