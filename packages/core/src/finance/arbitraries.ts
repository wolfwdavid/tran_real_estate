// Shared, bounded fast-check arbitraries for finance property tests. Test-only: not exported from
// the finance barrel, because fast-check is a dev dependency.
import fc from 'fast-check';

import { MAX_CENTS } from './money.js';

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
