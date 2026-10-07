// Content Studio disclosure formatting and platform post assembly (STU-01, STU-02, STU-04).
//
// Code, never the model, writes the disclosure line. One union format satisfies FL, NJ, OH,
// CA, NY, TX and the generic NAR rule:
//   {Brokerage | Team at Brokerage} . {Name}, {License type} . Lic. #{num} ({ST}) . {Brokerage phone}
// (the separator is a middle dot, U+00B7, built with String.fromCharCode to keep this source ASCII).
// The disclosure is always the last thing in an assembled post and is never truncated; an
// over-limit post reports `over > 0` so the caller can gate it instead of cutting text.
// Pure and DOM-free.

export type Platform = 'instagram' | 'facebook' | 'linkedin';

/** Fixed card order. */
export const PLATFORMS: readonly Platform[] = Object.freeze([
	'instagram',
	'facebook',
	'linkedin'
] as const);

/** Character limits, counted as UTF-16 `.length` (conservative for emoji). */
export const PLATFORM_LIMITS = { instagram: 2200, facebook: 63206, linkedin: 3000 } as const;

/** Instagram allows 5 hashtags per post (December 2025); LinkedIn and Facebook are editorial caps. */
export const HASHTAG_CAPS = { instagram: 5, facebook: 2, linkedin: 3 } as const;

export const PLATFORM_LABELS = {
	instagram: 'Instagram',
	facebook: 'Facebook',
	linkedin: 'LinkedIn'
} as const;

/** Characters held back from the prompt budget so a slightly long draft still fits. */
export const SAFETY_MARGIN = 40;

const SEP = ` ${String.fromCharCode(0xb7)} `;

export interface DisclosureProfile {
	fullName: string;
	brokerage: string;
	licenseType: string;
	licenseNumber: string;
	/** 2-letter USPS code. */
	licenseState: string;
	brokeragePhone?: string;
	teamName?: string;
	phone?: string;
	email?: string;
	website?: string;
}

export type DisclosureVariant = 'ad-inline' | 'ad-block' | 'print';

export type DisclosureField =
	'fullName' | 'brokerage' | 'licenseType' | 'licenseNumber' | 'licenseState' | 'brokeragePhone';

/** Missing-item names shown by the UI (UI-SPEC DisclosureStatus). */
export const DISCLOSURE_FIELD_LABELS: Record<DisclosureField, string> = Object.freeze({
	fullName: 'full name',
	brokerage: 'brokerage',
	licenseType: 'license type',
	licenseNumber: 'license number',
	licenseState: 'license state',
	brokeragePhone: 'brokerage phone'
});

/** States whose advertising rules require the brokerage phone (or address) in the disclosure. */
export const BROKERAGE_PHONE_STATES: readonly string[] = Object.freeze(['NY', 'NJ']);

const clean = (v: string | undefined): string => (v ?? '').trim();

const BASE_REQUIRED: readonly DisclosureField[] = [
	'fullName',
	'brokerage',
	'licenseType',
	'licenseNumber',
	'licenseState'
];

/**
 * Required fields that are empty. The rules are the same for every variant today; the
 * parameter lets callers ask per variant.
 */
export function missingFor(p: DisclosureProfile, variant: DisclosureVariant): DisclosureField[] {
	void variant;
	const required: DisclosureField[] = [...BASE_REQUIRED];
	if (BROKERAGE_PHONE_STATES.includes(clean(p.licenseState).toUpperCase()))
		required.push('brokeragePhone');
	return required.filter((f) => clean(p[f]) === '');
}

/** "{Team} at {Brokerage}" when a team name is set, else the brokerage alone. */
export function brokerageLine(p: DisclosureProfile): string {
	const team = clean(p.teamName);
	const brokerage = clean(p.brokerage);
	if (team === '') return brokerage;
	return brokerage === '' ? team : `${team} at ${brokerage}`;
}

function agentLine(p: DisclosureProfile): string {
	const name = clean(p.fullName);
	const type = clean(p.licenseType);
	return [name, type].filter(Boolean).join(', ');
}

function licenseLine(p: DisclosureProfile, prefix: string): string {
	const num = clean(p.licenseNumber);
	if (num === '') return '';
	const st = clean(p.licenseState);
	return `${prefix}${num}${st ? ` (${st})` : ''}`;
}

export interface PrintDisclosure {
	brokerageLine: string;
	agentLine: string;
	licenseLine: string;
	contactLines: string[];
}

export interface FormattedDisclosure {
	variant: DisclosureVariant;
	text: string;
	lines: string[];
	missing: DisclosureField[];
	print?: PrintDisclosure;
}

function printParts(p: DisclosureProfile): PrintDisclosure {
	const office = clean(p.brokeragePhone);
	const mobile = clean(p.phone);
	const both = office !== '' && mobile !== '';
	const contactLines = [
		office && (both ? `Office ${office}` : office),
		mobile && (both ? `Mobile ${mobile}` : mobile),
		clean(p.email),
		clean(p.website)
	].filter(Boolean);
	return {
		brokerageLine: brokerageLine(p),
		agentLine: agentLine(p),
		licenseLine: licenseLine(p, 'License #'),
		contactLines
	};
}

export function formatDisclosure(
	p: DisclosureProfile,
	variant: DisclosureVariant
): FormattedDisclosure {
	const missing = missingFor(p, variant);
	if (variant === 'print') {
		const print = printParts(p);
		const lines = [
			print.brokerageLine,
			print.agentLine,
			print.licenseLine,
			...print.contactLines
		].filter(Boolean);
		return { variant, text: lines.join('\n'), lines, missing, print };
	}
	const lines = [
		brokerageLine(p),
		agentLine(p),
		licenseLine(p, 'Lic. #'),
		clean(p.brokeragePhone)
	].filter(Boolean);
	const text = variant === 'ad-inline' ? lines.join(SEP) : lines.join('\n');
	return { variant, text, lines, missing };
}

/** Appends the disclosure after a blank line; an empty disclosure leaves the trimmed draft. */
export function appendDisclosure(draft: string, disclosure: string): string {
	const body = draft.trimEnd();
	return disclosure === '' ? body : `${body}\n\n${disclosure}`;
}

export function hashtagBlock(tags: readonly string[]): string {
	return tags.join(' ');
}

/** Characters the model may use for the post body on `platform`, floored at 0. */
export function postBudget(
	platform: Platform,
	disclosure: string,
	tags: readonly string[]
): number {
	const capped = tags.slice(0, HASHTAG_CAPS[platform]);
	const tagCost = capped.length ? hashtagBlock(capped).length + 2 : 0;
	return Math.max(0, PLATFORM_LIMITS[platform] - disclosure.length - tagCost - 2 - SAFETY_MARGIN);
}

export interface AssembledPost {
	text: string;
	length: number;
	limit: number;
	over: number;
	keptTags: string[];
	droppedTags: number;
}

/**
 * Body, then the capped hashtag block, then the disclosure, always last. Neither the body
 * nor the disclosure is ever sliced; extra tags are dropped from the tag list only.
 */
export function assemblePost(
	platform: Platform,
	body: string,
	tags: readonly string[],
	disclosure: string
): AssembledPost {
	const keptTags = tags.slice(0, HASHTAG_CAPS[platform]);
	const tagBlock = keptTags.length ? `\n\n${hashtagBlock(keptTags)}` : '';
	const text = `${body.trimEnd()}${tagBlock}\n\n${disclosure}`;
	const limit = PLATFORM_LIMITS[platform];
	return {
		text,
		length: text.length,
		limit,
		over: Math.max(0, text.length - limit),
		keptTags,
		droppedTags: Math.max(0, tags.length - keptTags.length)
	};
}
