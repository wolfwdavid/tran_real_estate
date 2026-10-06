// Free-form lead extraction for pasted emails that carry no TRAN-LEAD block (AGT-03).
//
// At most one lead: the first email address that is not the form service's own sender, the
// first valid NANP phone number, and a name ONLY from a labelled "Name:" line or the chosen
// address's display name ("Jane Doe <jane@...>"). Names are never guessed from prose; a blank
// name is filled in by the agent in the import preview.
//
// Pasted text is untrusted and can be up to 100,000 characters, so every pattern here is linear
// or works on bounded tokens.
import { cleanText, formatPhoneUS, normalizeText, normEmail, normPhoneUS } from './normalize.js';

export interface FreeformLead {
	name: string;
	email: string;
	phone: string;
}

const MAX_NAME = 120;
const MAX_EMAIL = 254;

/** Runs of characters that can appear in an address under the email pattern below. */
const TOKEN = /[^\s<>()"',;:]+/g;
const EMAIL = /[^\s<>()"',;:]+@[^\s<>()"',;:]+\.[A-Za-z]{2,}/;
const PHONE = /(?<![\dA-Za-z@])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const NANP_E164 = /^\+1\d{10}$/;

/** The form service's sender and generic robot mailboxes are never the lead. */
const SERVICE_DOMAIN = /(?:^|\.)web3forms\.com$/i;
const ROBOT_LOCAL = /^(no-?reply|notifications?|mailer-daemon)$/i;

/** A labelled name line: "Name: Jane Doe" or "Full name: Jane Doe". */
const NAME_LINE = /^[^\S\n]*(?:full[^\S\n]+)?name[^\S\n]*:[^\S\n]*(.+)$/im;
/**
 * Everything on the line before "<address>": an optional header label ("From:", "Reply-To:")
 * and then either a quoted display name or a bare one without ":", ",", ";", "@", "<", ">" or
 * quotes. Reply attributions ("On Mon, Oct 5, ... Jane <...> wrote:") therefore never match.
 */
const DISPLAY_NAME =
	/^[^\S\n]*(?:[A-Za-z][A-Za-z-]*[^\S\n]*:[^\S\n]*)?(?:"([^"\n]{1,120})"|([^"<>@,;:\n]{1,120}))[^\S\n]*$/;

interface FoundEmail {
	email: string;
	index: number;
}

function firstEmail(t: string): FoundEmail | null {
	for (const token of t.matchAll(TOKEN)) {
		const text = token[0];
		if (text.length > MAX_EMAIL || !text.includes('@')) continue;
		const m = EMAIL.exec(text);
		if (!m) continue;
		const at = m[0].lastIndexOf('@');
		const local = m[0].slice(0, at);
		const domain = m[0].slice(at + 1);
		if (SERVICE_DOMAIN.test(domain) || ROBOT_LOCAL.test(local)) continue;
		const email = normEmail(m[0]);
		if (email !== null) return { email, index: token.index + m.index };
	}
	return null;
}

function firstPhone(t: string): string {
	for (const m of t.matchAll(PHONE)) {
		const e164 = normPhoneUS(m[0]);
		if (e164 !== null && NANP_E164.test(e164)) return formatPhoneUS(e164);
	}
	return '';
}

const usableName = (raw: string): string => {
	const name = cleanText(raw);
	return name.length <= MAX_NAME && !name.includes('@') ? name : '';
};

function labelledName(t: string): string {
	const m = NAME_LINE.exec(t);
	return m?.[1] ? usableName(m[1]) : '';
}

function displayName(t: string, found: FoundEmail | null): string {
	if (!found || t[found.index - 1] !== '<') return '';
	const lineStart = t.lastIndexOf('\n', found.index - 1) + 1;
	const before = t.slice(lineStart, found.index - 1);
	if (before.length > 300) return '';
	const m = DISPLAY_NAME.exec(before);
	return m ? usableName(m[1] ?? m[2] ?? '') : '';
}

/** Extracts at most one lead from pasted text; null when neither an email nor a phone is found. */
export function parseFreeform(text: string): FreeformLead | null {
	const t = normalizeText(text);
	const found = firstEmail(t);
	const phone = firstPhone(t);
	if (!found && phone === '') return null;
	return {
		name: labelledName(t) || displayName(t, found),
		email: found?.email ?? '',
		phone
	};
}
