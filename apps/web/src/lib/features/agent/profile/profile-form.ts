// Profile form rules (AGT-01): pure validation, website normalization and dirty tracking for the
// /agent/profile/ form. No field is required to save; missing items only gate drafts and the share
// link. Copy is the UI-SPEC "Profile" copy, verbatim.
import type { AgentProfile, ProfileInput } from '@tran/core/agent/types';
import { normEmail } from '@tran/core/leads/normalize';

/** Every input id on the form, in DOM order (focus goes to the first invalid one). */
export const FIELD_ORDER = [
	'name',
	'brokerage',
	'teamName',
	'licenseType',
	'licenseNumber',
	'licenseState',
	'brokerageLicenseNumber',
	'brokeragePhone',
	'phone',
	'email',
	'website',
	'iabsUrl',
	'street',
	'line2',
	'city',
	'postalState',
	'zip'
] as const;
export type FieldId = (typeof FIELD_ORDER)[number];

export const EMAIL_ERROR = 'This email address looks incomplete.';
export const ZIP_ERROR = 'Enter a 5-digit ZIP code, or ZIP+4.';
export const WEBSITE_ERROR =
	"This website address doesn't look right. Check it, like https://yourname.com.";
export const PHONE_ERROR = 'Enter a phone number with area code.';

const ZIP_RE = /^\d{5}(-\d{4})?$/;
const HTTP_RE = /^https?:\/\//i;
/** A URL scheme ("mailto:", "ftp:"), but not a host:port like "localhost:3000". */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

export interface ProfileValidation {
	errors: Partial<Record<FieldId, string>>;
	firstInvalid: FieldId | null;
}

/** Adds https:// to a bare host ("yourname.com"); keeps an explicit scheme; '' stays ''. */
export function normalizeWebsite(raw: string): string {
	const w = raw.trim();
	if (w === '') return '';
	if (HTTP_RE.test(w) || SCHEME_RE.test(w)) return w;
	return `https://${w}`;
}

function isWebUrl(raw: string): boolean {
	try {
		const u = new URL(normalizeWebsite(raw));
		return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
	} catch {
		return false;
	}
}

const digits = (s: string): number => s.replace(/\D/g, '').length;

export function validateProfile(p: ProfileInput): ProfileValidation {
	const errors: Partial<Record<FieldId, string>> = {};
	const filled = (s: string): boolean => s.trim() !== '';

	if (filled(p.brokeragePhone) && digits(p.brokeragePhone) < 10)
		errors.brokeragePhone = PHONE_ERROR;
	if (filled(p.phone) && digits(p.phone) < 10) errors.phone = PHONE_ERROR;
	if (filled(p.email) && normEmail(p.email) === null) errors.email = EMAIL_ERROR;
	if (filled(p.website) && !isWebUrl(p.website)) errors.website = WEBSITE_ERROR;
	if (filled(p.iabsUrl) && !isWebUrl(p.iabsUrl)) errors.iabsUrl = WEBSITE_ERROR;
	if (filled(p.postal.zip) && !ZIP_RE.test(p.postal.zip.trim())) errors.zip = ZIP_ERROR;

	const firstInvalid = FIELD_ORDER.find((f) => errors[f] !== undefined) ?? null;
	return { errors, firstInvalid };
}

/** Structural comparison of every ProfileInput field (the logo by its content). */
export function isDirty(saved: ProfileInput, current: ProfileInput): boolean {
	const keys = Object.keys(saved) as (keyof ProfileInput)[];
	for (const k of new Set([...keys, ...(Object.keys(current) as (keyof ProfileInput)[])])) {
		if (k === 'postal') {
			const a = saved.postal;
			const b = current.postal;
			if (
				a.street !== b.street ||
				a.line2 !== b.line2 ||
				a.city !== b.city ||
				a.state !== b.state ||
				a.zip !== b.zip
			)
				return true;
		} else if (k === 'logo') {
			if ((saved.logo?.base64 ?? null) !== (current.logo?.base64 ?? null)) return true;
		} else if (saved[k] !== current[k]) {
			return true;
		}
	}
	return false;
}

/** The editable fields of a saved profile as a fresh plain object (Syncable fields dropped). */
export function toProfileInput(p: AgentProfile | ProfileInput): ProfileInput {
	return {
		id: 'profile',
		name: p.name,
		brokerage: p.brokerage,
		teamName: p.teamName,
		licenseType: p.licenseType,
		licenseNumber: p.licenseNumber,
		licenseState: p.licenseState,
		brokerageLicenseNumber: p.brokerageLicenseNumber,
		brokeragePhone: p.brokeragePhone,
		phone: p.phone,
		email: p.email,
		website: p.website,
		iabsUrl: p.iabsUrl,
		postal: { ...p.postal },
		brandPrimary: p.brandPrimary,
		brandAccent: p.brandAccent,
		logo: p.logo ? { ...p.logo } : null,
		web3formsAccessKey: p.web3formsAccessKey
	};
}
