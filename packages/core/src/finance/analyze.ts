// The pure deal analyzer (INV-01). Every figure the analyzer, compare view, quick metrics, memo
// FACTS and printout show comes from this one function.
//
// Money: integer cents, integer adds only, mulBps for every percent (half away from zero).
// Ratios: float divisions of finished integers, computed last; an undefined ratio is null with a
// reason, never NaN or ±Infinity. Display rounding lives in @tran/core/format.
// Conventions (RESEARCH "Finance Definitions", also in definitions.ts CONVENTIONS):
//   GSI = rent + other income; vacancy is a % of GSI; EGI = GSI − vacancy
//   management is a % of EGI; maintenance, capital reserves and custom % lines are a % of rent
//   OpEx = every line except vacancy (capital reserves included); NOI = EGI − OpEx
//   cash flow = NOI − P&I; cash invested = down + closing + repairs
//   cap rate = 12·NOI ÷ price; cash-on-cash = 12·CF ÷ cash invested; DSCR = 12·NOI ÷ 12·P&I
//   GRM = price ÷ 12·rent (rent only); 1% rule passes when rent × 100 ≥ price (integer compare)

import { monthlyPayment } from './amortization.js';
import { lineMonthlyCents, type LineContext } from './expenses.js';
import { mulBps } from './money.js';
import type { DealAnalysis, DealInputs, MissingInput } from './types.js';

/** Bump when a formula or convention changes, so saved results can be recomputed. */
export const ANALYZER_VERSION = 1;

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

export function analyze(inputs: DealInputs): DealAnalysis {
	const { priceCents, rentCents, otherIncomeCents, repairsCents, financing } = inputs;
	const reasons: DealAnalysis['reasons'] = {};
	const missing: MissingInput[] = [];

	// Income and vacancy. Vacancy lines are computed first because management depends on EGI.
	const gsiMonthly = rentCents + otherIncomeCents;
	const vacancyCtx: LineContext = { rentCents, gsiCents: gsiMonthly, egiCents: gsiMonthly };
	let vacancyMonthly = 0;
	for (const line of inputs.expenses) {
		if (line.kind === 'vacancy') vacancyMonthly += lineMonthlyCents(line, vacancyCtx);
	}
	const egiMonthly = gsiMonthly - vacancyMonthly;
	const ctx: LineContext = { rentCents, gsiCents: gsiMonthly, egiCents: egiMonthly };

	const lines = inputs.expenses.map((line) => ({
		id: line.id,
		kind: line.kind,
		name: line.name,
		monthlyCents: lineMonthlyCents(line, ctx)
	}));
	let opexMonthly = 0;
	for (const line of lines) if (line.kind !== 'vacancy') opexMonthly += line.monthlyCents;

	const blank = (kind: 'tax' | 'insurance') => {
		const of = inputs.expenses.filter((l) => l.kind === kind);
		return of.length > 0 && of.every((l) => (l.unit === 'pct' ? l.bps : l.cents) === null);
	};
	if (blank('tax')) missing.push('property-tax');
	if (blank('insurance')) missing.push('insurance');

	const noiMonthly = egiMonthly - opexMonthly;
	const noiAnnual = noiMonthly * 12;

	// Purchase and financing.
	const closingCents =
		inputs.closing.unit === 'pct' ? mulBps(priceCents, inputs.closing.bps) : inputs.closing.cents;
	const downPaymentCents =
		financing.kind === 'cash' ? priceCents : mulBps(priceCents, financing.downBps);
	const loanCents = priceCents - downPaymentCents;
	const cashInvestedCents = downPaymentCents + closingCents + repairsCents;

	let paymentMonthly: number | null = 0;
	if (loanCents > 0 && financing.kind === 'mortgage') {
		if (financing.annualRatePct === null) {
			paymentMonthly = null;
			reasons.payment = 'needs-interest-rate';
			missing.push('interest-rate');
		} else {
			paymentMonthly = monthlyPayment(loanCents, financing.annualRatePct, financing.termYears);
		}
	}

	const cashFlowMonthly = paymentMonthly === null ? null : noiMonthly - paymentMonthly;
	const cashFlowAnnual = cashFlowMonthly === null ? null : cashFlowMonthly * 12;
	if (cashFlowMonthly === null) reasons.cashFlow = 'needs-interest-rate';

	// Ratios, last.
	const capRatePct = ratio(noiAnnual * 100, priceCents);
	if (capRatePct === null) reasons.capRate = 'no-price';

	let cocPct: number | null = null;
	if (cashFlowAnnual === null) reasons.coc = 'needs-interest-rate';
	else if (cashInvestedCents === 0) reasons.coc = 'no-cash-invested';
	else cocPct = ratio(cashFlowAnnual * 100, cashInvestedCents);

	let dscr: number | null = null;
	if (paymentMonthly === null) reasons.dscr = 'needs-interest-rate';
	else if (paymentMonthly === 0) reasons.dscr = 'no-loan';
	else dscr = ratio(noiAnnual, paymentMonthly * 12);

	const grm = ratio(priceCents, rentCents * 12);
	if (grm === null) reasons.grm = 'no-rent';

	const rentToPricePct = ratio(rentCents * 100, priceCents);
	if (rentToPricePct === null) reasons.rentToPrice = 'no-price';
	const meetsOnePct = priceCents > 0 && rentCents * 100 >= priceCents;

	return {
		version: ANALYZER_VERSION,
		gsiMonthly,
		vacancyMonthly,
		egiMonthly,
		lines,
		opexMonthly,
		expensesInclVacancyMonthly: vacancyMonthly + opexMonthly,
		downPaymentCents,
		closingCents,
		repairsCents,
		loanCents,
		cashInvestedCents,
		paymentMonthly,
		noiMonthly,
		noiAnnual,
		cashFlowMonthly,
		cashFlowAnnual,
		capRatePct,
		cocPct,
		dscr,
		grm,
		rentToPricePct,
		meetsOnePct,
		reasons,
		missing
	};
}
