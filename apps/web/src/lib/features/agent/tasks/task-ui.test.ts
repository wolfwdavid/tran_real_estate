// Pure helpers behind the Today queue and the task rows (08-21): count labels, the nav pill count,
// validation copy, the focus target after a task is checked, and the home page's compact queue.
import { describe, expect, it } from 'vitest';
import type { Task } from '@tran/core/agent/types';
import type { TaskGroups } from '@tran/core/crm';
import { compactQueue, dueCount, nextFocusTarget, taskCountLabel, taskErrorMessage } from './task-ui';

const TODAY = '2026-10-06';

function task(id: string, dueDate: string, extra: Partial<Task> = {}): Task {
	return {
		id,
		ownerId: 'local',
		createdAt: '2026-10-01T12:00:00.000Z',
		updatedAt: '2026-10-01T12:00:00.000Z',
		schemaVersion: 1,
		contactId: 'c1',
		title: `Task ${id}`,
		dueDate,
		status: 'open',
		doneAt: null,
		sample: false,
		...extra
	};
}

const groups = (overdue: Task[], dueToday: Task[]): TaskGroups => ({
	overdue,
	dueToday,
	comingUp: [],
	comingUpMore: 0,
	doneToday: []
});

describe('taskCountLabel', () => {
	it('uses the singular for one task', () => {
		expect(taskCountLabel(1)).toBe('1 task');
	});
	it('uses the plural otherwise', () => {
		expect(taskCountLabel(3)).toBe('3 tasks');
		expect(taskCountLabel(0)).toBe('0 tasks');
	});
});

describe('dueCount', () => {
	it('counts open live tasks that are overdue or due today', () => {
		const tasks = [
			task('a', '2026-10-04'),
			task('b', TODAY),
			task('c', '2026-10-07'),
			task('d', TODAY, { status: 'done', doneAt: '2026-10-06T10:00:00.000Z' }),
			task('e', '2026-10-01', { deletedAt: '2026-10-05T00:00:00.000Z' })
		];
		expect(dueCount(tasks, TODAY)).toBe(2);
	});
	it('is zero for no tasks', () => {
		expect(dueCount([], TODAY)).toBe(0);
	});
});

describe('taskErrorMessage', () => {
	it('carries the UI-SPEC validation copy', () => {
		expect(taskErrorMessage('title-empty')).toBe(
			'Describe the task, like "Call about the Oak Street tour".'
		);
		expect(taskErrorMessage('title-long')).toBe('Keep it under 120 characters.');
		expect(taskErrorMessage('due-invalid')).toBe('Choose a due date.');
	});
});

describe('nextFocusTarget', () => {
	const ids = ['a', 'b', 'c'];
	it('prefers the task after the one just done', () => {
		expect(nextFocusTarget(ids, 'a')).toBe('b');
		expect(nextFocusTarget(ids, 'b')).toBe('c');
	});
	it('falls back to the one before when the last task was done', () => {
		expect(nextFocusTarget(ids, 'c')).toBe('b');
	});
	it('is null when the group empties (focus the group heading)', () => {
		expect(nextFocusTarget(['a'], 'a')).toBeNull();
	});
	it('is null when the id is not in the group', () => {
		expect(nextFocusTarget(ids, 'zzz')).toBeNull();
	});
});

describe('compactQueue', () => {
	it('shows overdue then due today, capped at five, and counts the rest', () => {
		const overdue = [task('o1', '2026-10-03'), task('o2', '2026-10-05')];
		const dueToday = [task('t1', TODAY), task('t2', TODAY), task('t3', TODAY), task('t4', TODAY)];
		const q = compactQueue(groups(overdue, dueToday));
		expect(q.overdue.map((t) => t.id)).toEqual(['o1', 'o2']);
		expect(q.dueToday.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
		expect(q.more).toBe(1);
	});
	it('fills the five from overdue first', () => {
		const overdue = Array.from({ length: 6 }, (_, i) => task(`o${i}`, '2026-10-01'));
		const q = compactQueue(groups(overdue, [task('t1', TODAY)]));
		expect(q.overdue).toHaveLength(5);
		expect(q.dueToday).toHaveLength(0);
		expect(q.more).toBe(2);
	});
	it('reports no overflow when five or fewer are due', () => {
		const q = compactQueue(groups([task('o1', '2026-10-01')], [task('t1', TODAY)]));
		expect(q.overdue).toHaveLength(1);
		expect(q.dueToday).toHaveLength(1);
		expect(q.more).toBe(0);
	});
});
