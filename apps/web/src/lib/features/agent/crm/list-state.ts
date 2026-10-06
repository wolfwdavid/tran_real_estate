// URL view state and search for the CRM lists (UI-SPEC "Routes" query params, "Contacts list").
// ?list= carries the smart list (default 'all' is omitted), ?q= carries the search text (empty is
// omitted). Invalid values fall back to the defaults. Search runs in memory, no network.
import { isLive, type Contact } from '@tran/core/agent';
import { SMART_LISTS, type SmartList } from '@tran/core/crm';

type SearchInput = string | URLSearchParams;

const toParams = (s: SearchInput): URLSearchParams =>
	typeof s === 'string' ? new URLSearchParams(s) : s;

/** The smart list named by ?list=; anything unknown or missing is 'all'. */
export function readListParam(search: SearchInput): SmartList {
	const raw = toParams(search).get('list');
	return (SMART_LISTS as readonly string[]).includes(raw ?? '') ? (raw as SmartList) : 'all';
}

/** The decoded ?q= search text, or '' when missing. */
export function readQueryParam(search: SearchInput): string {
	return toParams(search).get('q') ?? '';
}

/**
 * Builds a search string (with leading '?', or '' when empty) for replaceState. Other params are
 * preserved; list=all and a blank q are dropped. Keys not given in `next` are left as they are.
 */
export function withParams(current: string, next: { list?: SmartList; q?: string }): string {
	const p = new URLSearchParams(current);
	if (next.list !== undefined) {
		if (next.list === 'all') p.delete('list');
		else p.set('list', next.list);
	}
	if (next.q !== undefined) {
		if (next.q.trim() === '') p.delete('q');
		else p.set('q', next.q);
	}
	const s = p.toString();
	return s ? `?${s}` : '';
}

const digits = (s: string): string => s.replace(/\D/g, '');

/**
 * Live contacts matching `q`: case-insensitive substring of name or email, or (when q holds at
 * least 3 digits) a substring of the phone's digits. A blank q returns every live contact.
 */
export function filterContacts(contacts: readonly Contact[], q: string): Contact[] {
	const live = contacts.filter(isLive);
	const needle = q.trim().toLowerCase();
	if (needle === '') return live;
	const qDigits = digits(needle);
	return live.filter(
		(c) =>
			c.name.toLowerCase().includes(needle) ||
			c.email.toLowerCase().includes(needle) ||
			(qDigits.length >= 3 && digits(c.phone).includes(qDigits))
	);
}
