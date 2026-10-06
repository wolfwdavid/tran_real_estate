// Contacts and activities repository (08-12): add + 'added' activity, duplicate lookup, the
// transactional stage move and its undo, contact logging, opt-out, follow-up sent and the delete
// cascade. fake-indexeddb with a fresh IDBFactory per test and fixed `now` strings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@tran/core/agent/types';
import { _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import {
	ADDED_TEXT,
	addContact,
	buildContactRecord,
	deleteContact,
	findDuplicates,
	getContact,
	listActivities,
	listContacts,
	logContact,
	markFollowupSent,
	moveStage,
	setOptOut,
	undoMove,
	updateContact,
	type NewContact
} from './contacts-repo';

const T1 = '2026-10-06T12:00:00.000Z';
const T2 = '2026-10-06T13:00:00.000Z';
const T3 = '2026-10-06T14:00:00.000Z';

beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => {
	vi.restoreAllMocks();
	_resetDb();
});

function lead(o: Partial<NewContact> = {}): NewContact {
	return {
		name: 'Jordan Example',
		email: 'jo@example.com',
		phone: '(555) 555-0142',
		propertyOfInterest: '12 Sample Lane',
		notes: '',
		source: 'manual',
		consentSource: 'unknown',
		...o
	};
}

describe('addContact', () => {
	it.each(Object.entries(ADDED_TEXT))(
		'writes the contact and one added activity (%s)',
		async (source, text) => {
			const c = await addContact(lead({ source: source as NewContact['source'] }), T1);
			expect(await getContact(c.id)).toEqual(c);
			expect(c).toMatchObject({ stage: 'new', stageChangedAt: T1, createdAt: T1, sample: false });
			expect(c.deletedAt).toBeUndefined();
			const acts = await listActivities(c.id);
			expect(acts).toHaveLength(1);
			expect(acts[0]).toMatchObject({ type: 'added', text, at: T1, contactId: c.id });
		}
	);

	it('is atomic: a failed added-activity write leaves no contact behind', async () => {
		vi.spyOn(getDb().activities, 'add').mockRejectedValue(new Error('boom'));
		await expect(addContact(lead(), T1)).rejects.toThrow();
		vi.restoreAllMocks();
		expect(await getDb().contacts.count()).toBe(0);
	});

	it('stores normalized keys; an un-normalizable phone stores no phoneNorm', async () => {
		const a = await addContact(lead({ email: ' JO@Example.com ' }), T1);
		expect(a.phoneNorm).toBe('+15555550142');
		expect(a.emailNorm).toBe('jo@example.com');
		const b = await addContact(lead({ phone: 'call after 5', email: 'not an email' }), T1);
		expect('phoneNorm' in b).toBe(false);
		expect('emailNorm' in b).toBe(false);
		expect('phoneNorm' in (await getDb().contacts.get(b.id))!).toBe(false);
	});

	it('cleans text fields', async () => {
		const c = await addContact(lead({ name: '  Jordan\u202e Example ' }), T1);
		expect(c.name).toBe('Jordan Example');
	});

	it('buildContactRecord honors an imported id, stage, createdAt and timestamps without I/O', () => {
		const id = '44444444-4444-4444-8444-444444444444';
		const c = buildContactRecord(
			lead({ id, stage: 'touring', createdAt: T1, lastContactedAt: T2, sample: true }),
			T3
		);
		expect(c).toMatchObject({
			id,
			stage: 'touring',
			createdAt: T1,
			stageChangedAt: T1,
			updatedAt: T3,
			lastContactedAt: T2,
			sample: true
		});
	});

	it('listContacts is newest first and can exclude samples', async () => {
		const a = await addContact(lead({ name: 'A' }), T1);
		const b = await addContact(lead({ name: 'B', sample: true, source: 'sample' }), T2);
		expect((await listContacts()).map((c) => c.id)).toEqual([b.id, a.id]);
		expect((await listContacts({ includeSamples: false })).map((c) => c.id)).toEqual([a.id]);
	});
});

describe('findDuplicates', () => {
	it("finds by normalized email ('JO@EXAMPLE.COM ') and phone", async () => {
		const c = await addContact(lead(), T1);
		const d = await findDuplicates({ email: 'JO@EXAMPLE.COM ', phone: '555.555.0142' });
		expect(d.byEmail?.id).toBe(c.id);
		expect(d.byPhone?.id).toBe(c.id);
	});

	it('ignores tombstoned contacts and honors excludeId', async () => {
		const c = await addContact(lead(), T1);
		expect((await findDuplicates({ email: 'jo@example.com', excludeId: c.id })).byEmail).toBeNull();
		await deleteContact(c.id, T2);
		expect(await findDuplicates({ email: 'jo@example.com', phone: '(555) 555-0142' })).toEqual({
			byEmail: null,
			byPhone: null
		});
	});

	it('an empty or un-normalizable query matches nothing', async () => {
		await addContact(lead({ phone: 'n/a' }), T1);
		expect(await findDuplicates({ phone: 'n/a' })).toEqual({ byEmail: null, byPhone: null });
		expect(await findDuplicates({})).toEqual({ byEmail: null, byPhone: null });
	});
});

describe('moveStage / undoMove', () => {
	it('new -> touring writes the stage and "Moved from New to Touring"; lastContactedAt unchanged', async () => {
		const c = await addContact(lead(), T1);
		const undo = await moveStage(c.id, 'touring', T2);
		const after = await getContact(c.id);
		expect(after).toMatchObject({ stage: 'touring', stageChangedAt: T2, lastContactedAt: null });
		const acts = await listActivities(c.id);
		expect(acts[0]).toMatchObject({
			id: undo?.activityId,
			type: 'stage_changed',
			text: 'Moved from New to Touring',
			fromStage: 'new',
			toStage: 'touring'
		});
		expect(undo).toEqual({
			contactId: c.id,
			fromStage: 'new',
			fromStageChangedAt: T1,
			activityId: acts[0]!.id
		});
	});

	it('a same-stage move returns null and writes nothing', async () => {
		const c = await addContact(lead(), T1);
		expect(await moveStage(c.id, 'new', T2)).toBeNull();
		expect(await getContact(c.id)).toEqual(c);
		expect(await listActivities(c.id)).toHaveLength(1);
	});

	it('is atomic: when the activity write fails, the stage change rolls back', async () => {
		const c = await addContact(lead(), T1);
		const db = getDb();
		vi.spyOn(db.activities, 'add').mockRejectedValue(new Error('boom'));
		await expect(moveStage(c.id, 'touring', T2)).rejects.toThrow();
		vi.restoreAllMocks();
		expect((await getContact(c.id))?.stage).toBe('new');
		expect(await listActivities(c.id)).toHaveLength(1);
	});

	it('undoMove restores stage + stageChangedAt and tombstones the move activity', async () => {
		const c = await addContact(lead(), T1);
		const undo = await moveStage(c.id, 'offer', T2);
		await undoMove(undo!, T3);
		expect(await getContact(c.id)).toMatchObject({ stage: 'new', stageChangedAt: T1 });
		const acts = await listActivities(c.id);
		expect(acts.map((a) => a.type)).toEqual(['added']);
		const raw = await getDb().activities.get(undo!.activityId);
		expect(raw?.deletedAt).toBe(T3);
	});

	it('undoMove is atomic: a failed tombstone keeps the moved stage', async () => {
		const c = await addContact(lead(), T1);
		const undo = await moveStage(c.id, 'offer', T2);
		vi.spyOn(getDb().activities, 'put').mockRejectedValue(new Error('boom'));
		await expect(undoMove(undo!, T3)).rejects.toThrow();
		vi.restoreAllMocks();
		expect((await getContact(c.id))?.stage).toBe('offer');
	});

	it('a missing contact rejects', async () => {
		await expect(moveStage(crypto.randomUUID(), 'offer', T2)).rejects.toThrow('contact-not-found');
	});
});

describe('logContact', () => {
	it("'call' sets lastContactedAt and writes 'Logged a call: Asked about Saturday'", async () => {
		const c = await addContact(lead(), T1);
		const a = await logContact(c.id, 'call', 'Asked about Saturday', T2);
		expect(a.text).toBe('Logged a call: Asked about Saturday');
		expect((await getContact(c.id))?.lastContactedAt).toBe(T2);
	});

	it.each([
		['email', 'Logged an email'],
		['meeting', 'Logged a meeting'],
		['other', 'Logged contact']
	] as const)('%s counts as contact (%s)', async (type, text) => {
		const c = await addContact(lead(), T1);
		expect((await logContact(c.id, type, '  ', T2)).text).toBe(text);
		expect((await getContact(c.id))?.lastContactedAt).toBe(T2);
	});

	it("'note' does not set lastContactedAt", async () => {
		const c = await addContact(lead(), T1);
		const a = await logContact(c.id, 'note', 'Prefers mornings', T2);
		expect(a).toMatchObject({ type: 'note', text: 'Note: Prefers mornings' });
		expect((await getContact(c.id))?.lastContactedAt).toBeNull();
	});

	it('is atomic: a failed activity write leaves lastContactedAt alone', async () => {
		const c = await addContact(lead(), T1);
		vi.spyOn(getDb().activities, 'add').mockRejectedValue(new Error('boom'));
		await expect(logContact(c.id, 'call', '', T2)).rejects.toThrow();
		vi.restoreAllMocks();
		expect((await getContact(c.id))?.lastContactedAt).toBeNull();
	});
});

describe('updateContact', () => {
	it("re-normalizes and logs 'Details updated'; notes autosave can skip the activity", async () => {
		const c = await addContact(lead(), T1);
		const u = await updateContact(c.id, { email: 'New@Example.com', phone: '' }, T2);
		expect(u).toMatchObject({ email: 'New@Example.com', emailNorm: 'new@example.com' });
		expect('phoneNorm' in u).toBe(false);
		expect((await listActivities(c.id))[0]?.text).toBe('Details updated');
		await updateContact(c.id, { notes: 'Has a dog' }, T3, { logActivity: false });
		expect(await listActivities(c.id)).toHaveLength(2);
		expect((await getContact(c.id))?.notes).toBe('Has a dog');
	});
});

describe('setOptOut / markFollowupSent', () => {
	it('records the opt-out and its removal with activities', async () => {
		const c = await addContact(lead(), T1);
		await setOptOut(c.id, true, T2);
		expect((await getContact(c.id))?.emailOptOutAt).toBe(T2);
		expect((await listActivities(c.id))[0]).toMatchObject({
			type: 'opt_out_set',
			text: 'Asked not to get emails'
		});
		await setOptOut(c.id, true, T2);
		expect(await listActivities(c.id)).toHaveLength(2);
		await setOptOut(c.id, false, T3);
		expect((await getContact(c.id))?.emailOptOutAt).toBeNull();
		expect((await listActivities(c.id))[0]).toMatchObject({
			type: 'opt_out_cleared',
			text: 'Email opt-out removed'
		});
	});

	it("markFollowupSent writes 'Follow-up email marked as sent' and lastContactedAt; stage unchanged", async () => {
		const c = await addContact(lead(), T1);
		await moveStage(c.id, 'contacted', T1);
		await markFollowupSent(c.id, T2);
		expect(await getContact(c.id)).toMatchObject({ stage: 'contacted', lastContactedAt: T2 });
		expect((await listActivities(c.id))[0]).toMatchObject({
			type: 'draft_sent',
			text: 'Follow-up email marked as sent'
		});
	});

	it('setOptOut is atomic: a failed activity write keeps the opt-out unset', async () => {
		const c = await addContact(lead(), T1);
		vi.spyOn(getDb().activities, 'add').mockRejectedValue(new Error('boom'));
		await expect(setOptOut(c.id, true, T2)).rejects.toThrow();
		vi.restoreAllMocks();
		expect((await getContact(c.id))?.emailOptOutAt).toBeNull();
	});

	it('markFollowupSent is atomic', async () => {
		const c = await addContact(lead(), T1);
		vi.spyOn(getDb().activities, 'add').mockRejectedValue(new Error('boom'));
		await expect(markFollowupSent(c.id, T2)).rejects.toThrow();
		vi.restoreAllMocks();
		expect((await getContact(c.id))?.lastContactedAt).toBeNull();
	});
});

describe('deleteContact', () => {
	const task = (id: string, contactId: string): Task => ({
		id,
		ownerId: 'local',
		createdAt: T1,
		updatedAt: T1,
		schemaVersion: 1,
		contactId,
		title: 'Call back',
		dueDate: '2026-10-07',
		status: 'open',
		doneAt: null,
		sample: false
	});

	it('tombstones the contact, its tasks and its activities; other contacts untouched', async () => {
		const c = await addContact(lead(), T1);
		const other = await addContact(lead({ name: 'Other', email: 'o@example.com' }), T1);
		const db = getDb();
		await db.tasks.bulkPut([
			task('55555555-5555-4555-8555-555555555551', c.id),
			task('55555555-5555-4555-8555-555555555552', c.id),
			task('55555555-5555-4555-8555-555555555553', other.id)
		]);
		await logContact(c.id, 'call', '', T2);
		await deleteContact(c.id, T3);

		expect(await getContact(c.id)).toBeNull();
		expect((await db.contacts.get(c.id))?.deletedAt).toBe(T3);
		const tasks = await db.tasks.toArray();
		expect(tasks.filter((t) => t.contactId === c.id).every((t) => t.deletedAt === T3)).toBe(true);
		expect(tasks.find((t) => t.contactId === other.id)?.deletedAt).toBeUndefined();
		const acts = await db.activities.where('contactId').equals(c.id).toArray();
		expect(acts).toHaveLength(2);
		expect(acts.every((a) => a.deletedAt === T3)).toBe(true);
		expect(await listActivities(c.id)).toEqual([]);
		expect(await getContact(other.id)).not.toBeNull();
	});

	it('is atomic: a failed activity tombstone keeps the contact and its tasks live', async () => {
		const c = await addContact(lead(), T1);
		const db = getDb();
		await db.tasks.put(task('55555555-5555-4555-8555-555555555551', c.id));
		vi.spyOn(db.activities, 'bulkPut').mockRejectedValue(new Error('boom'));
		await expect(deleteContact(c.id, T2)).rejects.toThrow();
		vi.restoreAllMocks();
		expect(await getContact(c.id)).not.toBeNull();
		expect((await db.tasks.toArray())[0]?.deletedAt).toBeUndefined();
	});
});
