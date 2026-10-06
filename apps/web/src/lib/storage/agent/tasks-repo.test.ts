// Tasks repository (08-14): validation, completion with its activity, reopen, undoable delete
// and the [status+dueDate] open-task query. fake-indexeddb, fresh factory per test, fixed `now`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import { addContact, listActivities, type NewContact } from './contacts-repo';
import {
	addTask,
	completeTask,
	deleteTask,
	listDoneSince,
	listOpenTasks,
	listTasksFor,
	reopenTask,
	restoreTask,
	TaskValidationError
} from './tasks-repo';

const T1 = '2026-10-06T12:00:00.000Z';
const T2 = '2026-10-06T13:00:00.000Z';
const T3 = '2026-10-06T14:00:00.000Z';
const TITLE = 'Call about the Oak Street tour';

beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => {
	vi.restoreAllMocks();
	_resetDb();
});

function contact(o: Partial<NewContact> = {}): Promise<{ id: string }> {
	return addContact(
		{
			name: 'Jordan Example',
			email: 'jo@example.com',
			phone: '',
			propertyOfInterest: '',
			notes: '',
			source: 'manual',
			consentSource: 'unknown',
			...o
		},
		T1
	);
}

async function code(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (e) {
		return e instanceof TaskValidationError ? e.code : `other:${String(e)}`;
	}
	return 'resolved';
}

describe('addTask', () => {
	it('adds an open task with a local due date', async () => {
		const c = await contact();
		const t = await addTask(c.id, `  ${TITLE} `, '2026-10-07', T1);
		expect(t).toMatchObject({
			contactId: c.id,
			title: TITLE,
			dueDate: '2026-10-07',
			status: 'open',
			doneAt: null,
			sample: false,
			createdAt: T1
		});
		expect(t.deletedAt).toBeUndefined();
		expect(await getDb().tasks.get(t.id)).toEqual(t);
	});

	it('rejects with validation codes', async () => {
		const c = await contact();
		expect(await code(addTask(c.id, '   ', '2026-10-07', T1))).toBe('title-empty');
		expect(await code(addTask(c.id, 'x'.repeat(121), '2026-10-07', T1))).toBe('title-long');
		expect(await code(addTask(c.id, 'ok', '2026-02-30', T1))).toBe('due-invalid');
		expect(await code(addTask(c.id, 'ok', '10/07/2026', T1))).toBe('due-invalid');
		expect(await code(addTask(c.id, 'x'.repeat(120), '2026-10-07', T1))).toBe('resolved');
	});

	it('copies the sample flag from a sample contact', async () => {
		const c = await contact({ sample: true, source: 'sample' });
		expect((await addTask(c.id, TITLE, '2026-10-07', T1)).sample).toBe(true);
	});

	it('refuses a missing contact', async () => {
		await expect(addTask('nope', TITLE, '2026-10-07', T1)).rejects.toThrow('contact-not-found');
	});
});

describe('completeTask / reopenTask', () => {
	it('marks done and logs the task_done activity', async () => {
		const c = await contact();
		const t = await addTask(c.id, TITLE, '2026-10-07', T1);
		const done = await completeTask(t.id, T2);
		expect(done).toMatchObject({ status: 'done', doneAt: T2, updatedAt: T2 });
		expect(await getDb().tasks.get(t.id)).toEqual(done);
		const acts = await listActivities(c.id);
		expect(acts[0]).toMatchObject({
			type: 'task_done',
			text: `Task done: ${TITLE}`,
			taskId: t.id,
			at: T2
		});
	});

	it('is atomic: a failed activity write leaves the task open', async () => {
		const c = await contact();
		const t = await addTask(c.id, TITLE, '2026-10-07', T1);
		vi.spyOn(getDb().activities, 'add').mockRejectedValue(new Error('boom'));
		await expect(completeTask(t.id, T2)).rejects.toThrow();
		vi.restoreAllMocks();
		expect(await getDb().tasks.get(t.id)).toMatchObject({ status: 'open', doneAt: null });
	});

	it('reopen restores open and removes the task_done activity', async () => {
		const c = await contact();
		const t = await addTask(c.id, TITLE, '2026-10-07', T1);
		await completeTask(t.id, T2);
		const back = await reopenTask(t.id, T3);
		expect(back).toMatchObject({ status: 'open', doneAt: null, updatedAt: T3 });
		const acts = await listActivities(c.id);
		expect(acts.some((a) => a.type === 'task_done')).toBe(false);
		expect(acts.map((a) => a.type)).toEqual(['added']);
	});

	it('reopen is atomic: a failed activity tombstone keeps the task done', async () => {
		const c = await contact();
		const t = await addTask(c.id, TITLE, '2026-10-07', T1);
		await completeTask(t.id, T2);
		vi.spyOn(getDb().activities, 'put').mockRejectedValue(new Error('boom'));
		await expect(reopenTask(t.id, T3)).rejects.toThrow();
		vi.restoreAllMocks();
		expect(await getDb().tasks.get(t.id)).toMatchObject({ status: 'done', doneAt: T2 });
	});

	it('done tasks appear in listDoneSince from the given start', async () => {
		const c = await contact();
		const t = await addTask(c.id, TITLE, '2026-10-07', T1);
		await completeTask(t.id, T2);
		expect((await listDoneSince(T1)).map((x) => x.id)).toEqual([t.id]);
		expect(await listDoneSince(T3)).toEqual([]);
	});
});

describe('deleteTask / restoreTask', () => {
	it('round trips through a tombstone', async () => {
		const c = await contact();
		const t = await addTask(c.id, TITLE, '2026-10-07', T1);
		const dead = await deleteTask(t.id, T2);
		expect(dead.deletedAt).toBe(T2);
		expect(await listTasksFor(c.id)).toEqual([]);
		expect(await listOpenTasks()).toEqual([]);
		const back = await restoreTask(t.id, T3);
		expect(back.deletedAt).toBeUndefined();
		expect('deletedAt' in (await getDb().tasks.get(t.id))!).toBe(false);
		expect((await listTasksFor(c.id)).map((x) => x.id)).toEqual([t.id]);
	});
});

describe('listOpenTasks', () => {
	it('excludes done and deleted tasks and sorts by due date', async () => {
		const c = await contact();
		const late = await addTask(c.id, 'Late', '2026-10-20', T1);
		const soon = await addTask(c.id, 'Soon', '2026-10-01', T1);
		const mid = await addTask(c.id, 'Mid', '2026-10-09', T1);
		const done = await addTask(c.id, 'Done', '2026-09-01', T1);
		const gone = await addTask(c.id, 'Gone', '2026-09-02', T1);
		await completeTask(done.id, T2);
		await deleteTask(gone.id, T2);
		expect((await listOpenTasks()).map((t) => t.id)).toEqual([soon.id, mid.id, late.id]);
		expect((await listTasksFor(c.id)).map((t) => t.title)).toEqual(['Done', 'Soon', 'Mid', 'Late']);
	});
});
