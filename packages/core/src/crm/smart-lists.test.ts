import { describe, expect, it } from 'vitest';

import type { Contact, Task } from '../agent/types.js';
import {
	SMART_LIST_LABELS,
	SMART_LISTS,
	countLists,
	matchesList,
	type ListCtx
} from './smart-lists.js';

const TODAY = '2026-10-04';
let seq = 0;
function contact(overrides: Partial<Contact> = {}): Contact {
	seq += 1;
	return {
		id: `c${seq}`,
		ownerId: 'local',
		createdAt: '2026-09-01T16:00:00.000Z',
		updatedAt: '2026-09-01T16:00:00.000Z',
		schemaVersion: 1,
		name: `Contact ${seq}`,
		email: '',
		phone: '',
		stage: 'new',
		stageChangedAt: '2026-09-01T16:00:00.000Z',
		source: 'manual',
		propertyOfInterest: '',
		notes: '',
		consentSource: 'unknown',
		emailOptOutAt: null,
		lastContactedAt: '2026-10-03T16:00:00.000Z',
		sample: false,
		...overrides
	};
}
function task(contactId: string, dueDate: string, overrides: Partial<Task> = {}): Task {
	seq += 1;
	return {
		id: `t${seq}`,
		ownerId: 'local',
		createdAt: '2026-09-01T00:00:00.000Z',
		updatedAt: '2026-09-01T00:00:00.000Z',
		schemaVersion: 1,
		contactId,
		title: 'Follow up',
		dueDate,
		status: 'open',
		doneAt: null,
		sample: false,
		...overrides
	};
}

// The agent's zone is 4 hours behind UTC. The mapping is fixed so the test never reads the host zone.
const localDate = (iso: string) =>
	new Date(Date.parse(iso) - 4 * 3_600_000).toISOString().slice(0, 10);
function ctxWith(tasks: Task[] = []): ListCtx {
	const m = new Map<string, Task[]>();
	for (const t of tasks) m.set(t.contactId, [...(m.get(t.contactId) ?? []), t]);
	return { today: TODAY, localDate, openTasksByContact: m };
}
const at = (iso: string, overrides: Partial<Contact> = {}) =>
	contact({ ...overrides, lastContactedAt: iso });

describe('SMART_LISTS', () => {
	it('is exactly All plus the three presets', () => {
		expect(SMART_LISTS).toEqual(['all', 'due-today', 'no-contact-7d', 'new-this-week']);
		expect(SMART_LIST_LABELS).toEqual({
			all: 'All',
			'due-today': 'Due today',
			'no-contact-7d': 'No contact in 7 days',
			'new-this-week': 'New this week'
		});
	});
});

describe('due-today', () => {
	it('matches an open task due today or overdue, not a future one', () => {
		const today = contact();
		const over = contact();
		const future = contact();
		const none = contact();
		const ctx = ctxWith([
			task(today.id, TODAY),
			task(over.id, '2026-10-03'),
			task(future.id, '2026-10-05')
		]);
		expect(matchesList('due-today', today, ctx)).toBe(true);
		expect(matchesList('due-today', over, ctx)).toBe(true);
		expect(matchesList('due-today', future, ctx)).toBe(false);
		expect(matchesList('due-today', none, ctx)).toBe(false);
	});

	it('ignores done and tombstoned tasks even if the caller passes them', () => {
		const c = contact();
		const ctx = ctxWith([
			task(c.id, TODAY, { status: 'done', doneAt: '2026-10-04T12:00:00.000Z' }),
			task(c.id, '2026-10-01', { deletedAt: '2026-10-02T00:00:00.000Z' })
		]);
		expect(matchesList('due-today', c, ctx)).toBe(false);
	});
});

describe('no-contact-7d', () => {
	const ctx = ctxWith();
	it('exactly 7 local days since last contact does not match; 8 does', () => {
		expect(matchesList('no-contact-7d', at('2026-09-27T16:00:00.000Z'), ctx)).toBe(false);
		expect(matchesList('no-contact-7d', at('2026-09-26T16:00:00.000Z'), ctx)).toBe(true);
	});

	it('uses the local date: 02:00Z on the 27th is still the 26th locally', () => {
		expect(matchesList('no-contact-7d', at('2026-09-27T02:00:00.000Z'), ctx)).toBe(true);
	});

	it('falls back to createdAt when never contacted', () => {
		const never = (createdAt: string) => contact({ lastContactedAt: null, createdAt });
		expect(matchesList('no-contact-7d', never('2026-09-27T16:00:00.000Z'), ctx)).toBe(false);
		expect(matchesList('no-contact-7d', never('2026-09-26T16:00:00.000Z'), ctx)).toBe(true);
	});

	it('a recent createdAt does not hide a stale lastContactedAt, and vice versa', () => {
		const c = at('2026-09-01T16:00:00.000Z', { createdAt: '2026-10-04T16:00:00.000Z' });
		expect(matchesList('no-contact-7d', c, ctx)).toBe(true);
	});

	it('never matches a closed contact', () => {
		const c = at('2026-01-01T16:00:00.000Z', { stage: 'closed' });
		expect(matchesList('no-contact-7d', c, ctx)).toBe(false);
		expect(matchesList('no-contact-7d', { ...c, stage: 'offer' }, ctx)).toBe(true);
	});
});

describe('new-this-week', () => {
	const ctx = ctxWith();
	const created = (createdAt: string) => contact({ createdAt });
	it('is a rolling 7 calendar days including today', () => {
		expect(matchesList('new-this-week', created('2026-10-04T16:00:00.000Z'), ctx)).toBe(true);
		expect(matchesList('new-this-week', created('2026-09-28T16:00:00.000Z'), ctx)).toBe(true);
		expect(matchesList('new-this-week', created('2026-09-27T16:00:00.000Z'), ctx)).toBe(false);
	});

	it('uses the injected local date, not the UTC date of the timestamp', () => {
		// 02:00Z on 2026-09-29 is 22:00 on 2026-09-28 locally: inside the window.
		// 02:00Z on 2026-09-28 is 22:00 on 2026-09-27 locally: outside, although its UTC date is in.
		expect(matchesList('new-this-week', created('2026-09-29T02:00:00.000Z'), ctx)).toBe(true);
		expect(matchesList('new-this-week', created('2026-09-28T02:00:00.000Z'), ctx)).toBe(false);
		// 02:00Z on the 5th is the evening of the 4th locally: created today.
		expect(localDate('2026-10-05T02:00:00.000Z')).toBe('2026-10-04');
		expect(matchesList('new-this-week', created('2026-10-05T02:00:00.000Z'), ctx)).toBe(true);
	});
});

describe('all and tombstones', () => {
	it('all matches every live contact; tombstoned contacts match nothing', () => {
		const dead = contact({
			deletedAt: '2026-10-03T00:00:00.000Z',
			lastContactedAt: null,
			createdAt: '2026-10-04T16:00:00.000Z'
		});
		const ctx = ctxWith([task(dead.id, TODAY)]);
		expect(matchesList('all', contact(), ctx)).toBe(true);
		for (const l of SMART_LISTS) expect(matchesList(l, dead, ctx)).toBe(false);
	});
});

describe('countLists', () => {
	it('counts each list over live contacts', () => {
		const a = contact({ createdAt: '2026-10-03T16:00:00.000Z' }); // new this week
		const b = contact({ lastContactedAt: '2026-09-01T16:00:00.000Z' }); // stale
		const c = contact(); // due today via task
		const d = contact({ deletedAt: '2026-10-01T00:00:00.000Z' });
		const ctx = ctxWith([task(c.id, TODAY)]);
		expect(countLists([a, b, c, d], ctx)).toEqual({
			all: 3,
			'due-today': 1,
			'no-contact-7d': 1,
			'new-this-week': 1
		});
	});
});
