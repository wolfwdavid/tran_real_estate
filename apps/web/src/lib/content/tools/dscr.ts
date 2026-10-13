// Copy for /tools/dscr/ (10-UI-SPEC "Copywriting Contract > Tool pages"). Imported only by
// that page, its calculator and the og card, so other pages never ship these strings.

import {
	INVESTOR_GO_FURTHER,
	NOI_ROW,
	OG_EYEBROW,
	OG_SUBLINE,
	OPEX,
	PRIVACY_FAQ,
	RATE,
	RENT,
	TERM,
	TOOL_NAMES,
	VACANCY,
	docTitle,
	money,
	ogAlt,
	type ToolContent
} from './shared';

export const dscr: ToolContent = {
	slug: 'dscr',
	name: TOOL_NAMES['dscr'],
	h1: 'DSCR calculator',
	docTitle: docTitle('DSCR calculator'),
	description:
		'Free DSCR calculator. Enter rent, vacancy, expenses, and loan terms to see the debt service coverage ratio. Runs in your browser.',
	lead: "Check whether a rental property's income covers its loan payments.",
	headlineLabel: 'DSCR',
	definition:
		'Yearly net operating income divided by yearly loan payments. 1.00 means the income exactly covers the payments.',
	emptyBody: 'Enter rent, expenses, and the loan to see the DSCR.',
	announce: 'DSCR {x}. Net operating income {y} a year.',
	fields: [
		RENT,
		VACANCY,
		OPEX,
		// A loan of 0 is valid: it produces the not-applicable state.
		money('loanAmount', 'Loan amount', '187,500'),
		RATE,
		TERM
	],
	rows: [
		NOI_ROW,
		{ id: 'debtServiceYearly', label: 'Loan payments (yearly)' },
		{ id: 'monthlyPayment', label: 'Loan payment (monthly)' },
		{ id: 'cashFlowYearly', label: 'Income left after loan payments (yearly)' }
	],
	formula: [
		{
			term: 'Net operating income',
			def: '(Monthly rent × 12 × (1 − vacancy rate)) − (monthly operating expenses × 12)'
		},
		{ term: 'Yearly loan payments', def: 'Monthly principal and interest × 12' },
		{ term: 'DSCR', def: 'Net operating income ÷ yearly loan payments' }
	],
	faq: [
		{
			q: 'What is DSCR?',
			a: "Debt service coverage ratio: a property's yearly net operating income divided by its yearly loan payments, principal and interest. A DSCR of 1.00 means the income exactly covers the payments."
		},
		{
			q: 'What DSCR do lenders require?',
			a: "Each lender sets its own minimum, and it can depend on the loan program and the property. Ask the lender you're working with."
		},
		{
			q: 'Does DSCR include vacancy?',
			a: 'It should. This calculator subtracts your vacancy rate from rent before it computes net operating income. Lenders may use their own vacancy and expense assumptions.'
		},
		{
			q: "What if I'm paying cash?",
			a: "With no loan there are no loan payments, so DSCR doesn't apply."
		},
		PRIVACY_FAQ
	],
	goFurther: INVESTOR_GO_FURTHER,
	og: {
		eyebrow: OG_EYEBROW,
		titleLines: ['DSCR calculator'],
		subline: OG_SUBLINE,
		mark: 'investor'
	},
	ogAlt: ogAlt('DSCR calculator'),
	notApplicable: "There's no loan, so there are no loan payments to cover and DSCR doesn't apply.",
	covers: 'The income covers the loan payments.',
	doesNotCover: "The income doesn't cover the loan payments."
};
