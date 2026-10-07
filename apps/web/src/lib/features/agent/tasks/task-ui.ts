// Pure UI helpers for the Today queue and task rows (08-21, AGT-05). No Svelte, no storage: the
// grouping itself is @tran/core/crm groupTasks; these decide what the queue shows and says.
import { isLive, type Task } from '@tran/core/agent/types';
import { isDueToday, isOverdue, type TaskGroups } from '@tran/core/crm';
import type { TaskValidationCode } from '$lib/storage/agent/tasks-repo';

/** The home page's compact queue shows at most this many rows (UI-SPEC "AgentHome"). */
export const COMPACT_MAX = 5;

/** "1 task" / "{n} tasks" (UI-SPEC "Today" counts). */
export function taskCountLabel(n: number): string {
	return n === 1 ? '1 task' : `${n} tasks`;
}

/** Open, live tasks that are overdue or due today: the AgentNav Today pill. */
export function dueCount(tasks: readonly Task[], today: string): number {
	let n = 0;
	for (const t of tasks) if (isLive(t) && (isOverdue(t, today) || isDueToday(t, today))) n += 1;
	return n;
}

const ERRORS: Readonly<Record<TaskValidationCode, string>> = Object.freeze({
	'title-empty': 'Describe the task, like "Call about the Oak Street tour".',
	'title-long': 'Keep it under 120 characters.',
	'due-invalid': 'Choose a due date.'
});

/** The UI-SPEC validation copy for an addTask rejection. */
export function taskErrorMessage(code: TaskValidationCode): string {
	return ERRORS[code];
}

/**
 * Where focus goes after the task `doneId` leaves its group (UI-SPEC "Focus management"): the
 * next task in the same group, else the previous one, else null (the group heading).
 */
export function nextFocusTarget(groupIds: readonly string[], doneId: string): string | null {
	const i = groupIds.indexOf(doneId);
	if (i === -1) return null;
	return groupIds[i + 1] ?? groupIds[i - 1] ?? null;
}

export interface CompactQueue {
	overdue: Task[];
	dueToday: Task[];
	/** Overdue and due-today tasks beyond the first COMPACT_MAX ("See everything due"). */
	more: number;
}

/** The first five of overdue then due today, plus how many were left out. */
export function compactQueue(groups: Pick<TaskGroups, 'overdue' | 'dueToday'>): CompactQueue {
	const overdue = groups.overdue.slice(0, COMPACT_MAX);
	const dueToday = groups.dueToday.slice(0, Math.max(0, COMPACT_MAX - overdue.length));
	const total = groups.overdue.length + groups.dueToday.length;
	return { overdue, dueToday, more: Math.max(0, total - overdue.length - dueToday.length) };
}
