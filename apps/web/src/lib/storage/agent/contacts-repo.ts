// Contacts and activities repository (AGT-03, AGT-04). Every write that must be atomic is ONE
// Dexie rw transaction: a contact change and the activity that records it either both land or
// neither does (a failure inside the callback rolls back every table it touched).
//
// Contact rule (UI-SPEC SmartListFilter): only CONTACT_MAKING activities (call, email, meeting,
// other, draft_sent) move lastContactedAt. Notes, stage moves and task completion do not.
//
// Callers pass plain data (`$state.snapshot(...)`), never a Svelte proxy; records are rebuilt
// field by field here anyway. Browser callers only (onMount / event handlers). Every write takes
// an optional ISO `now` so tests can pin the clock.
import { newSyncable, tombstone } from '@tran/core';
import { applyMove, type ActivityDraft } from '@tran/core/crm';
import { contactSchema, MAX_ACTIVITY_TEXT } from '@tran/core/agent/schemas';
import {
	CONTACT_MAKING,
	isLive,
	type Activity,
	type Contact,
	type ContactSource,
	type Stage
} from '@tran/core/agent/types';
import { cleanText, normEmail, normPhoneUS } from '@tran/core/leads/normalize';
import Dexie from 'dexie';
import { getDb, type TranDb } from '$lib/storage/db';
import { META } from '$lib/storage/meta';
import { AGENT_RECORD_SCHEMA_VERSION, activitiesTable, contactsTable, tasksTable } from './tables';

export type NewContact = Pick<
	Contact,
	'name' | 'email' | 'phone' | 'propertyOfInterest' | 'notes' | 'source' | 'consentSource'
> &
	Partial<Pick<Contact, 'stage' | 'emailOptOutAt' | 'lastContactedAt' | 'createdAt' | 'sample'>> & {
		id?: string;
	};

export const ADDED_TEXT: Readonly<Record<ContactSource, string>> = Object.freeze({
	inquiry: 'Added from your inquiry page',
	paste: 'Added from a pasted email',
	manual: 'Added by hand',
	csv: 'Imported from CSV',
	sample: 'Loaded as a sample contact'
});

export type LogType = 'call' | 'email' | 'meeting' | 'other' | 'note';

const LOG_TEXT: Readonly<Record<LogType, string>> = Object.freeze({
	call: 'Logged a call',
	email: 'Logged an email',
	meeting: 'Logged a meeting',
	other: 'Logged contact',
	note: 'Note'
});

export interface MoveUndo {
	contactId: string;
	fromStage: Stage;
	fromStageChangedAt: string;
	activityId: string;
}

type EditableFields = Pick<
	Contact,
	'name' | 'email' | 'phone' | 'propertyOfInterest' | 'source' | 'notes'
>;

const nowIso = () => new Date().toISOString();

/** Sets emailNorm / phoneNorm from the raw values, omitting a key that does not normalize. */
function withNorms<T extends Contact>(c: T): T {
	const rest: Contact = { ...c };
	delete rest.emailNorm;
	delete rest.phoneNorm;
	const emailNorm = normEmail(rest.email);
	const phoneNorm = normPhoneUS(rest.phone);
	return {
		...rest,
		...(emailNorm ? { emailNorm } : {}),
		...(phoneNorm ? { phoneNorm } : {})
	} as T;
}

function validContact(c: Contact): Contact {
	if (!contactSchema.safeParse(c).success) throw new Error('contact-invalid');
	return c;
}

/**
 * Builds a validated contact record with no I/O (shared with the bulk import in 08-14): cleaned
 * text, normalized keys, stage 'new' by default, stageChangedAt = createdAt.
 */
export function buildContactRecord(c: NewContact, now: string): Contact {
	const createdAt = c.createdAt ?? now;
	const base = newSyncable({
		id: c.id ?? crypto.randomUUID(),
		now: new Date(createdAt),
		schemaVersion: AGENT_RECORD_SCHEMA_VERSION
	});
	return validContact(
		withNorms({
			...base,
			updatedAt: now > createdAt ? now : createdAt,
			name: cleanText(c.name),
			email: cleanText(c.email),
			phone: cleanText(c.phone),
			stage: c.stage ?? 'new',
			stageChangedAt: createdAt,
			source: c.source,
			propertyOfInterest: cleanText(c.propertyOfInterest),
			notes: cleanText(c.notes),
			consentSource: c.consentSource,
			emailOptOutAt: c.emailOptOutAt ?? null,
			lastContactedAt: c.lastContactedAt ?? null,
			sample: c.sample ?? false
		})
	);
}

/** A full activity record from a draft (text cleaned and capped). */
function activityRecord(d: ActivityDraft, now: string): Activity {
	return {
		...newSyncable({
			id: crypto.randomUUID(),
			now: new Date(now),
			schemaVersion: AGENT_RECORD_SCHEMA_VERSION
		}),
		...d,
		text: cleanText(d.text).slice(0, MAX_ACTIVITY_TEXT)
	};
}

const draft = (c: Contact, type: Activity['type'], text: string, at: string): ActivityDraft => ({
	contactId: c.id,
	type,
	text,
	at,
	sample: c.sample
});

/** The live contact, or Error('contact-not-found'). Call inside a transaction. */
async function liveContact(db: TranDb, id: string): Promise<Contact> {
	const c = await contactsTable(db).get(id);
	if (!c || !isLive(c)) throw new Error('contact-not-found');
	return c;
}

async function markFirstRecord(db: TranDb, now: string): Promise<void> {
	if (!(await db.meta.get(META.firstRecordAt))) {
		await db.meta.put({ key: META.firstRecordAt, value: now });
	}
}

/** Adds a contact and its 'added' activity in one transaction. */
export async function addContact(c: NewContact, now: string = nowIso()): Promise<Contact> {
	const db = getDb();
	const rec = buildContactRecord(c, now);
	return db.transaction('rw', [contactsTable(db), activitiesTable(db), db.meta], async () => {
		await contactsTable(db).add(rec);
		await activitiesTable(db).add(
			activityRecord(draft(rec, 'added', ADDED_TEXT[rec.source], rec.createdAt), now)
		);
		await markFirstRecord(db, now);
		return rec;
	});
}

/** The live contact, or null when missing or tombstoned. */
export async function getContact(id: string): Promise<Contact | null> {
	const c = await contactsTable(getDb()).get(id);
	return c && isLive(c) ? c : null;
}

/** Live contacts, newest first. Samples are included unless includeSamples is false. */
export async function listContacts(opts: { includeSamples?: boolean } = {}): Promise<Contact[]> {
	const withSamples = opts.includeSamples ?? true;
	const rows = await contactsTable(getDb())
		.filter((c) => isLive(c) && (withSamples || !c.sample))
		.toArray();
	return rows.sort((a, b) =>
		a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1
	);
}

/** Live contacts whose normalized email / phone matches, via the emailNorm / phoneNorm indexes. */
export async function findDuplicates(q: {
	email?: string;
	phone?: string;
	excludeId?: string;
}): Promise<{ byEmail: Contact | null; byPhone: Contact | null }> {
	const table = contactsTable(getDb());
	const ok = (c: Contact) => isLive(c) && c.id !== q.excludeId;
	const email = q.email ? normEmail(q.email) : null;
	const phone = q.phone ? normPhoneUS(q.phone) : null;
	const byEmail = email
		? await table.where('emailNorm').equals(email).filter(ok).first()
		: undefined;
	const byPhone = phone
		? await table.where('phoneNorm').equals(phone).filter(ok).first()
		: undefined;
	return { byEmail: byEmail ?? null, byPhone: byPhone ?? null };
}

/**
 * Patches the editable fields (re-normalized). Logs 'Details updated' in the same transaction
 * unless opts.logActivity is false (the notes autosave passes false).
 */
export async function updateContact(
	id: string,
	patch: Partial<EditableFields>,
	now: string = nowIso(),
	opts: { logActivity?: boolean } = {}
): Promise<Contact> {
	const db = getDb();
	return db.transaction('rw', [contactsTable(db), activitiesTable(db)], async () => {
		const c = await liveContact(db, id);
		const next: Contact = { ...c, updatedAt: now };
		if (patch.name !== undefined) next.name = cleanText(patch.name);
		if (patch.email !== undefined) next.email = cleanText(patch.email);
		if (patch.phone !== undefined) next.phone = cleanText(patch.phone);
		if (patch.propertyOfInterest !== undefined)
			next.propertyOfInterest = cleanText(patch.propertyOfInterest);
		if (patch.notes !== undefined) next.notes = cleanText(patch.notes);
		if (patch.source !== undefined) next.source = patch.source;
		const rec = validContact(withNorms(next));
		await contactsTable(db).put(rec);
		if (opts.logActivity !== false) {
			await activitiesTable(db).add(
				activityRecord(draft(rec, 'details_updated', 'Details updated', now), now)
			);
		}
		return rec;
	});
}

/**
 * Moves a contact to another stage: the contact and its "Moved from ... to ..." activity are
 * written in one transaction. Returns what undoMove needs, or null for a same-stage move.
 */
export async function moveStage(
	id: string,
	to: Stage,
	now: string = nowIso()
): Promise<MoveUndo | null> {
	const db = getDb();
	return db.transaction('rw', [contactsTable(db), activitiesTable(db)], async () => {
		const c = await liveContact(db, id);
		const moved = applyMove(c, to, now);
		if (!moved) return null;
		const act = activityRecord(moved.activity, now);
		await contactsTable(db).put(moved.contact);
		await activitiesTable(db).add(act);
		return {
			contactId: c.id,
			fromStage: c.stage,
			fromStageChangedAt: c.stageChangedAt,
			activityId: act.id
		};
	});
}

/** Undo of a move: restores stage + stageChangedAt and tombstones the move activity, atomically. */
export async function undoMove(u: MoveUndo, now: string = nowIso()): Promise<void> {
	const db = getDb();
	await db.transaction('rw', [contactsTable(db), activitiesTable(db)], async () => {
		const c = await liveContact(db, u.contactId);
		await contactsTable(db).put({
			...c,
			stage: u.fromStage,
			stageChangedAt: u.fromStageChangedAt,
			updatedAt: now
		});
		const act = await activitiesTable(db).get(u.activityId);
		if (act && isLive(act)) await activitiesTable(db).put(tombstone(act, new Date(now)));
	});
}

/**
 * Logs a call / email / meeting / other contact, or a note. Text per UI-SPEC ("Logged a call",
 * plus ": {details}" when given). Contact-making types set lastContactedAt in the same transaction.
 */
export async function logContact(
	id: string,
	type: LogType,
	details: string,
	now: string = nowIso()
): Promise<Activity> {
	const db = getDb();
	return db.transaction('rw', [contactsTable(db), activitiesTable(db)], async () => {
		const c = await liveContact(db, id);
		const d = cleanText(details);
		const act = activityRecord(
			draft(c, type, d ? `${LOG_TEXT[type]}: ${d}` : LOG_TEXT[type], now),
			now
		);
		if (CONTACT_MAKING.has(type)) {
			await contactsTable(db).put({ ...c, lastContactedAt: now, updatedAt: now });
		}
		await activitiesTable(db).add(act);
		return act;
	});
}

/** Sets or clears the email opt-out with its activity. No-op when already in that state. */
export async function setOptOut(
	id: string,
	optedOut: boolean,
	now: string = nowIso()
): Promise<void> {
	const db = getDb();
	await db.transaction('rw', [contactsTable(db), activitiesTable(db)], async () => {
		const c = await liveContact(db, id);
		if ((c.emailOptOutAt !== null) === optedOut) return;
		await contactsTable(db).put({ ...c, emailOptOutAt: optedOut ? now : null, updatedAt: now });
		await activitiesTable(db).add(
			activityRecord(
				optedOut
					? draft(c, 'opt_out_set', 'Asked not to get emails', now)
					: draft(c, 'opt_out_cleared', 'Email opt-out removed', now),
				now
			)
		);
	});
}

/** Records a follow-up as sent: activity + lastContactedAt, stage unchanged, one transaction. */
export async function markFollowupSent(id: string, now: string = nowIso()): Promise<void> {
	const db = getDb();
	await db.transaction('rw', [contactsTable(db), activitiesTable(db)], async () => {
		const c = await liveContact(db, id);
		await contactsTable(db).put({ ...c, lastContactedAt: now, updatedAt: now });
		await activitiesTable(db).add(
			activityRecord(draft(c, 'draft_sent', 'Follow-up email marked as sent', now), now)
		);
	});
}

/** Tombstones the contact with all its tasks and activities in one transaction. */
export async function deleteContact(id: string, now: string = nowIso()): Promise<void> {
	const db = getDb();
	const at = new Date(now);
	await db.transaction('rw', [contactsTable(db), tasksTable(db), activitiesTable(db)], async () => {
		const c = await contactsTable(db).get(id);
		if (!c || !isLive(c)) return;
		await contactsTable(db).put(tombstone(c, at));
		const tasks = await tasksTable(db).where('contactId').equals(id).filter(isLive).toArray();
		await tasksTable(db).bulkPut(tasks.map((t) => tombstone(t, at)));
		const acts = await activitiesTable(db).where('contactId').equals(id).filter(isLive).toArray();
		await activitiesTable(db).bulkPut(acts.map((a) => tombstone(a, at)));
	});
}

/** A contact's live activities, newest first (via the [contactId+at] index). */
export async function listActivities(contactId: string): Promise<Activity[]> {
	const rows = await activitiesTable(getDb())
		.where('[contactId+at]')
		.between([contactId, Dexie.minKey], [contactId, Dexie.maxKey])
		.reverse()
		.filter(isLive)
		.toArray();
	return rows;
}
