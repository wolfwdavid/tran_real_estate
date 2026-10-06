// State advertising disclosure rules for the agent disclosure composer (AGT-01).
//
// Engineering defaults, not legal advice; counsel review is flagged before the public GTM push.
//
// Sources and per-state rules come from 08-RESEARCH "State Disclosure Table" and 09-RESEARCH
// section A. Every rule cites its source. States without an entry use GENERIC_RULE.
// Phase 9 extends the output with ad-inline / ad-block / print variants; the rule data stays here.
import type { LicenseType, ProfileInput } from '../agent/types.js';

export type RuleId = 'FL' | 'NJ' | 'OH' | 'CA' | 'NY' | 'TX' | 'generic';
export type StateRuleId = Exclude<RuleId, 'generic'>;

export type ProfileField =
	| 'name'
	| 'brokerage'
	| 'licenseNumber'
	| 'licenseState'
	| 'licenseType'
	| 'brokeragePhone'
	| 'postal'
	| 'email';

/** Canonical order used for every missing-field list. */
export const PROFILE_FIELDS: readonly ProfileField[] = Object.freeze([
	'name',
	'brokerage',
	'licenseType',
	'licenseNumber',
	'licenseState',
	'brokeragePhone',
	'postal',
	'email'
] as const);

export const PROFILE_FIELD_LABELS: Readonly<Record<ProfileField, string>> = Object.freeze({
	name: 'Full name',
	brokerage: 'Brokerage',
	licenseNumber: 'License number',
	licenseState: 'License state',
	licenseType: 'License type',
	brokeragePhone: 'Brokerage phone',
	postal: 'Mailing address',
	email: 'Email'
});

/** The rendered segments of the main disclosure line; empty strings are dropped by the composer. */
export interface DisclosureSegments {
	/** '{Brokerage}' or '{Team} at {Brokerage}'. */
	brokerage: string;
	/** '{Name}' or '{Name}, {Title}'. */
	agent: string;
	/** 'Lic. #{num} ({ST})'. */
	license: string;
	/** Formatted brokerage phone. */
	phone: string;
}

/** Brokerage first, as locked by the CONTEXT amendment. */
export const BASE_TEMPLATE = (s: DisclosureSegments): string[] => [
	s.brokerage,
	s.agent,
	s.license,
	s.phone
];

export interface StateRule {
	id: RuleId;
	stateName: string;
	/** Fields that must be present; every rule includes name and brokerage. */
	required: ProfileField[];
	/** Title per license type; null means the title is not allowed in this state. */
	titles: Record<LicenseType, string | null>;
	/** Order of the main-line segments. */
	template: (s: DisclosureSegments) => string[];
	/** Additional lines after the main line. */
	extraLines(p: ProfileInput): string[];
	source: string;
}

export type RuleTable = Readonly<Record<StateRuleId, StateRule>>;

const GENERIC_TITLES: Record<LicenseType, string | null> = Object.freeze({
	salesperson: 'Real Estate Salesperson',
	'associate-broker': 'Associate Broker',
	broker: 'Real Estate Broker',
	'sales-associate': 'Sales Associate'
});

const BASE_REQUIRED: ProfileField[] = ['name', 'brokerage'];
const noExtra = (): string[] => [];
const has = (v: string): boolean => v.trim() !== '';

export const GENERIC_RULE: StateRule = Object.freeze({
	id: 'generic',
	stateName: '',
	required: BASE_REQUIRED,
	titles: GENERIC_TITLES,
	template: BASE_TEMPLATE,
	extraLines: noExtra,
	source: 'NAR Code of Ethics Art. 12, SOP 12-5'
});

export const TX_CPN_URL = 'https://www.trec.texas.gov/forms/consumer-protection-notice';

export const STATE_RULES: RuleTable = Object.freeze({
	FL: {
		id: 'FL',
		stateName: 'Florida',
		required: BASE_REQUIRED,
		titles: {
			salesperson: 'Sales Associate',
			'associate-broker': 'Broker Associate',
			broker: 'Broker',
			'sales-associate': 'Sales Associate'
		},
		template: BASE_TEMPLATE,
		extraLines: noExtra,
		source: 'Fla. Admin. Code 61J2-10.025; F.S. 475.2755'
	},
	NJ: {
		id: 'NJ',
		stateName: 'New Jersey',
		required: [...BASE_REQUIRED, 'brokeragePhone'],
		titles: {
			salesperson: 'Real Estate Salesperson',
			'associate-broker': 'Broker-Salesperson',
			broker: 'Real Estate Broker',
			'sales-associate': 'Sales Associate'
		},
		template: BASE_TEMPLATE,
		extraLines: noExtra,
		source: 'N.J.A.C. 11:5-6.1'
	},
	OH: {
		id: 'OH',
		stateName: 'Ohio',
		required: BASE_REQUIRED,
		titles: GENERIC_TITLES,
		template: BASE_TEMPLATE,
		extraLines: noExtra,
		source: 'Ohio Adm. Code 1301:5-1-02'
	},
	CA: {
		id: 'CA',
		stateName: 'California',
		required: [...BASE_REQUIRED, 'licenseNumber'],
		titles: GENERIC_TITLES,
		template: BASE_TEMPLATE,
		extraLines: (p: ProfileInput): string[] =>
			has(p.brokerageLicenseNumber) && has(p.brokerage)
				? [`${p.brokerage.trim()} Lic. #${p.brokerageLicenseNumber.trim()} (CA)`]
				: [],
		source: 'Cal. B&P 10140.6, 10159.7; 10 CCR 2773'
	},
	NY: {
		id: 'NY',
		stateName: 'New York',
		required: [...BASE_REQUIRED, 'brokeragePhone', 'licenseType'],
		// The bare titles "sales associate" and "broker" are not allowed for licensees.
		titles: {
			salesperson: 'Licensed Real Estate Salesperson',
			'associate-broker': 'Licensed Associate Real Estate Broker',
			broker: 'Licensed Real Estate Broker',
			'sales-associate': null
		},
		template: BASE_TEMPLATE,
		extraLines: noExtra,
		source: '19 NYCRR 175.25'
	},
	TX: {
		id: 'TX',
		stateName: 'Texas',
		required: BASE_REQUIRED,
		titles: GENERIC_TITLES,
		template: BASE_TEMPLATE,
		extraLines: (p: ProfileInput): string[] => [
			...(has(p.iabsUrl) ? [`Information About Brokerage Services: ${p.iabsUrl.trim()}`] : []),
			`Texas Real Estate Commission Consumer Protection Notice: ${TX_CPN_URL}`
		],
		source: '22 TAC 535.154-535.155; TREC IABS/CPN rules'
	}
});

/** The rule for a two-letter state code (case-insensitive), or GENERIC_RULE. */
export function ruleFor(state: string, rules: RuleTable = STATE_RULES): StateRule {
	const key = state.trim().toUpperCase();
	return Object.hasOwn(rules, key) ? rules[key as StateRuleId] : GENERIC_RULE;
}
