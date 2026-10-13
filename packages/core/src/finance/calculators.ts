// SEO calculator math (GTM-03): cap rate, cash-on-cash and DSCR for the public tool pages.
//
// Thin compositions of the Phase 7 primitives. No formula here is new: the loan payment is
// `monthlyPayment`, vacancy is `mulBps`, and division to whole cents is `divRoundHalfAway`.
// All money is integer cents; percents are plain numbers (5 = 5%). A ratio whose denominator is
// zero is `null`, never NaN or Infinity.

import { monthlyPayment } from './amortization.js';
import { divRoundHalfAway, mulBps, roundHalfAway, type Cents } from './money.js';

const ratioOf = (num: number, den: number): number | null => (den === 0 ? null : num / den);
const pctToBps = (p: number): number => roundHalfAway(p * 100);

/** Yearly effective gross income: 12 months of income less vacancy. */
function egiYearlyOf(monthlyIncome: Cents, vacancyPct: number): Cents {
	const gross = monthlyIncome * 12;
	return gross - mulBps(gross, pctToBps(vacancyPct));
}

export interface CapRateInput {
	price: Cents;
	monthlyRent: Cents;
	otherMonthlyIncome: Cents;
	vacancyPct: number;
	monthlyOpex: Cents;
}

export interface CapRateResult {
	capRate: number | null;
	noiYearly: Cents;
	egiYearly: Cents;
	opexYearly: Cents;
}

export function capRateCalc(i: CapRateInput): CapRateResult {
	const egiYearly = egiYearlyOf(i.monthlyRent + i.otherMonthlyIncome, i.vacancyPct);
	const opexYearly = i.monthlyOpex * 12;
	const noiYearly = egiYearly - opexYearly;
	return { capRate: ratioOf(noiYearly, i.price), noiYearly, egiYearly, opexYearly };
}

export interface CashOnCashInput {
	price: Cents;
	downPaymentPct: number;
	closingCosts: Cents;
	interestRatePct: number;
	termYears: number;
	monthlyRent: Cents;
	vacancyPct: number;
	monthlyOpex: Cents;
}

export interface CashOnCashResult {
	cashOnCash: number | null;
	cashFlowYearly: Cents;
	cashFlowMonthly: Cents;
	totalCashInvested: Cents;
	monthlyPayment: Cents;
	noiYearly: Cents;
	loanAmount: Cents;
}

export function cashOnCashCalc(i: CashOnCashInput): CashOnCashResult {
	const down = mulBps(i.price, pctToBps(i.downPaymentPct));
	const loanAmount = i.price - down;
	const payment = monthlyPayment(loanAmount, i.interestRatePct, i.termYears);
	const { noiYearly } = capRateCalc({
		price: i.price,
		monthlyRent: i.monthlyRent,
		otherMonthlyIncome: 0,
		vacancyPct: i.vacancyPct,
		monthlyOpex: i.monthlyOpex
	});
	const cashFlowYearly = noiYearly - payment * 12;
	const totalCashInvested = down + i.closingCosts;
	return {
		cashOnCash: ratioOf(cashFlowYearly, totalCashInvested),
		cashFlowYearly,
		cashFlowMonthly: divRoundHalfAway(cashFlowYearly, 12),
		totalCashInvested,
		monthlyPayment: payment,
		noiYearly,
		loanAmount
	};
}

export interface DscrInput {
	monthlyRent: Cents;
	vacancyPct: number;
	monthlyOpex: Cents;
	loanAmount: Cents;
	interestRatePct: number;
	termYears: number;
}

export interface DscrResult {
	/** False for a $0 loan: there is no debt to cover, so DSCR does not apply. */
	applicable: boolean;
	dscr: number | null;
	noiYearly: Cents;
	debtServiceYearly: Cents;
	monthlyPayment: Cents;
	cashAfterDebtYearly: Cents;
}

export function dscrCalc(i: DscrInput): DscrResult {
	const applicable = i.loanAmount > 0;
	const payment = applicable ? monthlyPayment(i.loanAmount, i.interestRatePct, i.termYears) : 0;
	const debtServiceYearly = payment * 12;
	const { noiYearly } = capRateCalc({
		price: 0,
		monthlyRent: i.monthlyRent,
		otherMonthlyIncome: 0,
		vacancyPct: i.vacancyPct,
		monthlyOpex: i.monthlyOpex
	});
	return {
		applicable,
		dscr: applicable ? ratioOf(noiYearly, debtServiceYearly) : null,
		noiYearly,
		debtServiceYearly,
		monthlyPayment: payment,
		cashAfterDebtYearly: noiYearly - debtServiceYearly
	};
}
