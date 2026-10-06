// Follow-up tasks repository (AGT-05). A task belongs to one contact, has a LOCAL calendar due
// date (YYYY-MM-DD) and a string status ('open' | 'done'): IndexedDB cannot index booleans, so
// the due-today queue reads the compound [status+dueDate] index.
//
// Completing a task and logging "Task done: {title}" happen in ONE rw transaction; reopening
// restores the task and tombstones that activity in one transaction too. Delete is a tombstone
// so the UI can offer Undo (restoreTask). Every write takes an optional ISO `now`.
import { newSyncable, tombstone } from '@tran/core';
import { isIsoDate } from '@tran/core/crm';
import { MAX_ACTIVITY_TEXT, MAX_TASK_TITLE } from '@tran/core/agent/schemas';
import { isLive, type Activity, type Task } from '@tran/core/agent/types';
import { cleanText } from '@tran/core/leads/normalize';
import Dexie from 'dexie';
import { getDb, type TranDb } from '$lib/storage/db';
import { AGENT_RECORD_SCHEMA_VERSION, activitiesTable, contactsTable, tasksTable } from './tables';

export type TaskValidationCode = 'title-empty' | 'title-long' | 'due-invalid';

export class TaskValidationError extends Error {
	constructor(public code: TaskValidationCode) {
		super(code);
		this.name = 'TaskValidationError';
	}
}

const nowIso = () => new Date().toISOString();

const byDue = (a: Task, b: Task) =>
	a.dueDate === b.dueDate
		? a.createdAt < b.createdAt
			? -1
			: a.createdAt > b.createdAt
				? 1
				: 0
		: a.dueDate < b.dueDate
			? -1
			: 1;

async function liveTask(db: TranDb, id: string): Promise<Task> {
	const t = await tasksTable(db).get(id);
	if (!t || !isLive(t)) throw new Error('task-not-found');
	return t;
}

/** Adds an open task to a live contact. The sample flag is copied from the contact. */
export async function addTask(
	contactId: string,
	title: string,
	dueDate: string,
	now: string = nowIso()
): Promise<Task> {
	const clean = cleanText(title);
	if (clean === '') throw new TaskValidationError('title-empty');
	if (clean.length > MAX_TASK_TITLE) throw new TaskValidationError('title-long');
	if (!isIsoDate(dueDate)) throw new TaskValidationError('due-invalid');
	const db = getDb();
	return db.transaction('rw', [contactsTable(db), tasksTable(db)], async () => {
		const c = await contactsTable(db).get(contactId);
		if (!c || !isLive(c)) throw new Error('contact-not-found');
		const rec: Task = {
			...newSyncable({
				id: crypto.randomUUID(),
				now: new Date(now),
				schemaVersion: AGENT_RECORD_SCHEMA_VERSION
			}),
			contactId,
			title: clean,
			dueDate,
			status: 'open',
			doneAt: null,
			sample: c.sample
		};
		await tasksTable(db).add(rec);
		return rec;
	});
}

/** Marks a task done and logs "Task done: {title}" in one transaction. No-op when already done. */
export async function completeTask(id: string, now: string = nowIso()): Promise<Task> {
	const db = getDb();
	return db.transaction('rw', [tasksTable(db), activitiesTable(db)], async () => {
		const t = await liveTask(db, id);
		if (t.status === 'done') return t;
		const next: Task = { ...t, status: 'done', doneAt: now, updatedAt: now };
		await tasksTable(db).put(next);
		const act: Activity = {
			...newSyncable({
				id: crypto.randomUUID(),
				now: new Date(now),
				schemaVersion: AGENT_RECORD_SCHEMA_VERSION
			}),
			contactId: t.contactId,
			type: 'task_done',
			text: `Task done: ${t.title}`.slice(0, MAX_ACTIVITY_TEXT),
			at: now,
			taskId: t.id,
			sample: t.sample
		};
		await activitiesTable(db).add(act);
		return next;
	});
}

/** Reopens a done task and tombstones its latest live task_done activity, atomically. */
export async function reopenTask(id: string, now: string = nowIso()): Promise<Task> {
	const db = getDb();
	return db.transaction('rw', [tasksTable(db), activitiesTable(db)], async () => {
		const t = await liveTask(db, id);
		if (t.status === 'open') return t;
		const next: Task = { ...t, status: 'open', doneAt: null, updatedAt: now };
		await tasksTable(db).put(next);
		const acts = await activitiesTable(db)
			.where('contactId')
			.equals(t.contactId)
			.filter((a) => isLive(a) && a.type === 'task_done' && a.taskId === t.id)
			.toArray();
		const latest = acts.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0];
		if (latest) await activitiesTable(db).put(tombstone(latest, new Date(now)));
		return next;
	});
}

/** Tombstones a task; returns the tombstoned record so the UI can offer Undo. */
export async function deleteTask(id: string, now: string = nowIso()): Promise<Task> {
	const db = getDb();
	return db.transaction('rw', [tasksTable(db)], async () => {
		const t = await liveTask(db, id);
		const dead = tombstone(t, new Date(now));
		await tasksTable(db).put(dead);
		return dead;
	});
}

/** Undo of deleteTask: clears deletedAt and bumps updatedAt. */
export async function restoreTask(id: string, now: string = nowIso()): Promise<Task> {
	const db = getDb();
	return db.transaction('rw', [tasksTable(db)], async () => {
		const t = await tasksTable(db).get(id);
		if (!t) throw new Error('task-not-found');
		if (isLive(t)) return t;
		const back: Task = { ...t, updatedAt: now };
		delete back.deletedAt;
		await tasksTable(db).put(back);
		return back;
	});
}

/** Live open tasks across all contacts, soonest due first (via [status+dueDate]). */
export async function listOpenTasks(): Promise<Task[]> {
	const rows = await tasksTable(getDb())
		.where('[status+dueDate]')
		.between(['open', Dexie.minKey], ['open', Dexie.maxKey])
		.filter(isLive)
		.toArray();
	return rows.sort(byDue);
}

/** One contact's live tasks (open and done), soonest due first. */
export async function listTasksFor(contactId: string): Promise<Task[]> {
	const rows = await tasksTable(getDb())
		.where('contactId')
		.equals(contactId)
		.filter(isLive)
		.toArray();
	return rows.sort(byDue);
}

/** Live done tasks completed at or after isoStart (callers pass local midnight as ISO). */
export async function listDoneSince(isoStart: string): Promise<Task[]> {
	const rows = await tasksTable(getDb())
		.where('[status+dueDate]')
		.between(['done', Dexie.minKey], ['done', Dexie.maxKey])
		.filter((t) => isLive(t) && t.doneAt !== null && t.doneAt >= isoStart)
		.toArray();
	return rows.sort((a, b) => ((a.doneAt ?? '') < (b.doneAt ?? '') ? 1 : -1));
}
