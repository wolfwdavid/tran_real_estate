// Social post pack brief (09-UI-SPEC "Social post pack", STU-02): the form model, validation copy
// and the conversion to the studio/social.v1 prompt inputs. Pure, so the form, the studio and the
// tests share one source of truth.
//
// The form keeps plain strings (autosave stores them as is). `source` is the id of the listing
// description the agent copied into the brief, kept only so the select shows the choice again.
import type { SocialPostType } from '@tran/core/studio';
import {
	SOCIAL_POST_TYPES,
	SOCIAL_TONES,
	type SocialPackInputs,
	type SocialTone
} from '$lib/ai/prompts/studio/social.v1';

export const BRIEF_MAX = 2000;
export const CITY_MAX = 40;
export const LINK_MAX = 200;

/** The fields that make up a brief (the sample brief has exactly these). */
export interface SocialBrief {
	postType: SocialPostType;
	brief: string;
	cityOrArea: string;
	link: string;
	tone: SocialTone;
}

export interface SocialForm extends SocialBrief {
	/** Artifact id of the listing description copied into the brief, or '' for none. */
	source: string;
}

export type SocialFormKey = 'brief' | 'link';
export type SocialFormErrors = Partial<Record<SocialFormKey, string>>;

export const SOCIAL_ERRORS = {
	briefRequired: 'Write a short brief.',
	briefTooLong: 'Keep your brief under 2,000 characters.',
	link: "This link doesn't look right. Check it, like https://yourname.com."
} as const;

export function emptySocialForm(): SocialForm {
	return { postType: 'just-listed', source: '', brief: '', cityOrArea: '', link: '', tone: 'warm' };
}

/** A sample (or any) brief as a form with no listing source. */
export function briefToForm(b: Readonly<SocialBrief>): SocialForm {
	return { ...b, source: '' };
}

/** True when the form holds exactly this brief (the listing source does not matter). */
export function sameBrief(form: Readonly<SocialForm>, b: Readonly<SocialBrief>): boolean {
	return (
		form.postType === b.postType &&
		form.brief === b.brief &&
		form.cityOrArea === b.cityOrArea &&
		form.link === b.link &&
		form.tone === b.tone
	);
}

/** An http(s) link with a dotted host and no spaces. Empty is valid (the link is optional). */
export function isValidLink(raw: string): boolean {
	const s = raw.trim();
	if (s === '') return true;
	if (/\s/.test(s)) return false;
	let url: URL;
	try {
		url = new URL(s);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
	const host = url.hostname;
	return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
}

export function validateSocialForm(form: Readonly<SocialForm>): SocialFormErrors {
	const errors: SocialFormErrors = {};
	if (form.brief.trim() === '') errors.brief = SOCIAL_ERRORS.briefRequired;
	else if (form.brief.length > BRIEF_MAX) errors.brief = SOCIAL_ERRORS.briefTooLong;
	if (!isValidLink(form.link)) errors.link = SOCIAL_ERRORS.link;
	return errors;
}

/** Field order for focusing the first invalid field. */
const ORDER: readonly SocialFormKey[] = ['brief', 'link'];

export function firstInvalidKey(errors: SocialFormErrors): SocialFormKey | null {
	return ORDER.find((k) => errors[k] !== undefined) ?? null;
}

export const socialFieldId = (key: SocialFormKey | 'cityOrArea' | 'source'): string =>
	`social-${key === 'cityOrArea' ? 'city' : key}`;

/** The prompt inputs for this form. `disclosure` only shapes the budgets; it is never sent. */
export function toSocialInputs(form: Readonly<SocialForm>, disclosure: string): SocialPackInputs {
	return {
		postType: form.postType,
		brief: form.brief.trim(),
		cityOrArea: form.cityOrArea.trim(),
		link: isValidLink(form.link) ? form.link.trim() : '',
		tone: form.tone,
		disclosure
	};
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Rebuilds an autosaved form; unknown keys and malformed values fall back to the empty form. */
export function restoreSocialForm(data: unknown): SocialForm {
	const base = emptySocialForm();
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return base;
	const d = data as Record<string, unknown>;
	const postType = SOCIAL_POST_TYPES.find((t) => t === d.postType) ?? base.postType;
	const tone = SOCIAL_TONES.find((t) => t === d.tone) ?? base.tone;
	return {
		postType,
		source: str(d.source, 200),
		// The brief keeps a little more than the limit so the over-limit error can still show.
		brief: str(d.brief, BRIEF_MAX * 2),
		cityOrArea: str(d.cityOrArea, CITY_MAX),
		link: str(d.link, LINK_MAX),
		tone
	};
}

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const ELLIPSIS = String.fromCharCode(0x2026);
const MIDDOT = String.fromCharCode(0xb7);

/** "{Mon D} {middot} {first 40 characters}{ellipsis}" for a listing description in the source select. */
export function listingOptionLabel(a: { createdAt: string; text: string }): string {
	const flat = a.text.replace(/\s+/g, ' ').trim();
	const head = flat.length > 40 ? `${flat.slice(0, 40).trimEnd()}${ELLIPSIS}` : flat;
	return `${DAY.format(new Date(a.createdAt))} ${MIDDOT} ${head}`;
}
