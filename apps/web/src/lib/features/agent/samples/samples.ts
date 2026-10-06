// Load / remove / restore the sample contacts (08-UI-SPEC "Sample contacts"). Each operation is
// ONE Dexie rw transaction over contacts, tasks and activities, so the demo is never half loaded.
// Samples are hard-deleted on remove: they are not user data, so no tombstones are kept. Zero
// keys, zero network: everything comes from the in-repo synthetic fixture.
import type { Activity, Contact, Task } from '@tran/core/agent/types';
import { getDb } from '$lib/storage/db';
import { listContacts } from '$lib/storage/agent/contacts-repo';
import { activitiesTable, contactsTable, tasksTable } from '$lib/storage/agent/tables';
import { localDateOf } from '../dates';
import { SAMPLE_ID_PREFIX, buildSampleData } from '../fixtures/sample-contacts';

export const SAMPLE_COUNT = 12;

export interface SampleSnapshot {
	contacts: Contact[];
	tasks: Task[];
	activities: Activity[];
}

const tables = () => {
	const db = getDb();
	return [contactsTable(db), tasksTable(db), activitiesTable(db)] as const;
};

/**
 * Adds the 12 sample contacts with their tasks and activities, dated relative to `now`.
 * Idempotent: when any sample contact already exists it does nothing and returns 0.
 */
export async function loadSampleContacts(now: Date = new Date()): Promise<number> {
	const data = buildSampleData(localDateOf(now), now.toISOString());
	const [contacts, tasks, activities] = tables();
	return getDb().transaction('rw', [contacts, tasks, activities], async () => {
		if ((await contacts.filter((c) => c.id.startsWith(SAMPLE_ID_PREFIX)).count()) > 0) return 0;
		await contacts.bulkPut(data.contacts);
		await tasks.bulkPut(data.tasks);
		await activities.bulkPut(data.activities);
		return data.contacts.length;
	});
}

/** Deletes every sample record (contacts, tasks, activities) and returns them for Undo. */
export async function removeSampleContacts(): Promise<SampleSnapshot> {
	const [contacts, tasks, activities] = tables();
	return getDb().transaction('rw', [contacts, tasks, activities], async () => {
		// `sample` is a boolean, which IndexedDB cannot index: filter in memory.
		const snap: SampleSnapshot = {
			contacts: await contacts.filter((r) => r.sample === true).toArray(),
			tasks: await tasks.filter((r) => r.sample === true).toArray(),
			activities: await activities.filter((r) => r.sample === true).toArray()
		};
		await contacts.bulkDelete(snap.contacts.map((r) => r.id));
		await tasks.bulkDelete(snap.tasks.map((r) => r.id));
		await activities.bulkDelete(snap.activities.map((r) => r.id));
		return snap;
	});
}

/** Puts back exactly the records a removeSampleContacts call returned. */
export async function restoreSampleContacts(s: SampleSnapshot): Promise<void> {
	const [contacts, tasks, activities] = tables();
	await getDb().transaction('rw', [contacts, tasks, activities], async () => {
		await contacts.bulkPut(s.contacts);
		await tasks.bulkPut(s.tasks);
		await activities.bulkPut(s.activities);
	});
}

/** True when the CRM holds at least one live contact (samples included). */
export async function hasAnyContacts(): Promise<boolean> {
	return (await listContacts()).length > 0;
}
