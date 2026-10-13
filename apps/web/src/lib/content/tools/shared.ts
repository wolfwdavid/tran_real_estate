// Shared copy, types and field builders for the free calculator pages (/tools/ and /tools/*/),
// GTM-03. Each tool's own copy lives in its own module (./cap-rate.ts etc.), so a tool page ships
// only its own strings: the 60 KB gz tool-page budget has no room for all four (10-13).
// Every string is verbatim from 10-UI-SPEC "Copywriting Contract > Tool pages", "Per-tool inputs
// and outputs" and "OG Share Cards". Lives in $lib/content (never $lib/data) so marketing routes
// may import it, and the banned-terms gate scans it. Data only: no imports with runtime cost.
//
// The visible FAQ and the FAQPage JSON-LD both read `faq`, so they cannot drift.

import type { FieldKind } from '@tran/core/finance';
import type { OgCard } from '../og';

export type { OgCard };

import { CRUMBS, type ToolSlug } from './meta';

export * from './meta';

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

/** A /tools/ hub card (UI-SPEC "ToolCard"); the cards live in ./hub. */
export interface ToolCardContent {
	title: string;
	body: string;
	icon: 'wallet' | 'percent' | 'banknote' | 'landmark';
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
	og: OgCard;
	ogAlt: string;
	/** DSCR only. */
	notApplicable?: string;
	covers?: string;
	doesNotCover?: string;
	/** Cash-on-cash only: appended to a negative cash-flow value, e.g. "−$53 (negative)". */
	negativeSuffix?: string;
}

export const SITE_SUFFIX = ': Tran Real Estate Tools';
export const docTitle = (h1: string) => `${h1}${SITE_SUFFIX}`;
export const ogAlt = (h1: string) => `${h1}. Free calculator from Tran Real Estate Tools.`;

export const SHARED_TOOL_COPY = {
	eyebrow: 'Free calculator',
	privacy:
		'No sign-up and no API key. The math runs in your browser, and nothing you type is sent or saved.',
	crumbHome: CRUMBS.home,
	crumbTools: CRUMBS.tools,
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

export const H = SHARED_TOOL_COPY.helpers;

export const PRIVACY_FAQ: FaqItem = {
	q: 'Is anything I enter saved or sent?',
	a: 'No. The math runs in your browser. Nothing you type is sent anywhere or saved.'
};

export const INVESTOR_GO_FURTHER: ToolContent['goFurther'] = {
	heading: 'Analyze the whole deal',
	body: 'The investor portal adds financing, cash flow, DSCR, and the 1% rule, and lets you save and compare deals.',
	primary: { label: 'Open the deal analyzer', path: '/investor/analyze/' },
	sample: { label: 'Try sample data', path: '/investor/', query: '?source=sample' }
};

// Field builders: the unit suffix and adornment follow from the kind.
export const money = (
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
export const percent = (
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
export const years = (id: string, label: string, example: string): ToolField => ({
	id,
	label,
	srSuffix: ', in years',
	kind: 'years',
	required: true,
	example,
	adornment: 'years'
});

export const PRICE = money('price', 'Purchase price', '250,000', { positive: true });
export const RENT = money('monthlyRent', 'Monthly rent', '2,000');
export const VACANCY = percent('vacancyPct', 'Vacancy rate', '5', 'percent', { helper: H.vacancy });
export const OPEX = money('monthlyOpex', 'Monthly operating expenses', '600', { helper: H.opex });
export const RATE = percent('interestRatePct', 'Interest rate', '7', 'rate');
export const TERM = years('termYears', 'Loan term', '30');

export const NOI_ROW: ToolRow = { id: 'noiYearly', label: 'Net operating income (yearly)' };

/** Appended to a negative cash-flow value, e.g. "−$53 (negative)". */
export const NEGATIVE_SUFFIX = '(negative)';

/** Breadcrumb and "Other free calculators" names. */
export const TOOL_NAMES: Readonly<Record<ToolSlug, string>> = {
	affordability: 'Rent affordability',
	'cap-rate': 'Cap rate',
	'cash-on-cash': 'Cash-on-cash return',
	dscr: 'DSCR'
};
