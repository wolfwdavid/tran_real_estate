// Sample contacts (08-15): the 12-contact synthetic fixture, idempotent load, remove leaving user
// contacts untouched, and an exact restore. fake-indexeddb with a fresh factory per test.
// Pin a zone west of Greenwich so a UTC-sliced "today" would show up as a wrong local date.
process.env.TZ = 'America/Los_Angeles';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contactSchema, activitySchema, taskSchema } from '@tran/core/agent/schemas';
import { groupTasks } from '@tran/core/crm';
import { normPhoneUS } from '@tran/core/leads/normalize';
import { _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import { addContact, listContacts } from '$lib/storage/agent/contacts-repo';
import { activitiesTable, contactsTable, tasksTable } from '$lib/storage/agent/tables';
import { localDateOf } from '../dates';
import { buildSampleData } from '../fixtures/sample-contacts';
import {
	SAMPLE_COUNT,
	hasAnyContacts,
	loadSampleContacts,
	removeSampleContacts,
	restoreSampleContacts
} from './samples';

const NOW = new Date('2026-10-04T15:00:00.000Z');
const TODAY = '2026-10-04';

beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => _resetDb());

const all = async () => {
	const db = getDb();
	return {
		contacts: await contactsTable(db).toArray(),
		tasks: await tasksTable(db).toArray(),
		activities: await activitiesTable(db).toArray()
	};
};

describe('buildSampleData', () => {
	const data = buildSampleData(TODAY, NOW.toISOString());

	it('has 12 contacts with the stage distribution', () => {
		expect(data.contacts).toHaveLength(SAMPLE_COUNT);
		const counts: Record<string, number> = {};
		for (const c of data.contacts) counts[c.stage] = (counts[c.stage] ?? 0) + 1;
		expect(counts).toEqual({ new: 4, contacted: 3, touring: 2, offer: 2, closed: 1 });
	});

	it('splits tasks 2 overdue, 3 due today, 4 upcoming', () => {
		const names = new Map(data.contacts.map((c) => [c.id, c.name]));
		const g = groupTasks(data.tasks, {
			today: TODAY,
			localDate: localDateOf,
			contactName: (id) => names.get(id) ?? ''
		});
		expect(g.overdue).toHaveLength(2);
		expect(g.dueToday).toHaveLength(3);
		expect(g.comingUp).toHaveLength(4);
		expect(g.overdue.map((t) => t.title)).toEqual([
			'Call about financing pre-approval',
			'Send the Oak Street listing details'
		]);
	});

	it('marks every record as sample and passes the record schemas', () => {
		for (const c of data.contacts) {
			expect(c.sample).toBe(true);
			expect(contactSchema.safeParse(c).success).toBe(true);
		}
		for (const t of data.tasks) {
			expect(t.sample).toBe(true);
			expect(taskSchema.safeParse(t).success).toBe(true);
		}
		for (const a of data.activities) {
			expect(a.sample).toBe(true);
			expect(activitySchema.safeParse(a).success).toBe(true);
		}
	});

	it('uses only synthetic emails and 555-01xx phones', () => {
		const emails = data.contacts.map((c) => c.email).filter(Boolean);
		expect(emails).toHaveLength(11);
		for (const e of emails) expect(e).toMatch(/@example\.com$/);
		const phones = data.contacts.map((c) => c.phone).filter(Boolean);
		expect(phones).toHaveLength(11);
		for (const p of phones) expect(normPhoneUS(p)).toMatch(/^\+155555501\d\d$/);
	});

	it('logs added, stage, call, opt-out and inquiry activities', () => {
		const by = (t: string) => data.activities.filter((a) => a.type === t);
		expect(by('added')).toHaveLength(12);
		expect(by('added')[0].text).toBe('Loaded as a sample contact');
		expect(by('stage_changed')).toHaveLength(8);
		expect(by('stage_changed').map((a) => a.text)).toContain('Moved from New to Touring');
		expect(by('call')).toHaveLength(8);
		expect(by('opt_out_set').map((a) => a.text)).toEqual(['Asked not to get emails']);
		expect(by('inquiry')[0].text).toBe('Inquiry received: "Could we tour on Saturday morning?"');
	});
});

describe('load / remove / restore', () => {
	it('loads 12 sample contacts once (idempotent)', async () => {
		expect(await hasAnyContacts()).toBe(false);
		expect(await loadSampleContacts(NOW)).toBe(12);
		expect(await loadSampleContacts(NOW)).toBe(0);
		expect(await listContacts()).toHaveLength(12);
		expect(await hasAnyContacts()).toBe(true);
		const { tasks } = await all();
		expect(tasks.map((t) => t.dueDate).sort()[0]).toBe('2026-10-02');
	});

	it('removes only samples and restores identical records', async () => {
		const mine = await addContact(
			{
				name: 'Avery Owner',
				email: 'avery@example.com',
				phone: '',
				propertyOfInterest: '',
				notes: '',
				source: 'manual',
				consentSource: 'unknown'
			},
			NOW.toISOString()
		);
		await loadSampleContacts(NOW);
		const before = await all();

		const snap = await removeSampleContacts();
		expect(snap.contacts).toHaveLength(12);
		expect(snap.tasks).toHaveLength(9);
		const left = await all();
		expect(left.contacts.map((c) => c.id)).toEqual([mine.id]);
		expect(left.tasks).toHaveLength(0);
		expect(left.activities.every((a) => a.contactId === mine.id)).toBe(true);

		await restoreSampleContacts(snap);
		const after = await all();
		const sortById = <T extends { id: string }>(xs: T[]) =>
			[...xs].sort((a, b) => a.id.localeCompare(b.id));
		expect(sortById(after.contacts)).toEqual(sortById(before.contacts));
		expect(sortById(after.tasks)).toEqual(sortById(before.tasks));
		expect(sortById(after.activities)).toEqual(sortById(before.activities));
	});
});
