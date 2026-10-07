// Profile -> inquiry share link (AGT-02, plan 08-24). Pure helpers for the ShareLinkBuilder: which
// profile fields block the link, and the InquiryConfig the public page reads from the URL.
//
// Only these profile fields ever reach the link: the Web3Forms access key (public by design),
// name, brokerage, team, license type, license state, license number and the brokerage phone, plus
// an optional property typed into the builder. Email, personal phone, postal address, website,
// IABS link, logo and brand colors are never mapped here, so buildInquiryUrl cannot carry them.
// The home page's inquiryConfigFor (setup-checklist.ts) uses the same mapping without the property.
import type { ProfileInput } from '@tran/core/agent/types';
import { ACCESS_KEY_RE, type InquiryConfig } from '@tran/core/leads/inquiry-params';
import { normPhoneUS } from '@tran/core/leads/normalize';

export type ShareLinkBlocker = 'name' | 'brokerage' | 'key';

/** The public page refuses longer values (inquiry-params MAX_PROPERTY). */
export const MAX_SHARE_PROPERTY = 120;

const has = (v: string): boolean => v.trim() !== '';

/** What still stops the link, in the order the section lists them: name, brokerage, key. */
export function shareLinkBlockers(p: ProfileInput | null): ShareLinkBlocker[] {
	const blockers: ShareLinkBlocker[] = [];
	if (!p || !has(p.name)) blockers.push('name');
	if (!p || !has(p.brokerage)) blockers.push('brokerage');
	if (!p || !ACCESS_KEY_RE.test(p.web3formsAccessKey.trim())) blockers.push('key');
	return blockers;
}

/**
 * The share-link config for a profile. Optional parts are included only when present; the
 * property is trimmed and dropped when empty or longer than the page accepts. Callers check
 * shareLinkBlockers first: an incomplete profile still maps, it just produces a link the page
 * reports as incomplete.
 */
export function inquiryConfigFromProfile(
	p: ProfileInput,
	opts: { property?: string } = {}
): InquiryConfig {
	const c: InquiryConfig = {
		key: p.web3formsAccessKey.trim().toLowerCase(),
		name: p.name.trim(),
		brokerage: p.brokerage.trim()
	};
	if (has(p.teamName)) c.team = p.teamName.trim();
	if (p.licenseType !== '') c.title = p.licenseType;
	if (has(p.licenseState)) c.state = p.licenseState.trim().toUpperCase();
	if (has(p.licenseNumber)) c.license = p.licenseNumber.trim();
	const phone = normPhoneUS(p.brokeragePhone);
	if (phone !== null) c.brokeragePhone = phone;
	const property = (opts.property ?? '').trim();
	if (property !== '' && property.length <= MAX_SHARE_PROPERTY) c.property = property;
	return c;
}
