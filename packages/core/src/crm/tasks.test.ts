import { describe, expect, it } from 'vitest';

import type { Task } from '../agent/types.js';
import {
	groupTasks,
	isDueToday,
	isOverdue,
	nextOpenTask,
	quickDates,
	type TaskCtx
} from './tasks.js';

const TODAY = '2026-10-04';
let seq = 0;
function task(overrides: Partial<Task> = {}): Task {
	seq += 1;
	return {
		id: `t${seq}`,
		ownerId: 'local',
		createdAt: `2026-10-01T00:00:${String(seq % 60).padStart(2, '0')}.000Z`,
		updatedAt: '2026-10-01T00:00:00.000Z',
		schemaVersion: 1,
		contactId: 'c1',
		title: `Task ${seq}`,
		dueDate: TODAY,
		status: 'open',
		doneAt: null,
		sample: false,
		...overrides
	};
}

// Fixed local-date mapping: the agent is in a US zone 4 hours behind UTC.
const localDate = (iso: string) =>
	new Date(Date.parse(iso) - 4 * 3_600_000).toISOString().slice(0, 10);
const NAMES: Record<string, string> = { c1: 'Morgan', c2: 'Alex', c3: 'Zoe' };
const ctx: TaskCtx = { today: TODAY, localDate, contactName: (id) => NAMES[id] ?? '' };

describe('isDueToday / isOverdue', () => {
	it('due today only when open and due exactly today', () => {
		expect(isDueToday(task({ dueDate: TODAY }), TODAY)).toBe(true);
		expect(isDueToday(task({ dueDate: '2026-10-03' }), TODAY)).toBe(false);
		expect(isDueToday(task({ dueDate: '2026-10-05' }), TODAY)).toBe(false);
		expect(isDueToday(task({ dueDate: TODAY, status: 'done' }), TODAY)).toBe(false);
	});

	it('overdue only when open and due strictly before today', () => {
		expect(isOverdue(task({ dueDate: '2026-10-03' }), TODAY)).toBe(true);
		expect(isOverdue(task({ dueDate: '2025-12-31' }), TODAY)).toBe(true);
		expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
		expect(isOverdue(task({ dueDate: '2026-10-05' }), TODAY)).toBe(false);
		expect(isOverdue(task({ dueDate: '2026-10-01', status: 'done' }), TODAY)).toBe(false);
	});
});

describe('groupTasks', () => {
	it('sorts tasks into the groups with the 7-day coming-up boundary', () => {
		const od = task({ dueDate: '2026-10-02' });
		const dt = task({ dueDate: TODAY });
		const tomorrow = task({ dueDate: '2026-10-05' });
		const day7 = task({ dueDate: '2026-10-11' });
		const day8 = task({ dueDate: '2026-10-12' });
		const g = groupTasks([day8, day7, tomorrow, dt, od], ctx);
		expect(g.overdue).toEqual([od]);
		expect(g.dueToday).toEqual([dt]);
		expect(g.comingUp).toEqual([tomorrow, day7]);
		expect(g.comingUpMore).toBe(0);
		expect(g.doneToday).toEqual([]);
		const all = [...g.overdue, ...g.dueToday, ...g.comingUp, ...g.doneToday];
		expect(all).not.toContain(day8);
	});

	it('orders overdue by due date, then contact name', () => {
		const a = task({ dueDate: '2026-10-03', contactId: 'c3' });
		const b = task({ dueDate: '2026-10-03', contactId: 'c2' });
		const c = task({ dueDate: '2026-10-01', contactId: 'c1' });
		expect(groupTasks([a, b, c], ctx).overdue).toEqual([c, b, a]);
	});

	it('orders due today by creation time', () => {
		const late = task({ createdAt: '2026-10-03T09:00:00.000Z' });
		const early = task({ createdAt: '2026-10-02T09:00:00.000Z' });
		expect(groupTasks([late, early], ctx).dueToday).toEqual([early, late]);
	});

	it('caps coming up at 10 and reports the overflow', () => {
		const many = Array.from({ length: 13 }, (_, i) =>
			task({ dueDate: i < 7 ? '2026-10-06' : '2026-10-05' })
		);
		const g = groupTasks(many, ctx);
		expect(g.comingUp).toHaveLength(10);
		expect(g.comingUpMore).toBe(3);
		expect(g.comingUp.slice(0, 6).every((t) => t.dueDate === '2026-10-05')).toBe(true);
	});

	it('done today uses the local date of doneAt, not the UTC date', () => {
		// 02:00Z on the 5th is 22:00 on the 4th locally.
		const lateEvening = task({ status: 'done', doneAt: '2026-10-05T02:00:00.000Z' });
		// 03:00Z on the 4th is 23:00 on the 3rd locally.
		const yesterday = task({ status: 'done', doneAt: '2026-10-04T03:00:00.000Z' });
		const g = groupTasks([lateEvening, yesterday], ctx);
		expect(g.doneToday).toEqual([lateEvening]);
		expect(g.overdue).toEqual([]);
		expect(g.dueToday).toEqual([]);
	});

	it('orders done today by completion time', () => {
		const second = task({ status: 'done', doneAt: '2026-10-04T18:00:00.000Z' });
		const first = task({ status: 'done', doneAt: '2026-10-04T14:00:00.000Z' });
		expect(groupTasks([second, first], ctx).doneToday).toEqual([first, second]);
	});

	it('excludes tombstoned tasks from every group', () => {
		const dead = { deletedAt: '2026-10-03T00:00:00.000Z' };
		const g = groupTasks(
			[
				task({ dueDate: '2026-10-01', ...dead }),
				task({ dueDate: TODAY, ...dead }),
				task({ dueDate: '2026-10-06', ...dead }),
				task({ status: 'done', doneAt: '2026-10-04T15:00:00.000Z', ...dead })
			],
			ctx
		);
		expect(g).toEqual({ overdue: [], dueToday: [], comingUp: [], comingUpMore: 0, doneToday: [] });
	});

	it('done tasks never appear in the open groups', () => {
		const g = groupTasks(
			[
				task({ status: 'done', dueDate: '2026-10-01', doneAt: '2026-10-01T15:00:00.000Z' }),
				task({ status: 'done', dueDate: TODAY, doneAt: '2026-10-01T15:00:00.000Z' }),
				task({ status: 'done', dueDate: '2026-10-06', doneAt: '2026-10-01T15:00:00.000Z' })
			],
			ctx
		);
		expect(g).toEqual({ overdue: [], dueToday: [], comingUp: [], comingUpMore: 0, doneToday: [] });
	});
});

describe('nextOpenTask', () => {
	it('picks the earliest-due open live task, ties by creation', () => {
		const a = task({ dueDate: '2026-10-08', createdAt: '2026-10-01T00:00:00.000Z' });
		const b = task({ dueDate: '2026-10-06', createdAt: '2026-10-02T00:00:00.000Z' });
		const c = task({ dueDate: '2026-10-06', createdAt: '2026-10-01T05:00:00.000Z' });
		const done = task({
			dueDate: '2026-10-01',
			status: 'done',
			doneAt: '2026-10-01T00:00:00.000Z'
		});
		const dead = task({ dueDate: '2026-10-02', deletedAt: '2026-10-03T00:00:00.000Z' });
		expect(nextOpenTask([a, b, c, done, dead])).toBe(c);
	});

	it('returns null when nothing is open', () => {
		expect(nextOpenTask([])).toBeNull();
		expect(nextOpenTask([task({ status: 'done', doneAt: '2026-10-01T00:00:00.000Z' })])).toBeNull();
	});
});

describe('quickDates', () => {
	it('computes the quick-set due dates', () => {
		expect(quickDates('2026-10-04')).toEqual({
			today: '2026-10-04',
			tomorrow: '2026-10-05',
			in3Days: '2026-10-07',
			nextWeek: '2026-10-11'
		});
		expect(quickDates('2026-12-30').nextWeek).toBe('2027-01-06');
	});
});
