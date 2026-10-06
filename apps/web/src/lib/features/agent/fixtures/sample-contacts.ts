// Sample contacts for the keyless CRM demo (08-CONTEXT "Sample contacts fixture"). Hand-authored
// and fully synthetic: every email is @example.com and every phone is a 555-01xx number, which the
// real-data guard (scripts/guard-real-data.mjs) enforces for this fixtures/ path.
//
// Every record carries `sample: true`. Ids are fixed v4-shaped uuids (the backup envelope requires
// uuid ids), so Undo and tests are stable. Dates are relative to the caller's `today` (local
// YYYY-MM-DD) and `now` (ISO), so the demo always shows 2 overdue, 3 due-today and 4 upcoming tasks.
import { addDays } from '@tran/core/crm';
import type { Activity, Contact, Stage, Task } from '@tran/core/agent/types';
import { STAGE_LABELS } from '@tran/core/agent/types';
import { AGENT_RECORD_SCHEMA_VERSION } from '$lib/storage/agent/tables';
import { buildContactRecord, ADDED_TEXT } from '$lib/storage/agent/contacts-repo';

export interface SampleData {
	contacts: Contact[];
	tasks: Task[];
	activities: Activity[];
}

const DAY_MS = 86_400_000;

/** Fixed sample ids: kind 1 = contact, 2 = task, 3 = activity. */
export const sampleId = (kind: 1 | 2 | 3, n: number): string =>
	`5a3b1e00-0000-4000-8${kind}00-${String(n).padStart(12, '0')}`;

/** True for any id minted by sampleId (used to keep loading idempotent). */
export const SAMPLE_ID_PREFIX = '5a3b1e00-0000-4000-8';

interface Row {
	name: string;
	email: string;
	phone: string;
	stage: Stage;
	source: Contact['source'];
	consent: Contact['consentSource'];
	createdDaysAgo: number;
	contactedDaysAgo: number | null;
	property: string;
	notes?: string;
	optOutDaysAgo?: number;
}

const ROWS: readonly Row[] = [
	{
		name: 'Jordan Example',
		email: 'jordan@example.com',
		phone: '(555) 555-0101',
		stage: 'new',
		source: 'inquiry',
		consent: 'inquiry-form',
		createdDaysAgo: 1,
		contactedDaysAgo: null,
		property: '12 Sample Lane, Harlow Springs',
		notes: 'Prefers email. Looking for a 2-bedroom near the park.'
	},
	{
		name: 'Riley Sample',
		email: 'riley@example.com',
		phone: '(555) 555-0102',
		stage: 'new',
		source: 'paste',
		consent: 'unknown',
		createdDaysAgo: 3,
		contactedDaysAgo: null,
		property: ''
	},
	{
		name: 'Casey Placeholder',
		email: 'casey@example.com',
		phone: '',
		stage: 'new',
		source: 'manual',
		consent: 'unknown',
		createdDaysAgo: 9,
		contactedDaysAgo: null,
		property: '40 Example Court'
	},
	{
		name: 'Morgan Demo',
		email: '',
		phone: '(555) 555-0104',
		stage: 'new',
		source: 'csv',
		consent: 'unknown',
		createdDaysAgo: 2,
		contactedDaysAgo: null,
		property: ''
	},
	{
		name: 'Taylor Mockridge',
		email: 'taylor@example.com',
		phone: '(555) 555-0105',
		stage: 'contacted',
		source: 'inquiry',
		consent: 'inquiry-form',
		createdDaysAgo: 12,
		contactedDaysAgo: 2,
		property: '7 Fixture Road'
	},
	{
		name: 'Quinn Sampleton',
		email: 'quinn@example.com',
		phone: '(555) 555-0106',
		stage: 'contacted',
		source: 'manual',
		consent: 'unknown',
		createdDaysAgo: 20,
		contactedDaysAgo: 10,
		property: ''
	},
	{
		name: 'Harper Fixture',
		email: 'harper@example.com',
		phone: '(555) 555-0107',
		stage: 'contacted',
		source: 'paste',
		consent: 'unknown',
		createdDaysAgo: 15,
		contactedDaysAgo: 8,
		property: '88 Specimen Avenue'
	},
	{
		name: 'Drew Exampleton',
		email: 'drew@example.com',
		phone: '(555) 555-0108',
		stage: 'touring',
		source: 'inquiry',
		consent: 'inquiry-form',
		createdDaysAgo: 25,
		contactedDaysAgo: 1,
		property: '12 Sample Lane, Harlow Springs'
	},
	{
		name: 'Sydney Testa',
		email: 'sydney@example.com',
		phone: '(555) 555-0109',
		stage: 'touring',
		source: 'manual',
		consent: 'unknown',
		createdDaysAgo: 30,
		contactedDaysAgo: 4,
		property: '3 Placeholder Place'
	},
	{
		name: 'Rowan Specimen',
		email: 'rowan@example.com',
		phone: '(555) 555-0110',
		stage: 'offer',
		source: 'inquiry',
		consent: 'inquiry-form',
		createdDaysAgo: 40,
		contactedDaysAgo: 3,
		property: '19 Demo Drive'
	},
	{
		name: 'Emerson Draft',
		email: 'emerson@example.com',
		phone: '(555) 555-0111',
		stage: 'offer',
		source: 'csv',
		consent: 'unknown',
		createdDaysAgo: 45,
		contactedDaysAgo: 6,
		property: '',
		optOutDaysAgo: 5
	},
	{
		name: 'Logan Pilot',
		email: 'logan@example.com',
		phone: '(555) 555-0112',
		stage: 'closed',
		source: 'manual',
		consent: 'unknown',
		createdDaysAgo: 60,
		contactedDaysAgo: 14,
		property: '55 Mock Street'
	}
];

/** [contact row index (0-based), title, due offset in days from today] */
const TASKS: readonly [number, string, number][] = [
	[1, 'Call about financing pre-approval', -2],
	[5, 'Send the Oak Street listing details', -1],
	[0, 'Reply to the Saturday tour question', 0],
	[7, 'Confirm the second showing time', 0],
	[9, 'Check in on the offer response', 0],
	[4, 'Share three new listings', 1],
	[8, 'Follow up after the tour', 2],
	[6, 'Ask about move-in timing', 4],
	[11, 'Send a one-year home anniversary note', 7]
];

/**
 * Builds the 12 sample contacts with their tasks and activities.
 * @param today local calendar date (YYYY-MM-DD) the task due dates are relative to
 * @param now ISO timestamp the created / contacted times are relative to
 */
export function buildSampleData(today: string, now: string): SampleData {
	const nowMs = Date.parse(now);
	const ago = (days: number) => new Date(nowMs - days * DAY_MS).toISOString();
	const syncable = (id: string, at: string) => ({
		id,
		ownerId: 'local' as const,
		createdAt: at,
		updatedAt: at,
		schemaVersion: AGENT_RECORD_SCHEMA_VERSION
	});

	const contacts: Contact[] = [];
	const activities: Activity[] = [];
	let actN = 0;
	const act = (
		c: Contact,
		type: Activity['type'],
		text: string,
		at: string,
		extra: Partial<Activity> = {}
	) => {
		activities.push({
			...syncable(sampleId(3, ++actN), at),
			contactId: c.id,
			type,
			text,
			at,
			sample: true,
			...extra
		});
	};

	ROWS.forEach((r, i) => {
		const createdAt = ago(r.createdDaysAgo);
		const lastContactedAt = r.contactedDaysAgo === null ? null : ago(r.contactedDaysAgo);
		const emailOptOutAt = r.optOutDaysAgo === undefined ? null : ago(r.optOutDaysAgo);
		const base = buildContactRecord(
			{
				id: sampleId(1, i + 1),
				name: r.name,
				email: r.email,
				phone: r.phone,
				propertyOfInterest: r.property,
				notes: r.notes ?? '',
				source: r.source,
				consentSource: r.consent,
				stage: r.stage,
				createdAt,
				lastContactedAt,
				emailOptOutAt,
				sample: true
			},
			createdAt
		);
		// Past New: the stage change happened one day after the contact was added.
		const stageChangedAt = r.stage === 'new' ? createdAt : ago(r.createdDaysAgo - 1);
		const updatedAt = [createdAt, stageChangedAt, lastContactedAt, emailOptOutAt]
			.filter((x): x is string => x !== null)
			.sort()
			.at(-1) as string;
		const c: Contact = { ...base, stageChangedAt, updatedAt };
		contacts.push(c);

		act(c, 'added', ADDED_TEXT.sample, createdAt);
		if (r.source === 'inquiry' && i === 0) {
			act(c, 'inquiry', 'Inquiry received: "Could we tour on Saturday morning?"', createdAt);
		}
		if (r.stage !== 'new') {
			act(c, 'stage_changed', `Moved from New to ${STAGE_LABELS[r.stage]}`, stageChangedAt, {
				fromStage: 'new',
				toStage: r.stage
			});
		}
		if (lastContactedAt) act(c, 'call', 'Logged a call', lastContactedAt);
		if (emailOptOutAt) act(c, 'opt_out_set', 'Asked not to get emails', emailOptOutAt);
	});

	const tasks: Task[] = TASKS.map(([row, title, offset], i) => ({
		...syncable(sampleId(2, i + 1), now),
		contactId: contacts[row].id,
		title,
		dueDate: addDays(today, offset),
		status: 'open',
		doneAt: null,
		sample: true
	}));

	return { contacts, tasks, activities };
}
