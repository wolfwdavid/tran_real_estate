// Disclosure composer (AGT-01). Pure and data-driven: the state rules live in state-rules.ts.
//
// Locked format (CONTEXT amendment), brokerage first:
//   {Brokerage} . {Name}, {License type} . Lic. #{num} ({ST}) . {Brokerage phone}
//   with a team: {Team} at {Brokerage} . ...
// (the separator is a middle dot, U+00B7, written as an escape to keep this source ASCII).
// Output is plain text, never HTML.
//
// Phase 9: an object second argument `{ variant }` serves the Content Studio formats
// (ad-inline / ad-block / print) by delegating to studio/disclosure-format.ts. The string
// context form is unchanged.
import type { LicenseType, ProfileInput } from '../agent/types.js';
import { formatPhoneUS, normPhoneUS } from '../leads/normalize.js';
import {
	formatDisclosure,
	type DisclosureField,
	type DisclosureProfile,
	type DisclosureVariant,
	type PrintDisclosure
} from '../studio/disclosure-format.js';
import {
	PROFILE_FIELDS,
	PROFILE_FIELD_LABELS,
	STATE_RULES,
	ruleFor,
	type DisclosureSegments,
	type ProfileField,
	type RuleId,
	type RuleTable
} from './state-rules.js';

export const DISCLOSURE_SEPARATOR = ' \u00B7 ';

/** Where the disclosure is used. Phase 9 adds ad-inline / ad-block / print variants on top. */
export type DisclosureContext = 'email' | 'web' | 'social' | 'print';

export interface DisclosureOptions {
	/** Render missing required parts as bracketed placeholders (previews only). */
	placeholders?: boolean;
	/** Rule table override (tests). */
	rules?: RuleTable;
}

export interface DisclosureResult {
	lines: string[];
	/** lines.join('\n') */
	text: string;
	missing: ProfileField[];
	warnings: string[];
	rule: RuleId;
}

const has = (v: string): boolean => v.trim() !== '';
const placeholder = (f: ProfileField): string => `[${PROFILE_FIELD_LABELS[f]}]`;

function presentFields(p: ProfileInput): Set<ProfileField> {
	const out = new Set<ProfileField>();
	if (has(p.name)) out.add('name');
	if (has(p.brokerage)) out.add('brokerage');
	if (has(p.licenseNumber)) out.add('licenseNumber');
	if (has(p.licenseState)) out.add('licenseState');
	if (p.licenseType !== '') out.add('licenseType');
	if (has(p.brokeragePhone)) out.add('brokeragePhone');
	if (has(p.email)) out.add('email');
	const { street, city, state, zip } = p.postal;
	if (has(street) && has(city) && has(state) && has(zip)) out.add('postal');
	return out;
}

const ordered = (fields: Iterable<ProfileField>): ProfileField[] => {
	const set = new Set(fields);
	return PROFILE_FIELDS.filter((f) => set.has(f));
};

/** Studio license-type labels (NY-safe titles; free-text values pass through unchanged). */
const STUDIO_LICENSE_LABELS: Readonly<Record<LicenseType, string>> = Object.freeze({
	salesperson: 'Licensed Real Estate Salesperson',
	'associate-broker': 'Licensed Associate Real Estate Broker',
	broker: 'Licensed Real Estate Broker',
	'sales-associate': 'Sales Associate'
});

const formatPhone = (raw: string): string => {
	const t = raw.trim();
	return t === '' ? '' : formatPhoneUS(normPhoneUS(t) ?? t);
};

/** Maps a Phase 8 profile onto the studio formatter's input (field names, label, phones). */
export function toDisclosureProfileCore(p: ProfileInput): DisclosureProfile {
	const type = p.licenseType as string;
	return {
		fullName: p.name.trim(),
		brokerage: p.brokerage.trim(),
		licenseType:
			type in STUDIO_LICENSE_LABELS ? STUDIO_LICENSE_LABELS[type as LicenseType] : type.trim(),
		licenseNumber: p.licenseNumber.trim(),
		licenseState: p.licenseState.trim().toUpperCase(),
		brokeragePhone: formatPhone(p.brokeragePhone),
		teamName: p.teamName.trim(),
		phone: formatPhone(p.phone),
		email: p.email.trim(),
		website: p.website.trim()
	};
}

const PHASE8_FIELD: Readonly<Record<DisclosureField, ProfileField>> = Object.freeze({
	fullName: 'name',
	brokerage: 'brokerage',
	licenseType: 'licenseType',
	licenseNumber: 'licenseNumber',
	licenseState: 'licenseState',
	brokeragePhone: 'brokeragePhone'
});

export interface StudioDisclosureRequest {
	variant: DisclosureVariant;
}

export type StudioDisclosureResult = DisclosureResult & { print?: PrintDisclosure };

export function composeDisclosure(
	p: ProfileInput,
	ctx?: DisclosureContext,
	opts?: DisclosureOptions
): DisclosureResult;
export function composeDisclosure(
	p: ProfileInput,
	req: StudioDisclosureRequest,
	opts?: DisclosureOptions
): StudioDisclosureResult;
export function composeDisclosure(
	p: ProfileInput,
	ctx: DisclosureContext | StudioDisclosureRequest = 'email',
	opts: DisclosureOptions = {}
): StudioDisclosureResult {
	if (typeof ctx === 'object') return composeStudio(p, ctx.variant, opts);
	const rule = ruleFor(p.licenseState, opts.rules ?? STATE_RULES);
	const ph = opts.placeholders === true;
	const present = presentFields(p);
	const warnings: string[] = [];

	const title = p.licenseType === '' ? null : rule.titles[p.licenseType];
	if (p.licenseType !== '' && title === null) {
		present.delete('licenseType');
		if (rule.id === 'NY') warnings.push('ny-title');
	}
	const missing = ordered(rule.required.filter((f) => !present.has(f)));
	const isMissing = (f: ProfileField): boolean => ph && missing.includes(f);
	const val = (f: ProfileField, v: string): string =>
		has(v) ? v.trim() : isMissing(f) ? placeholder(f) : '';

	const brokerage = val('brokerage', p.brokerage);
	const team = p.teamName.trim();
	const name = val('name', p.name);
	const titleText = title ?? (isMissing('licenseType') ? placeholder('licenseType') : '');
	const licNum = val('licenseNumber', p.licenseNumber);
	const st = p.licenseState.trim().toUpperCase();
	const rawPhone = p.brokeragePhone.trim();

	const segments: DisclosureSegments = {
		brokerage: team && brokerage ? `${team} at ${brokerage}` : brokerage || team,
		agent: name && titleText ? `${name}, ${titleText}` : name,
		license: licNum ? `Lic. #${licNum}` + (st ? ` (${st})` : '') : '',
		phone: rawPhone
			? formatPhoneUS(normPhoneUS(rawPhone) ?? rawPhone)
			: isMissing('brokeragePhone')
				? placeholder('brokeragePhone')
				: ''
	};

	const main = rule
		.template(segments)
		.filter((s) => s !== '')
		.join(DISCLOSURE_SEPARATOR);
	const lines = [...(main ? [main] : []), ...rule.extraLines(p)];
	return { lines, text: lines.join('\n'), missing, warnings, rule: rule.id };
}

function composeStudio(
	p: ProfileInput,
	variant: DisclosureVariant,
	opts: DisclosureOptions
): StudioDisclosureResult {
	const rule = ruleFor(p.licenseState, opts.rules ?? STATE_RULES);
	const warnings: string[] = [];
	if (p.licenseType !== '' && rule.titles[p.licenseType] === null && rule.id === 'NY')
		warnings.push('ny-title');
	const f = formatDisclosure(toDisclosureProfileCore(p), variant);
	const missing = ordered(f.missing.map((m) => PHASE8_FIELD[m]));
	return {
		lines: f.lines,
		text: f.text,
		missing,
		warnings,
		rule: rule.id,
		...(f.print ? { print: f.print } : {})
	};
}

/** Fields an agent must fill before follow-up emails can be drafted (UI-SPEC prerequisites). */
const DRAFT_FIELDS: readonly ProfileField[] = [
	'name',
	'brokerage',
	'licenseNumber',
	'licenseState',
	'postal',
	'email'
];

export function missingForDrafts(p: ProfileInput): ProfileField[] {
	const present = presentFields(p);
	return ordered([
		...composeDisclosure(p, 'email').missing,
		...DRAFT_FIELDS.filter((f) => !present.has(f))
	]);
}
