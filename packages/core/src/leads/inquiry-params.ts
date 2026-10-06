// Inquiry link parameter contract (AGT-02). The public inquiry page runs in the visitor's
// browser and has no access to the agent's data, so everything it shows comes from the URL.
// This module works on plain records and pairs (core has no URL types); the web layer wraps it
// with URLSearchParams and resolve().
//
// The Web3Forms access key (`k`) is public by design: it can only submit to the agent's own
// inbox. It is explicitly exempt from the project rule "never put keys in URLs". It is a
// profile field, never a vault secret.
//
// Every value passes through cleanText (control, bidi and zero-width characters removed).
// That is cleaning, not escaping: the page must render these values as text only.
import { US_STATES, type LicenseType } from '../agent/types.js';
import { cleanText, formatPhoneUS, normPhoneUS } from './normalize.js';

export const INQUIRY_VERSION = '1';

export const ACCESS_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TITLE_CODES: Readonly<Record<LicenseType, string>> = Object.freeze({
	salesperson: 's',
	'associate-broker': 'ab',
	broker: 'b',
	'sales-associate': 'sa'
});

const TITLE_BY_CODE: ReadonlyMap<string, LicenseType> = new Map(
	(Object.entries(TITLE_CODES) as [LicenseType, string][]).map(([type, code]) => [code, type])
);
const STATE_CODES: ReadonlySet<string> = new Set(US_STATES.map((s) => s.code));
const LICENSE_RE = /^[A-Za-z0-9 .#\-/]+$/;

const MAX_NAME = 80;
const MAX_BROKERAGE = 120;
const MAX_TEAM = 80;
const MAX_LICENSE = 30;
const MAX_PROPERTY = 120;

export interface InquiryConfig {
	key: string;
	name: string;
	brokerage: string;
	team?: string;
	title?: LicenseType;
	state?: string;
	license?: string;
	/** E.164. */
	brokeragePhone?: string;
	property?: string;
}

export type InquiryParse =
	| { status: 'valid'; config: InquiryConfig }
	| { status: 'demo' }
	| { status: 'newer-version' }
	| { status: 'incomplete'; reason: 'key' | 'name' | 'brokerage' };

type Query = Readonly<Record<string, string | undefined>>;

const clean = (q: Query, name: string): string => cleanText(q[name] ?? '');

/** Cleaned value when it is non-empty and within `max`, otherwise undefined. */
function capped(q: Query, name: string, max: number): string | undefined {
	const v = clean(q, name);
	return v.length > 0 && v.length <= max ? v : undefined;
}

export function parseInquiryParams(q: Query): InquiryParse {
	if (clean(q, 'demo') === '1') return { status: 'demo' };
	const v = clean(q, 'v');
	if (v !== '' && v !== INQUIRY_VERSION) return { status: 'newer-version' };

	const key = clean(q, 'k');
	if (!ACCESS_KEY_RE.test(key)) return { status: 'incomplete', reason: 'key' };
	const name = capped(q, 'n', MAX_NAME);
	if (name === undefined) return { status: 'incomplete', reason: 'name' };
	const brokerage = capped(q, 'b', MAX_BROKERAGE);
	if (brokerage === undefined) return { status: 'incomplete', reason: 'brokerage' };

	const config: InquiryConfig = { key, name, brokerage };

	const team = capped(q, 'tm', MAX_TEAM);
	if (team !== undefined) config.team = team;

	const title = TITLE_BY_CODE.get(clean(q, 't'));
	if (title !== undefined) config.title = title;

	const state = clean(q, 'st').toUpperCase();
	if (STATE_CODES.has(state)) config.state = state;

	const license = capped(q, 'lic', MAX_LICENSE);
	if (license !== undefined && LICENSE_RE.test(license)) config.license = license;

	const phone = normPhoneUS(clean(q, 'ph'));
	if (phone !== null) config.brokeragePhone = phone;

	const property = capped(q, 'p', MAX_PROPERTY);
	if (property !== undefined) config.property = property;

	return { status: 'valid', config };
}

/** Ordered query pairs for a share link: v, k, n, b, then tm, t, st, lic, ph, p when present. */
export function inquiryParamPairs(c: InquiryConfig): [string, string][] {
	const pairs: [string, string][] = [
		['v', INQUIRY_VERSION],
		['k', c.key],
		['n', c.name],
		['b', c.brokerage]
	];
	if (c.team !== undefined) pairs.push(['tm', c.team]);
	if (c.title !== undefined) pairs.push(['t', TITLE_CODES[c.title]]);
	if (c.state !== undefined) pairs.push(['st', c.state]);
	if (c.license !== undefined) pairs.push(['lic', c.license]);
	if (c.brokeragePhone !== undefined) pairs.push(['ph', formatPhoneUS(c.brokeragePhone)]);
	if (c.property !== undefined) pairs.push(['p', c.property]);
	return pairs;
}
