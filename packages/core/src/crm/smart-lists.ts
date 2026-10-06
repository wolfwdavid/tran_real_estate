// Smart lists (UI-SPEC "SmartListFilter"): All plus exactly three presets. Cut line: no others.
//
// Definitions, all against an injected local `today` (YYYY-MM-DD):
// - Due today: the contact has an open, live task due today or overdue.
// - No contact in 7 days: not Closed, and the local date of lastContactedAt (or createdAt when
//   never contacted) is before today - 7. Exactly 7 days ago does not match; 8 does.
//   Stage moves, notes and task completion never set lastContactedAt (CONTACT_MAKING).
// - New this week: created on or after today - 6 (rolling 7 calendar days including today).
// Tombstoned contacts match no list.
import { isLive, type Contact, type Task } from '../agent/types.js';
import { addDays } from './dates.js';
import { isDueToday, isOverdue } from './tasks.js';

export const SMART_LISTS = ['all', 'due-today', 'no-contact-7d', 'new-this-week'] as const;
export type SmartList = (typeof SMART_LISTS)[number];

export const SMART_LIST_LABELS: Readonly<Record<SmartList, string>> = Object.freeze({
	all: 'All',
	'due-today': 'Due today',
	'no-contact-7d': 'No contact in 7 days',
	'new-this-week': 'New this week'
});

export interface ListCtx {
	/** Local calendar date, YYYY-MM-DD. */
	today: string;
	/** Maps an ISO timestamp to its local calendar date (YYYY-MM-DD). */
	localDate: (iso: string) => string;
	/** Open tasks keyed by contactId. Done or tombstoned entries are ignored defensively. */
	openTasksByContact: ReadonlyMap<string, readonly Task[]>;
}

export function matchesList(list: SmartList, c: Contact, ctx: ListCtx): boolean {
	if (!isLive(c)) return false;
	switch (list) {
		case 'all':
			return true;
		case 'due-today':
			return (ctx.openTasksByContact.get(c.id) ?? []).some(
				(t) => isLive(t) && (isDueToday(t, ctx.today) || isOverdue(t, ctx.today))
			);
		case 'no-contact-7d':
			if (c.stage === 'closed') return false;
			return ctx.localDate(c.lastContactedAt ?? c.createdAt) < addDays(ctx.today, -7);
		case 'new-this-week':
			return ctx.localDate(c.createdAt) >= addDays(ctx.today, -6);
	}
}

export function countLists(contacts: readonly Contact[], ctx: ListCtx): Record<SmartList, number> {
	const out = Object.fromEntries(SMART_LISTS.map((l) => [l, 0])) as Record<SmartList, number>;
	for (const c of contacts) for (const l of SMART_LISTS) if (matchesList(l, c, ctx)) out[l] += 1;
	return out;
}
