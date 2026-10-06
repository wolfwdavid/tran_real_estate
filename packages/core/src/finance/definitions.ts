// The single source of metric wording (RESEARCH Pitfall 1). The analyzer results panel, compare
// view, memo FACTS and printout all read labels and definitions from here, so they never drift.
// Copied verbatim from 07-UI-SPEC "Copywriting Contract > Results panel". Neutral definitions only.

export type MetricKey = 'cashFlow' | 'coc' | 'capRate' | 'noi' | 'dscr' | 'grm' | 'onePct';

export const METRIC_DEFINITIONS: Record<
	MetricKey,
	{ label: string; resultsLabel: string; definition: string }
> = {
	cashFlow: {
		label: 'Monthly cash flow',
		resultsLabel: 'Monthly cash flow',
		definition: "What's left each month after operating expenses and the loan payment."
	},
	coc: {
		label: 'Cash-on-cash return',
		resultsLabel: 'Cash-on-cash return',
		definition:
			'A year of cash flow divided by the cash you put in: down payment, closing costs, and repairs.'
	},
	capRate: {
		label: 'Cap rate',
		resultsLabel: 'Cap rate',
		definition: 'A year of NOI divided by the purchase price. It leaves out financing.'
	},
	noi: {
		label: 'Net operating income (NOI)',
		resultsLabel: 'Net operating income (NOI), annual',
		definition:
			'A year of rent and other income, minus vacancy and operating expenses, before the loan payment.'
	},
	dscr: {
		label: 'Debt service coverage ratio (DSCR)',
		resultsLabel: 'Debt service coverage ratio (DSCR)',
		definition:
			"NOI divided by a year of loan payments. Below 1.00 means the income doesn't cover the loan."
	},
	grm: {
		label: 'Gross rent multiplier (GRM)',
		resultsLabel: 'Gross rent multiplier (GRM)',
		definition:
			'Purchase price divided by a year of rent. A lower number means fewer years of rent to equal the price.'
	},
	onePct: {
		label: '1% rule',
		resultsLabel: '1% rule',
		definition:
			'Monthly rent as a percent of the purchase price. The rule of thumb checks whether it reaches 1%.'
	}
};

/** The calculation conventions behind the numbers (RESEARCH "Finance Definitions"). */
export const CONVENTIONS: {
	vacancyBase: string;
	managementBase: string;
	capexInOpex: string;
	dscrFlavor: string;
	rounding: string;
} = {
	vacancyBase: 'Vacancy allowance is a percent of gross scheduled income: rent plus other income.',
	managementBase:
		'Property management is a percent of collected income: gross scheduled income minus vacancy.',
	capexInOpex: 'Capital reserves are counted in operating expenses, so they reduce NOI.',
	dscrFlavor:
		'DSCR here is NOI divided by a year of principal and interest. Some lenders use rent divided by principal, interest, taxes, insurance and HOA dues instead.',
	rounding:
		'Monthly figures are rounded to the cent. Annual figures are 12 times the monthly figure.'
};
