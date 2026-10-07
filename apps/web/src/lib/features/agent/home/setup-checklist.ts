// The home page's "Get set up" checklist (08-21; UI-SPEC "/agent/ home: AgentHome"). Done state is
// computed from stored data, never from clicks: the profile details behind the disclosure and
// CAN-SPAM address, the inquiry share link, and the first real (non-sample) contact. The row
// copy lives in AgentHome.svelte next to its markup.
import { isLive, type AgentProfile, type Contact } from '@tran/core/agent/types';
import { ACCESS_KEY_RE, type InquiryConfig } from '@tran/core/leads/inquiry-params';
import { normPhoneUS } from '@tran/core/leads/normalize';

export type SetupKey = 'details' | 'inquiry' | 'contact';

export interface SetupItem {
	key: SetupKey;
	done: boolean;
}

export interface SetupChecklist {
	items: SetupItem[];
	allDone: boolean;
}

const has = (v: string): boolean => v.trim() !== '';

/** Name, license number, license state and a full mailing address (street, city, state, ZIP). */
export function detailsDone(p: AgentProfile | null): boolean {
	if (!p) return false;
	const { street, city, state, zip } = p.postal;
	return (
		has(p.name) &&
		has(p.licenseNumber) &&
		has(p.licenseState) &&
		has(street) &&
		has(city) &&
		has(state) &&
		has(zip)
	);
}

/** A share link can be built: name, brokerage and a Web3Forms access key. */
export function inquiryDone(p: AgentProfile | null): boolean {
	return p !== null && has(p.name) && has(p.brokerage) && ACCESS_KEY_RE.test(p.web3formsAccessKey);
}

/**
 * The share-link config for a profile (what the public inquiry page needs), or null while the
 * profile cannot build one (see inquiryDone). Optional parts are included only when present.
 */
export function inquiryConfigFor(p: AgentProfile | null): InquiryConfig | null {
	if (!p || !inquiryDone(p)) return null;
	const c: InquiryConfig = {
		key: p.web3formsAccessKey.toLowerCase(),
		name: p.name.trim(),
		brokerage: p.brokerage.trim()
	};
	if (has(p.teamName)) c.team = p.teamName.trim();
	if (p.licenseType !== '') c.title = p.licenseType;
	if (has(p.licenseState)) c.state = p.licenseState.trim().toUpperCase();
	if (has(p.licenseNumber)) c.license = p.licenseNumber.trim();
	const phone = normPhoneUS(p.brokeragePhone);
	if (phone !== null) c.brokeragePhone = phone;
	return c;
}

/** At least one live contact that is not a sample. */
export function contactDone(contacts: readonly Contact[]): boolean {
	return contacts.some((c) => isLive(c) && !c.sample);
}

export function setupChecklist(input: {
	profile: AgentProfile | null;
	contacts: readonly Contact[];
}): SetupChecklist {
	const items: SetupItem[] = [
		{ key: 'details', done: detailsDone(input.profile) },
		{ key: 'inquiry', done: inquiryDone(input.profile) },
		{ key: 'contact', done: contactDone(input.contacts) }
	];
	return { items, allDone: items.every((i) => i.done) };
}
