// All-or-nothing import commit (AGT-03, AGT-07). Paste import, CSV import and bulk adds first run
// the diffLeads dry run (@tran/core/leads/diff-leads); the agent reviews the rows, and the
// checked rows become an ImportPlan. commitImport writes the whole plan in ONE Dexie rw
// transaction: any throw aborts it and nothing is written.
//
// Rules (08-RESEARCH Pattern 5):
// - An update only fills fields that are STILL blank when the commit runs (the target is re-read
//   inside the transaction), so a value typed between the review and the commit is never lost.
// - An inquiry message becomes an 'inquiry' activity; it never touches the notes.
import { newSyncable } from '@tran/core';
import { contactSchema, MAX_ACTIVITY_TEXT } from '@tran/core/agent/schemas';
import { isLive, type Activity, type Contact, type IncomingLead } from '@tran/core/agent/types';
import type { FillableField, LeadDiffRow } from '@tran/core/leads/diff-leads';
import { cleanText, normEmail, normPhoneUS } from '@tran/core/leads/normalize';
import { getDb } from '$lib/storage/db';
import { META } from '$lib/storage/meta';
import { ADDED_TEXT, buildContactRecord } from './contacts-repo';
import { AGENT_RECORD_SCHEMA_VERSION, activitiesTable, contactsTable } from './tables';

export interface ImportUpdate {
	contactId: string;
	fills: Partial<Record<FillableField, string>>;
	inquiryMessage?: string;
}

export interface ImportPlan {
	adds: IncomingLead[];
	updates: ImportUpdate[];
	skipped: number;
}

export type LeadEdits = Partial<Pick<IncomingLead, 'name' | 'email' | 'phone'>>;

export interface ImportResult {
	added: number;
	updated: number;
	skipped: number;
}

/** Thrown when the commit did not finish; nothing was written. `cause` holds the original error. */
export class ImportCommitError extends Error {
	constructor(cause: unknown) {
		super('import-commit-failed', { cause });
		this.name = 'ImportCommitError';
	}
}

const INQUIRY_PREVIEW = 80;
// cleanText folds a Unicode ellipsis to three dots, so the stored text uses the ASCII form.
const ELLIPSIS = '...';

/** "Inquiry received: \"{first 80 chars}...\"" (ellipsis only when truncated). */
export function inquiryText(message: string): string {
	const clean = cleanText(message);
	const head = clean.slice(0, INQUIRY_PREVIEW);
	return `Inquiry received: "${head}${clean.length > INQUIRY_PREVIEW ? ELLIPSIS : ''}"`;
}

const blank = (v: string | undefined): boolean => cleanText(v ?? '') === '';

/**
 * Turns reviewed diff rows into a plan. Only rows whose rowNumber is in `include` are written:
 * 'new' rows become adds (with any preview edits applied), 'update' rows become fill-blank
 * updates. Everything else (duplicate, conflict, same-as-row, unchecked) is counted as skipped.
 */
export function planFromDiff(
	rows: readonly LeadDiffRow[],
	include: ReadonlySet<number>,
	edits?: ReadonlyMap<number, LeadEdits>
): ImportPlan {
	const plan: ImportPlan = { adds: [], updates: [], skipped: 0 };
	for (const row of rows) {
		const n = row.lead.rowNumber;
		if (!include.has(n) || (row.kind !== 'new' && row.kind !== 'update')) {
			plan.skipped += 1;
			continue;
		}
		if (row.kind === 'new') {
			plan.adds.push({ ...row.lead, ...(edits?.get(n) ?? {}) });
			continue;
		}
		const fills: Partial<Record<FillableField, string>> = {};
		for (const f of row.fills) fills[f] = row.lead[f];
		const msg = row.lead.message;
		plan.updates.push({
			contactId: row.target.id,
			fills,
			...(row.logsInquiry && msg !== undefined && !blank(msg) ? { inquiryMessage: msg } : {})
		});
	}
	return plan;
}

function activity(
	c: Contact,
	type: Activity['type'],
	text: string,
	at: string,
	now: string
): Activity {
	return {
		...newSyncable({
			id: crypto.randomUUID(),
			now: new Date(now),
			schemaVersion: AGENT_RECORD_SCHEMA_VERSION
		}),
		contactId: c.id,
		type,
		text: cleanText(text).slice(0, MAX_ACTIVITY_TEXT),
		at,
		sample: c.sample
	};
}

/** Re-derives emailNorm / phoneNorm after a fill, omitting a key that does not normalize. */
function renormalized(c: Contact): Contact {
	const next: Contact = { ...c };
	delete next.emailNorm;
	delete next.phoneNorm;
	const e = normEmail(next.email);
	const p = normPhoneUS(next.phone);
	if (e) next.emailNorm = e;
	if (p) next.phoneNorm = p;
	return next;
}

/** Writes a reviewed plan atomically. Throws ImportCommitError (and writes nothing) on failure. */
export async function commitImport(
	plan: ImportPlan,
	now: string = new Date().toISOString()
): Promise<ImportResult> {
	const db = getDb();
	const contacts = contactsTable(db);
	const activities = activitiesTable(db);
	try {
		return await db.transaction('rw', [contacts, activities, db.meta], async () => {
			const newContacts: Contact[] = [];
			const newActivities: Activity[] = [];

			for (const lead of plan.adds) {
				if (blank(lead.name)) throw new Error(`row-${lead.rowNumber}-name-empty`);
				// A Tran id from a CSV round trip is kept only when that row id is free.
				const reuseId = lead.id !== undefined && !(await contacts.get(lead.id));
				const rec = buildContactRecord(
					{
						...(reuseId ? { id: lead.id } : {}),
						name: lead.name,
						email: lead.email,
						phone: lead.phone,
						propertyOfInterest: lead.propertyOfInterest,
						notes: lead.notes,
						source: lead.source,
						consentSource: lead.consentSource,
						...(lead.stage ? { stage: lead.stage } : {}),
						...(lead.createdAt ? { createdAt: lead.createdAt } : {}),
						...(lead.lastContactedAt !== undefined
							? { lastContactedAt: lead.lastContactedAt }
							: {}),
						...(lead.emailOptOutAt !== undefined ? { emailOptOutAt: lead.emailOptOutAt } : {})
					},
					now
				);
				newContacts.push(rec);
				newActivities.push(activity(rec, 'added', ADDED_TEXT[rec.source], rec.createdAt, now));
				if (lead.message !== undefined && !blank(lead.message)) {
					newActivities.push(activity(rec, 'inquiry', inquiryText(lead.message), now, now));
				}
			}

			// Two updates for one contact build on each other, not on the stale stored row.
			const changed = new Map<string, Contact>();
			let updated = 0;
			let gone = 0;
			for (const u of plan.updates) {
				const c = changed.get(u.contactId) ?? (await contacts.get(u.contactId));
				if (!c || !isLive(c)) {
					gone += 1;
					continue;
				}
				let next: Contact = { ...c };
				let filled = false;
				for (const [field, value] of Object.entries(u.fills) as [FillableField, string][]) {
					if (blank(value) || !blank(next[field])) continue;
					next[field] = cleanText(value);
					filled = true;
				}
				const inquiry = u.inquiryMessage !== undefined && !blank(u.inquiryMessage);
				if (!filled && !inquiry) continue;
				if (filled) {
					next = renormalized({ ...next, updatedAt: now });
					if (!contactSchema.safeParse(next).success) throw new Error('contact-invalid');
					changed.set(next.id, next);
					newActivities.push(activity(next, 'details_updated', 'Details updated', now, now));
				}
				if (inquiry) {
					newActivities.push(
						activity(next, 'inquiry', inquiryText(u.inquiryMessage ?? ''), now, now)
					);
				}
				updated += 1;
			}

			await contacts.bulkAdd(newContacts);
			await contacts.bulkPut([...changed.values()]);
			await activities.bulkAdd(newActivities);
			if (newContacts.length > 0 && !(await db.meta.get(META.firstRecordAt))) {
				await db.meta.put({ key: META.firstRecordAt, value: now });
			}
			return { added: newContacts.length, updated, skipped: plan.skipped + gone };
		});
	} catch (e) {
		throw e instanceof ImportCommitError ? e : new ImportCommitError(e);
	}
}
