// The home page's "Get set up" checklist (08-21; UI-SPEC "/agent/ home: AgentHome"). Done state is
// computed from stored data, never from clicks: the profile details behind the disclosure and
// CAN-SPAM address, the inquiry share link, and the first real (non-sample) contact.
import { isLive, type AgentProfile, type Contact } from '@tran/core/agent/types';
import { ACCESS_KEY_RE } from '@tran/core/leads/inquiry-params';

export type SetupKey = 'details' | 'inquiry' | 'contact';

export interface SetupItem {
	key: SetupKey;
	label: string;
	done: boolean;
}

export interface SetupChecklist {
	items: SetupItem[];
	allDone: boolean;
}

export const SETUP_LABELS: Readonly<Record<SetupKey, string>> = Object.freeze({
	details: 'Add your name, license, and mailing address',
	inquiry: 'Create your inquiry link',
	contact: 'Add your first contact'
});

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

/** At least one live contact that is not a sample. */
export function contactDone(contacts: readonly Contact[]): boolean {
	return contacts.some((c) => isLive(c) && !c.sample);
}

export function setupChecklist(input: {
	profile: AgentProfile | null;
	contacts: readonly Contact[];
}): SetupChecklist {
	const items: SetupItem[] = [
		{ key: 'details', label: SETUP_LABELS.details, done: detailsDone(input.profile) },
		{ key: 'inquiry', label: SETUP_LABELS.inquiry, done: inquiryDone(input.profile) },
		{ key: 'contact', label: SETUP_LABELS.contact, done: contactDone(input.contacts) }
	];
	return { items, allDone: items.every((i) => i.done) };
}
