// Copy for the free calculator pages (/tools/ and /tools/*/), GTM-03.
// Every string is verbatim from 10-UI-SPEC "Copywriting Contract > Tool pages", "Per-tool inputs
// and outputs" and "OG Share Cards". Lives in $lib/content (never $lib/data) so marketing routes
// may import it, and the banned-terms gate scans it. Data only: no imports with runtime cost.
//
// The visible FAQ and the FAQPage JSON-LD both read `faq`, so they cannot drift.

import type { FieldKind } from '@tran/core/finance';

export type ToolSlug = 'affordability' | 'cap-rate' | 'cash-on-cash' | 'dscr';
export const TOOL_SLUGS: readonly ToolSlug[] = [
	'affordability',
	'cap-rate',
	'cash-on-cash',
	'dscr'
];

/** Share-card content (rendered by lib/seo/og-card.server.ts; the type is defined once, here). */
export interface OgCard {
	eyebrow: string;
	titleLines: readonly string[];
	subline: string;
	mark: 'renter' | 'investor' | null;
}

export interface FaqItem {
	q: string;
	a: string;
}

export interface ToolField {
	/** Matches the @tran/core/finance calculator input key. */
	id: string;
	label: string;
	/** Visually hidden unit suffix appended to the label (accessible name). */
	srSuffix: string;
	kind: FieldKind;
	required: boolean;
	/** Zero is rejected with "Enter a purchase price above $0." */
	positive?: boolean;
	/** The "Fill in an example" value. */
	example: string;
	helper?: string;
	adornment: '$' | '%' | 'years';
}

/** A supporting result row; `id` matches the @tran/core/finance result key. */
export interface ToolRow {
	id: string;
	label: string;
}

export interface ToolContent {
	slug: ToolSlug;
	/** Breadcrumb name. */
	name: string;
	h1: string;
	docTitle: string;
	/** Meta description. */
	description: string;
	lead: string;
	headlineLabel?: string;
	definition?: string;
	emptyBody?: string;
	/** Polite announcement with `{x}` (headline) and `{y}` (money) placeholders. */
	announce?: string;
	fields: readonly ToolField[];
	rows: readonly ToolRow[];
	formula: readonly { term: string; def: string }[];
	faq: readonly FaqItem[];
	goFurther: {
		heading: string;
		body: string;
		primary: { label: string; path: '/investor/analyze/' | '/renter/' };
		/** Append `query` to the resolved path (UI-SPEC: "→ /investor/?source=sample"). */
		sample: { label: 'Try sample data'; path: '/investor/' | '/renter/'; query: '?source=sample' };
	};
	hub: { title: string; body: string; icon: 'wallet' | 'percent' | 'banknote' | 'landmark' };
	og: OgCard;
	ogAlt: string;
	/** DSCR only. */
	notApplicable?: string;
	covers?: string;
	doesNotCover?: string;
	/** Cash-on-cash only: appended to a negative cash-flow value, e.g. "−$53 (negative)". */
	negativeSuffix?: string;
}

const SITE_SUFFIX = ': Tran Real Estate Tools';
const docTitle = (h1: string) => `${h1}${SITE_SUFFIX}`;
const ogAlt = (h1: string) => `${h1}. Free calculator from Tran Real Estate Tools.`;
const OG_EYEBROW = 'FREE CALCULATOR';
const OG_SUBLINE = 'Runs in your browser. No sign-up, no API key.';

export const SHARED_TOOL_COPY = {
	eyebrow: 'Free calculator',
	privacy:
		'No sign-up and no API key. The math runs in your browser, and nothing you type is sent or saved.',
	crumbHome: 'Home',
	crumbTools: 'Tools',
	inputsHeading: 'Your numbers',
	fillExample: 'Fill in an example',
	clear: 'Clear',
	exampleNote: 'Example numbers, not market data.',
	resultsHeading: 'Your results',
	emptyTail: 'Or use Fill in an example to see how it works.',
	cleared: 'Calculator cleared.',
	disclaimerTitle: 'General guidelines, not financial advice',
	disclaimerBody:
		"This calculator does arithmetic on the numbers you enter. It can't tell you whether to rent, buy, or borrow, and it doesn't know your full situation. Check important decisions with a qualified professional.",
	howHeading: "How it's calculated",
	faqHeading: 'Questions',
	otherHeading: 'Other free calculators',
	allCalculators: 'All calculators',
	hubLink: 'Open the calculator',
	validation: {
		required: (field: string) => `Enter ${field.toLowerCase()}.`,
		nan: 'Use numbers only, like 250,000.',
		min: (m: string) => `Enter ${m} or more.`,
		max: (m: string) => `Enter ${m} or less.`,
		priceZero: 'Enter a purchase price above $0.'
	},
	helpers: {
		vacancy: 'The share of the year the unit sits empty. Use a rate that fits the local market.',
		opex: 'Taxes, insurance, repairs, management, HOA dues, and owner-paid utilities. Not the loan payment.',
		closing: 'Fees paid at purchase, plus any upfront repairs.',
		other: 'Parking, laundry, storage, or other fees. Leave at 0 if none.'
	}
} as const;

const H = SHARED_TOOL_COPY.helpers;

const PRIVACY_FAQ: FaqItem = {
	q: 'Is anything I enter saved or sent?',
	a: 'No. The math runs in your browser. Nothing you type is sent anywhere or saved.'
};

const INVESTOR_GO_FURTHER: ToolContent['goFurther'] = {
	heading: 'Analyze the whole deal',
	body: 'The investor portal adds financing, cash flow, DSCR, and the 1% rule, and lets you save and compare deals.',
	primary: { label: 'Open the deal analyzer', path: '/investor/analyze/' },
	sample: { label: 'Try sample data', path: '/investor/', query: '?source=sample' }
};

// Field builders: the unit suffix and adornment follow from the kind.
const money = (
	id: string,
	label: string,
	example: string,
	extra: Partial<ToolField> = {}
): ToolField => ({
	id,
	label,
	srSuffix: ', in dollars',
	kind: 'money',
	required: true,
	example,
	adornment: '$',
	...extra
});
const percent = (
	id: string,
	label: string,
	example: string,
	kind: 'percent' | 'rate' = 'percent',
	extra: Partial<ToolField> = {}
): ToolField => ({
	id,
	label,
	srSuffix: ', as a percent',
	kind,
	required: true,
	example,
	adornment: '%',
	...extra
});
const years = (id: string, label: string, example: string): ToolField => ({
	id,
	label,
	srSuffix: ', in years',
	kind: 'years',
	required: true,
	example,
	adornment: 'years'
});

const PRICE = money('price', 'Purchase price', '250,000', { positive: true });
const RENT = money('monthlyRent', 'Monthly rent', '2,000');
const VACANCY = percent('vacancyPct', 'Vacancy rate', '5', 'percent', { helper: H.vacancy });
const OPEX = money('monthlyOpex', 'Monthly operating expenses', '600', { helper: H.opex });
const RATE = percent('interestRatePct', 'Interest rate', '7', 'rate');
const TERM = years('termYears', 'Loan term', '30');

const NOI_ROW: ToolRow = { id: 'noiYearly', label: 'Net operating income (yearly)' };

export const TOOLS: Readonly<Record<ToolSlug, ToolContent>> = {
	affordability: {
		slug: 'affordability',
		name: 'Rent affordability',
		h1: 'Rent affordability calculator',
		docTitle: docTitle('Rent affordability calculator'),
		description:
			'Free rent affordability calculator. Enter your income and monthly debts to see a rent range that fits. Runs in your browser.',
		lead: 'See how much rent fits your income and monthly debts, using common rules of thumb.',
		// Inputs, result, empty state and announcement belong to the Phase 6 component (UI-SPEC [C6]).
		fields: [],
		rows: [],
		// Copied from packages/core/src/renter/affordability.ts (affordability, landlordIncome,
		// moveInCash), which the embedded component calls. Change both together.
		formula: [
			{ term: 'Monthly income', def: 'Your gross monthly income, or your yearly income ÷ 12' },
			{ term: 'Low end of the range', def: '25% of monthly income, rounded to the nearest $25' },
			{
				term: 'Top of the range',
				def: 'The smaller of 30% of monthly income and (40% of monthly income − monthly debts), rounded to the nearest $25'
			},
			{ term: 'Income landlords look for', def: 'About 40 × the monthly rent, per year' },
			{
				term: 'Move-in cash',
				def: 'About 2 × the monthly rent: the first month plus a one-month deposit'
			}
		],
		faq: [
			{
				q: 'What is the 30% rule?',
				a: "A common guideline is to spend no more than about 30% of your gross monthly income, before taxes, on rent. It's a starting point, not a rule landlords must follow."
			},
			{
				q: 'Do landlords have income requirements?',
				a: 'Many do, often asking for monthly income of about three times the rent. Requirements vary, so check each listing.'
			},
			{
				q: 'Why count monthly debts?',
				a: 'Car loans, student loans, and card minimums come out of the same income. Counting them shows how much room is left for rent.'
			},
			{
				q: 'What about move-in costs?',
				a: "Many rentals ask for a security deposit and the first month's rent up front, and some charge application fees. Keep that in mind when you compare your savings with a rent."
			},
			PRIVACY_FAQ
		],
		goFurther: {
			heading: 'Find rentals that fit',
			body: "The renter portal searches rentals in any US city or ZIP code and shows what's new each time you come back.",
			primary: { label: 'Open the renter portal', path: '/renter/' },
			sample: { label: 'Try sample data', path: '/renter/', query: '?source=sample' }
		},
		hub: {
			title: 'Rent affordability',
			body: 'See how much rent fits your income and monthly debts.',
			icon: 'wallet'
		},
		og: {
			eyebrow: OG_EYEBROW,
			titleLines: ['Rent affordability', 'calculator'],
			subline: OG_SUBLINE,
			mark: 'renter'
		},
		ogAlt: ogAlt('Rent affordability calculator')
	},
	'cap-rate': {
		slug: 'cap-rate',
		name: 'Cap rate',
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
		hub: {
			title: 'Cap rate',
			body: "Net operating income as a share of a property's price.",
			icon: 'percent'
		},
		og: {
			eyebrow: OG_EYEBROW,
			titleLines: ['Cap rate', 'calculator'],
			subline: OG_SUBLINE,
			mark: 'investor'
		},
		ogAlt: ogAlt('Cap rate calculator')
	},
	'cash-on-cash': {
		slug: 'cash-on-cash',
		name: 'Cash-on-cash return',
		h1: 'Cash-on-cash return calculator',
		docTitle: docTitle('Cash-on-cash return calculator'),
		description:
			'Free cash-on-cash return calculator. Enter price, down payment, loan, rent, and expenses to see yearly cash flow and return. Runs in your browser.',
		lead: 'See what the cash you put into a rental property earns in a year, after the loan payment.',
		headlineLabel: 'Cash-on-cash return',
		definition: 'Yearly cash flow divided by the total cash you invested.',
		emptyBody:
			'Enter the purchase price, loan, rent, and expenses to see your cash-on-cash return.',
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
		hub: {
			title: 'Cash-on-cash return',
			body: 'What the cash you put into a rental earns in a year.',
			icon: 'banknote'
		},
		og: {
			eyebrow: OG_EYEBROW,
			// 10-07: "Cash-on-cash return" on one 80px line runs into the mark disc.
			titleLines: ['Cash-on-cash', 'return calculator'],
			subline: OG_SUBLINE,
			mark: 'investor'
		},
		ogAlt: ogAlt('Cash-on-cash return calculator'),
		negativeSuffix: '(negative)'
	},
	dscr: {
		slug: 'dscr',
		name: 'DSCR',
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
		hub: {
			title: 'DSCR',
			body: "Whether a property's income covers its loan payments.",
			icon: 'landmark'
		},
		og: {
			eyebrow: OG_EYEBROW,
			titleLines: ['DSCR calculator'],
			subline: OG_SUBLINE,
			mark: 'investor'
		},
		ogAlt: ogAlt('DSCR calculator'),
		notApplicable:
			"There's no loan, so there are no loan payments to cover and DSCR doesn't apply.",
		covers: 'The income covers the loan payments.',
		doesNotCover: "The income doesn't cover the loan payments."
	}
};

export const TOOLS_HUB = {
	h1: 'Free real estate calculators',
	docTitle: 'Free real estate calculators: Tran Real Estate Tools',
	description:
		'Free rent affordability, cap rate, cash-on-cash return, and DSCR calculators. They run in your browser with no sign-up.',
	lead: 'Quick math for renters and investors. No sign-up, no API key, and nothing leaves your browser.',
	og: {
		eyebrow: OG_EYEBROW,
		titleLines: ['Free real estate', 'calculators'],
		subline: OG_SUBLINE,
		mark: 'investor'
	},
	ogAlt: 'Free real estate calculators. Free calculator from Tran Real Estate Tools.'
} as const satisfies {
	h1: string;
	docTitle: string;
	description: string;
	lead: string;
	og: OgCard;
	ogAlt: string;
};

export const DEFAULT_OG: OgCard = {
	eyebrow: 'FOR RENTERS, INVESTORS, AND AGENTS',
	titleLines: ['Real estate tools that', 'do the refreshing for you'],
	subline: 'Listing data from RentCast. Your own API keys. No Tran server.',
	mark: null
};

export const DEFAULT_OG_ALT =
	'Tran Real Estate Tools: real estate tools for renters, investors, and agents.';
