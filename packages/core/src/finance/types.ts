// Deal analyzer contract (INV-01). Every amount is an integer number of cents; every percent that
// feeds money math is integer basis points. Expense amounts in dollars are monthly.

export type ExpenseKind =
	| 'vacancy'
	| 'management'
	| 'maintenance'
	| 'capex'
	| 'tax'
	| 'insurance'
	| 'hoa'
	| 'utilities'
	| 'custom';

export type ExpenseLine =
	| { id: string; kind: ExpenseKind; name: string; unit: 'pct'; bps: number | null }
	| { id: string; kind: ExpenseKind; name: string; unit: 'usd'; cents: number | null }; // monthly

export type Financing =
	| { kind: 'mortgage'; downBps: number; annualRatePct: number | null; termYears: number }
	| { kind: 'cash' };

export type ClosingCosts = { unit: 'pct'; bps: number } | { unit: 'usd'; cents: number };

export interface DealInputs {
	priceCents: number;
	closing: ClosingCosts;
	repairsCents: number;
	financing: Financing;
	rentCents: number;
	otherIncomeCents: number;
	expenses: ExpenseLine[];
}

export type NullReason =
	'no-loan' | 'no-cash-invested' | 'needs-interest-rate' | 'no-rent' | 'no-price';

export type MissingInput = 'property-tax' | 'insurance' | 'interest-rate';

export interface DealAnalysis {
	version: number;
	gsiMonthly: number;
	vacancyMonthly: number;
	egiMonthly: number;
	/** Every line incl. vacancy, in input order. */
	lines: { id: string; kind: ExpenseKind; name: string; monthlyCents: number }[];
	/** Excludes vacancy ("Operating expenses before vacancy"). */
	opexMonthly: number;
	/** vacancy + opex (fieldset footer total). */
	expensesInclVacancyMonthly: number;
	downPaymentCents: number;
	closingCents: number;
	repairsCents: number;
	loanCents: number;
	cashInvestedCents: number;
	/** null only when loan > 0 and the rate is blank. */
	paymentMonthly: number | null;
	noiMonthly: number;
	noiAnnual: number;
	cashFlowMonthly: number | null;
	cashFlowAnnual: number | null;
	capRatePct: number | null;
	cocPct: number | null;
	dscr: number | null;
	grm: number | null;
	rentToPricePct: number | null;
	meetsOnePct: boolean;
	reasons: Partial<
		Record<'payment' | 'cashFlow' | 'coc' | 'dscr' | 'grm' | 'capRate' | 'rentToPrice', NullReason>
	>;
	missing: MissingInput[];
}
