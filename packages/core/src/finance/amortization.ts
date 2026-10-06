// Amortizing loan payment (INV-01).
//
// M = L·r(1+r)^n / ((1+r)^n − 1), with r = annual rate / 12 and n = years × 12.
// The result is rounded once, half away from zero, to whole cents. A 0% loan is L / n (exact integer
// division, no division by zero). Published anchors reproduced to the cent: $100,000 @ 6% / 30y =
// $599.55; $160,000 @ 7% = $1,064.48; $200,000 @ 6.5% = $1,264.14; $200,000 @ 7% = $1,330.60;
// $320,000 @ 7.5% = $2,237.49.

import { divRoundHalfAway, roundHalfAway, type Cents } from './money.js';

/** Monthly principal-and-interest payment in cents. `annualRatePct` is a percent (7.125 = 7.125%). */
export function monthlyPayment(principal: Cents, annualRatePct: number, years: number): Cents {
	if (principal === 0) return 0;
	const n = years * 12;
	if (annualRatePct === 0) return divRoundHalfAway(principal, n);
	const r = annualRatePct / 1200;
	const f = Math.pow(1 + r, n);
	return roundHalfAway((principal * r * f) / (f - 1));
}
