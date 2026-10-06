// CAN-SPAM shaped email footer for follow-up drafts (AGT-06).
//
// The footer is appended locally, outside the LLM, and is never sent to the AI provider, so the
// model can never drop or rewrite it. Every exit (Copy text / Open in email app / Mark as sent)
// uses appendFooter(draft, footer.text), so the footer is always the last thing in the payload.
//
// Content, in order: name; brokerage (or "{Team} at {Brokerage}"); phone . email . website
// (present parts only); a blank line; the postal address on one line; the opt-out line; for
// contacts without prior affirmative consent the advertisement identification line
// (15 USC 7704(a)(5)(A)(i); inquiry-form consent is the exception under 7704(a)(5)(B));
// then the disclosure lines from composeDisclosure. Plain text only, never HTML.
import type { ConsentSource, PostalAddress, ProfileInput } from '../agent/types.js';
import { formatPhoneUS, normPhoneUS } from '../leads/normalize.js';
import { DISCLOSURE_SEPARATOR, composeDisclosure, missingForDrafts } from './compose.js';
import type { ProfileField } from './state-rules.js';

export const OPT_OUT_LINE = 'Reply STOP or unsubscribe to stop receiving emails from me.';
export const AD_IDENTIFICATION_LINE = 'This email is a solicitation for real estate services.';

export interface EmailFooter {
	/** lines.join('\n') */
	text: string;
	lines: string[];
	/** Same as missingForDrafts(profile): drafts are gated until this is empty. */
	missing: ProfileField[];
}

/** '12 Sample Lane, Suite 2, Harlow Springs, TX 75001' (empty parts are skipped). */
export function formatPostal(a: PostalAddress): string {
	const stateZip = [a.state.trim(), a.zip.trim()].filter((s) => s !== '').join(' ');
	return [a.street.trim(), a.line2.trim(), a.city.trim(), stateZip]
		.filter((s) => s !== '')
		.join(', ');
}

export function composeEmailFooter(
	p: ProfileInput,
	c: { consentSource: ConsentSource }
): EmailFooter {
	const brokerage = p.brokerage.trim();
	const team = p.teamName.trim();
	const phone = p.phone.trim();
	const contact = [
		phone ? formatPhoneUS(normPhoneUS(phone) ?? phone) : '',
		p.email.trim(),
		p.website.trim()
	]
		.filter((s) => s !== '')
		.join(DISCLOSURE_SEPARATOR);

	const lines = [
		p.name.trim(),
		team && brokerage ? `${team} at ${brokerage}` : brokerage || team,
		...(contact ? [contact] : []),
		'',
		formatPostal(p.postal),
		OPT_OUT_LINE,
		...(c.consentSource === 'inquiry-form' ? [] : [AD_IDENTIFICATION_LINE]),
		...composeDisclosure(p, 'email').lines
	];
	return { text: lines.join('\n'), lines, missing: missingForDrafts(p) };
}

/** The only way a draft leaves the app: body, a blank line, then the footer. */
export function appendFooter(draft: string, footerText: string): string {
	return `${draft.trimEnd()}\n\n${footerText}`;
}
