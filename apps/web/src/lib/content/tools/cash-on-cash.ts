// Copy for /tools/cash-on-cash/ (10-UI-SPEC "Copywriting Contract > Tool pages"). Imported only by
// that page, its calculator and the og card, so other pages never ship these strings.

import {
	H,
	INVESTOR_GO_FURTHER,
	NEGATIVE_SUFFIX,
	NOI_ROW,
	OG_EYEBROW,
	OG_SUBLINE,
	OPEX,
	PRICE,
	PRIVACY_FAQ,
	RATE,
	RENT,
	TERM,
	TOOL_NAMES,
	VACANCY,
	docTitle,
	money,
	ogAlt,
	percent,
	type ToolContent
} from './shared';

export const cashOnCash: ToolContent = {
	slug: 'cash-on-cash',
	name: TOOL_NAMES['cash-on-cash'],
	h1: 'Cash-on-cash return calculator',
	docTitle: docTitle('Cash-on-cash return calculator'),
	description:
		'Free cash-on-cash return calculator. Enter price, down payment, loan, rent, and expenses to see yearly cash flow and return. Runs in your browser.',
	lead: 'See what the cash you put into a rental property earns in a year, after the loan payment.',
	headlineLabel: 'Cash-on-cash return',
	definition: 'Yearly cash flow divided by the total cash you invested.',
	emptyBody: 'Enter the purchase price, loan, rent, and expenses to see your cash-on-cash return.',
	announce: 'Cash-on-cash return {x}%. Cash flow {y} a year.',
	fields: [
		PRICE,
		percent('downPaymentPct', 'Down payment', '25'),
		money('closingCosts', 'Closing costs', '7,500', { helper: H.closing }),
		RATE,
		TERM,
		RENT,
		VACANCY,
		OPEX
	],
	rows: [
		{ id: 'cashFlowYearly', label: 'Cash flow (yearly)' },
		{ id: 'cashFlowMonthly', label: 'Cash flow (monthly)' },
		{ id: 'totalCashInvested', label: 'Total cash invested' },
		{ id: 'monthlyPayment', label: 'Loan payment, principal and interest (monthly)' },
		NOI_ROW
	],
	formula: [
		{
			term: 'Loan payment',
			def: 'Standard monthly principal and interest for the loan amount, rate, and term'
		},
		{ term: 'Yearly cash flow', def: 'Net operating income − (monthly loan payment × 12)' },
		{ term: 'Total cash invested', def: 'Down payment + closing costs' },
		{ term: 'Cash-on-cash return', def: 'Yearly cash flow ÷ total cash invested' }
	],
	faq: [
		{
			q: 'What is cash-on-cash return?',
			a: 'Yearly pre-tax cash flow divided by the total cash you put in: the down payment, closing costs, and any upfront repairs. It shows what your own cash earns in a year after the loan payment.'
		},
		{
			q: 'How is it different from cap rate?',
			a: 'Cap rate ignores financing. Cash-on-cash return includes your loan payment and counts only the cash you invested, so the same property can show different results with different loans.'
		},
		{
			q: 'Can the result be negative?',
			a: "Yes. If rent after vacancy doesn't cover operating expenses and the loan payment, cash flow is negative, and so is the return."
		},
		{
			q: "What doesn't it include?",
			a: "Changes in the property's price, loan paydown, taxes, and selling costs. It looks at one year of cash flow only."
		},
		PRIVACY_FAQ
	],
	goFurther: INVESTOR_GO_FURTHER,
	og: {
		eyebrow: OG_EYEBROW,
		// 10-07: "Cash-on-cash return" on one 80px line runs into the mark disc.
		titleLines: ['Cash-on-cash', 'return calculator'],
		subline: OG_SUBLINE,
		mark: 'investor'
	},
	ogAlt: ogAlt('Cash-on-cash return calculator'),
	negativeSuffix: NEGATIVE_SUFFIX
};
