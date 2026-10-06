// Shared, bounded fast-check arbitraries for finance property tests. Test-only: not exported from
// the finance barrel, because fast-check is a dev dependency.
import fc from 'fast-check';

import { defaultExpenseLines } from './defaults.js';
import { MAX_CENTS } from './money.js';
import type { ClosingCosts, DealInputs, ExpenseLine, Financing } from './types.js';

/** Integer cents in [min, max]. */
export const centsArb = (min = 0, max = MAX_CENTS): fc.Arbitrary<number> =>
	fc.integer({ min, max });

/** Integer basis points in [0, max]. */
export const bpsArb = (max = 10000): fc.Arbitrary<number> => fc.integer({ min: 0, max });

/** Annual rate in percent, 0..15 with at most 3 decimals (integer thousandths / 1000). */
export const rateArb: fc.Arbitrary<number> = fc
	.integer({ min: 0, max: 15000 })
	.map((thousandths) => thousandths / 1000);

/** Loan term in whole years, 1..40. */
export const termArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 40 });

/** Financing: all cash, or a mortgage with any down payment, a rate (or blank) and a term. */
export const financingArb: fc.Arbitrary<Financing> = fc.oneof(
	fc.constant<Financing>({ kind: 'cash' }),
	fc.record({
		kind: fc.constant('mortgage' as const),
		downBps: bpsArb(),
		annualRatePct: fc.option(rateArb, { nil: null, freq: 8 }),
		termYears: termArb
	})
);

/** A user-added line: percent of rent or monthly dollars. */
const customLineArb = (i: number): fc.Arbitrary<ExpenseLine> =>
	fc.oneof(
		bpsArb(2000).map((bps): ExpenseLine => ({
			id: `custom-${i}`,
			kind: 'custom',
			name: 'Other',
			unit: 'pct',
			bps
		})),
		centsArb(0, 500_000).map((cents): ExpenseLine => ({
			id: `custom-${i}`,
			kind: 'custom',
			name: 'Other',
			unit: 'usd',
			cents
		}))
	);

/** The eight default lines with random amounts (dollar lines sometimes blank), plus 0-3 custom lines. */
export const expenseLinesArb: fc.Arbitrary<ExpenseLine[]> = fc
	.tuple(
		fc.array(bpsArb(2000), { minLength: 4, maxLength: 4 }),
		fc.array(fc.option(centsArb(0, 500_000), { nil: null, freq: 5 }), {
			minLength: 4,
			maxLength: 4
		}),
		fc
			.integer({ min: 0, max: 3 })
			.chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => customLineArb(i))))
	)
	.map(([pct, usd, custom]) => {
		let p = 0;
		let u = 0;
		const lines = defaultExpenseLines().map((line): ExpenseLine =>
			line.unit === 'pct' ? { ...line, bps: pct[p++] } : { ...line, cents: usd[u++] }
		);
		return [...lines, ...custom];
	});

/**
 * A realistic, valid deal: price $0.01..$1,000,000, rent up to 2% of price, other income up to
 * $1,000 a month, closing as % or $, repairs up to $50,000.
 */
export const dealArb: fc.Arbitrary<DealInputs> = centsArb(1, MAX_CENTS / 100).chain((priceCents) =>
	fc.record({
		priceCents: fc.constant(priceCents),
		closing: fc.oneof(
			bpsArb(600).map((bps): ClosingCosts => ({ unit: 'pct', bps })),
			centsArb(0, 2_000_000).map((cents): ClosingCosts => ({ unit: 'usd', cents }))
		),
		repairsCents: centsArb(0, 5_000_000),
		financing: financingArb,
		rentCents: centsArb(0, Math.floor(priceCents / 50)),
		otherIncomeCents: centsArb(0, 100_000),
		expenses: expenseLinesArb
	})
);
