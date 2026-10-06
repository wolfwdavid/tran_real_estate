// Follow-up tasks (AGT-05): the due-today queue groups and the quick-set due dates.
//
// Due dates are local calendar dates (YYYY-MM-DD) compared as plain strings against an injected
// `today`. Timestamps (doneAt) are turned into local calendar dates by the injected `localDate`,
// because core has no access to the runtime time zone.
import { isLive, type Task } from '../agent/types.js';
import { addDays } from './dates.js';

export interface TaskCtx {
	/** Local calendar date, YYYY-MM-DD. */
	today: string;
	/** Maps an ISO timestamp to its local calendar date (YYYY-MM-DD). */
	localDate: (iso: string) => string;
	contactName: (contactId: string) => string;
}

export interface TaskGroups {
	overdue: Task[];
	dueToday: Task[];
	comingUp: Task[];
	comingUpMore: number;
	doneToday: Task[];
}

/** Coming up = due tomorrow through today + COMING_UP_DAYS, capped at COMING_UP_MAX rows. */
export const COMING_UP_DAYS = 7;
export const COMING_UP_MAX = 10;

export function isDueToday(t: Task, today: string): boolean {
	return t.status === 'open' && t.dueDate === today;
}

/** Open and due strictly before today. Done tasks are never overdue. */
export function isOverdue(t: Task, today: string): boolean {
	return t.status === 'open' && t.dueDate < today;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byDueThenCreated = (a: Task, b: Task) =>
	cmp(a.dueDate, b.dueDate) || cmp(a.createdAt, b.createdAt);

export function groupTasks(tasks: readonly Task[], ctx: TaskCtx): TaskGroups {
	const { today } = ctx;
	const horizon = addDays(today, COMING_UP_DAYS);
	const overdue: Task[] = [];
	const dueToday: Task[] = [];
	const upcoming: Task[] = [];
	const doneToday: Task[] = [];

	for (const t of tasks) {
		if (!isLive(t)) continue;
		if (t.status === 'done') {
			if (t.doneAt !== null && ctx.localDate(t.doneAt) === today) doneToday.push(t);
		} else if (isOverdue(t, today)) overdue.push(t);
		else if (isDueToday(t, today)) dueToday.push(t);
		else if (t.dueDate <= horizon) upcoming.push(t);
	}

	overdue.sort(
		(a, b) =>
			cmp(a.dueDate, b.dueDate) ||
			ctx.contactName(a.contactId).localeCompare(ctx.contactName(b.contactId)) ||
			cmp(a.createdAt, b.createdAt)
	);
	dueToday.sort((a, b) => cmp(a.createdAt, b.createdAt));
	upcoming.sort(byDueThenCreated);
	doneToday.sort((a, b) => cmp(a.doneAt ?? '', b.doneAt ?? ''));

	return {
		overdue,
		dueToday,
		comingUp: upcoming.slice(0, COMING_UP_MAX),
		comingUpMore: Math.max(0, upcoming.length - COMING_UP_MAX),
		doneToday
	};
}

/** The open, live task with the earliest due date (ties: earliest created), or null. */
export function nextOpenTask(tasks: readonly Task[]): Task | null {
	let best: Task | null = null;
	for (const t of tasks) {
		if (!isLive(t) || t.status !== 'open') continue;
		if (best === null || byDueThenCreated(t, best) < 0) best = t;
	}
	return best;
}

/** Due dates for the contact-detail quick-set buttons (Today, Tomorrow, In 3 days, Next week). */
export function quickDates(today: string): {
	today: string;
	tomorrow: string;
	in3Days: string;
	nextWeek: string;
} {
	return {
		today,
		tomorrow: addDays(today, 1),
		in3Days: addDays(today, 3),
		nextWeek: addDays(today, 7)
	};
}
