// Copy for /tools/cap-rate/ (10-UI-SPEC "Copywriting Contract > Tool pages"). Imported only by
// that page, its calculator and the og card, so other pages never ship these strings.

import {
	H,
	INVESTOR_GO_FURTHER,
	NOI_ROW,
	OG_EYEBROW,
	OG_SUBLINE,
	OPEX,
	PRICE,
	PRIVACY_FAQ,
	RENT,
	TOOL_NAMES,
	VACANCY,
	docTitle,
	money,
	ogAlt,
	type ToolContent
} from './shared';

export const capRate: ToolContent = {
	slug: 'cap-rate',
	name: TOOL_NAMES['cap-rate'],
	h1: 'Cap rate calculator',
	docTitle: docTitle('Cap rate calculator'),
	description:
		'Free cap rate calculator. Enter price, rent, vacancy, and expenses to see net operating income and cap rate. Runs in your browser.',
	lead: "Find a rental property's cap rate from its price, rent, vacancy, and operating expenses.",
	headlineLabel: 'Cap rate',
	definition: 'Yearly net operating income divided by the purchase price.',
	emptyBody:
		'Enter a purchase price, monthly rent, vacancy rate, and monthly operating expenses to see the cap rate.',
	announce: 'Cap rate {x}%. Net operating income {y} a year.',
	fields: [
		PRICE,
		RENT,
		money('otherMonthlyIncome', 'Other monthly income (optional)', '0', {
			required: false,
			helper: H.other
		}),
		VACANCY,
		OPEX
	],
	rows: [
		NOI_ROW,
		{ id: 'egiYearly', label: 'Effective gross income (yearly)' },
		{ id: 'opexYearly', label: 'Operating expenses (yearly)' }
	],
	formula: [
		{
			term: 'Effective gross income',
			def: '(Monthly rent + other monthly income) × 12 × (1 − vacancy rate)'
		},
		{
			term: 'Net operating income',
			def: 'Effective gross income − (monthly operating expenses × 12)'
		},
		{ term: 'Cap rate', def: 'Net operating income ÷ purchase price' }
	],
	faq: [
		{
			q: 'What is a cap rate?',
			a: "Capitalization rate is a property's net operating income for one year divided by its price. It describes what the property's income would return if you paid cash, before any loan."
		},
		{
			q: 'What counts as an operating expense?',
			a: "The costs of running the property: property taxes, insurance, repairs and maintenance, property management, HOA dues, utilities the owner pays, and a reserve for big replacements. Loan payments and depreciation aren't operating expenses."
		},
		{
			q: "What's a good cap rate?",
			a: "There isn't one number. Cap rates vary with the market, the property type, its condition, and how much risk an investor accepts. Compare a property with similar ones nearby, and treat the result as one input, not a verdict."
		},
		{
			q: 'Why subtract vacancy?',
			a: 'Few rentals are occupied every month of every year. Subtracting a vacancy allowance gives a more realistic income figure.'
		},
		PRIVACY_FAQ
	],
	goFurther: INVESTOR_GO_FURTHER,
	og: {
		eyebrow: OG_EYEBROW,
		titleLines: ['Cap rate', 'calculator'],
		subline: OG_SUBLINE,
		mark: 'investor'
	},
	ogAlt: ogAlt('Cap rate calculator')
};
