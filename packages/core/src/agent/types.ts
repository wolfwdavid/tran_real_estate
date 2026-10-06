// Agent portal record contracts (Phase 8). Types and constants only, no logic beyond isLive.
//
// Every Phase 8 module (core and web) codes against these names.
//
// Decisions:
// - The logo is stored as base64 PNG (not a Blob or Uint8Array) so backups and fake-indexeddb
//   need no conversion and the Phase 3 backup registry needs no hooks.
// - `sample` is never indexed: IndexedDB cannot index booleans.
// - Opt-out is a single `emailOptOutAt` timestamp; "opted out" means `emailOptOutAt !== null`.
// - The Web3Forms key field is `web3formsAccessKey`.
// - Liveness: deletedAt is OMITTED on live rows (never null); test with isLive.
import type { Syncable as SyncableFields } from '../syncable.js';

export type { SyncableFields };

export const STAGES = ['new', 'contacted', 'touring', 'offer', 'closed'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Readonly<Record<Stage, string>> = Object.freeze({
	new: 'New',
	contacted: 'Contacted',
	touring: 'Touring',
	offer: 'Offer',
	closed: 'Closed'
});

export const CONTACT_SOURCES = ['inquiry', 'paste', 'manual', 'csv', 'sample'] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];
export const SOURCE_LABELS: Readonly<Record<ContactSource, string>> = Object.freeze({
	inquiry: 'Inquiry page',
	paste: 'Pasted email',
	manual: 'Added by hand',
	csv: 'CSV import',
	sample: 'Sample'
});

export const CONSENT_SOURCES = ['inquiry-form', 'unknown'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const LICENSE_TYPES = [
	'salesperson',
	'associate-broker',
	'broker',
	'sales-associate'
] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];
export const LICENSE_TYPE_LABELS: Readonly<Record<LicenseType, string>> = Object.freeze({
	salesperson: 'Salesperson',
	'associate-broker': 'Associate broker',
	broker: 'Broker',
	'sales-associate': 'Sales associate'
});

export const ACTIVITY_TYPES = [
	'added',
	'stage_changed',
	'task_done',
	'draft_sent',
	'details_updated',
	'opt_out_set',
	'opt_out_cleared',
	'inquiry',
	'call',
	'email',
	'meeting',
	'other',
	'note'
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * Activity types that count as contact and update lastContactedAt (UI-SPEC SmartListFilter rule).
 * Stage moves, notes and task completion do NOT.
 */
export const CONTACT_MAKING: ReadonlySet<ActivityType> = new Set<ActivityType>([
	'call',
	'email',
	'meeting',
	'other',
	'draft_sent'
]);

/** All 50 states plus DC, alphabetical by name. */
export const US_STATES: readonly { code: string; name: string }[] = Object.freeze([
	{ code: 'AL', name: 'Alabama' },
	{ code: 'AK', name: 'Alaska' },
	{ code: 'AZ', name: 'Arizona' },
	{ code: 'AR', name: 'Arkansas' },
	{ code: 'CA', name: 'California' },
	{ code: 'CO', name: 'Colorado' },
	{ code: 'CT', name: 'Connecticut' },
	{ code: 'DE', name: 'Delaware' },
	{ code: 'DC', name: 'District of Columbia' },
	{ code: 'FL', name: 'Florida' },
	{ code: 'GA', name: 'Georgia' },
	{ code: 'HI', name: 'Hawaii' },
	{ code: 'ID', name: 'Idaho' },
	{ code: 'IL', name: 'Illinois' },
	{ code: 'IN', name: 'Indiana' },
	{ code: 'IA', name: 'Iowa' },
	{ code: 'KS', name: 'Kansas' },
	{ code: 'KY', name: 'Kentucky' },
	{ code: 'LA', name: 'Louisiana' },
	{ code: 'ME', name: 'Maine' },
	{ code: 'MD', name: 'Maryland' },
	{ code: 'MA', name: 'Massachusetts' },
	{ code: 'MI', name: 'Michigan' },
	{ code: 'MN', name: 'Minnesota' },
	{ code: 'MS', name: 'Mississippi' },
	{ code: 'MO', name: 'Missouri' },
	{ code: 'MT', name: 'Montana' },
	{ code: 'NE', name: 'Nebraska' },
	{ code: 'NV', name: 'Nevada' },
	{ code: 'NH', name: 'New Hampshire' },
	{ code: 'NJ', name: 'New Jersey' },
	{ code: 'NM', name: 'New Mexico' },
	{ code: 'NY', name: 'New York' },
	{ code: 'NC', name: 'North Carolina' },
	{ code: 'ND', name: 'North Dakota' },
	{ code: 'OH', name: 'Ohio' },
	{ code: 'OK', name: 'Oklahoma' },
	{ code: 'OR', name: 'Oregon' },
	{ code: 'PA', name: 'Pennsylvania' },
	{ code: 'RI', name: 'Rhode Island' },
	{ code: 'SC', name: 'South Carolina' },
	{ code: 'SD', name: 'South Dakota' },
	{ code: 'TN', name: 'Tennessee' },
	{ code: 'TX', name: 'Texas' },
	{ code: 'UT', name: 'Utah' },
	{ code: 'VT', name: 'Vermont' },
	{ code: 'VA', name: 'Virginia' },
	{ code: 'WA', name: 'Washington' },
	{ code: 'WV', name: 'West Virginia' },
	{ code: 'WI', name: 'Wisconsin' },
	{ code: 'WY', name: 'Wyoming' }
]);

/** Tombstones carry deletedAt; live rows omit it. */
export const isLive = (r: { deletedAt?: string }): boolean => r.deletedAt === undefined;

export interface Contact extends SyncableFields {
	name: string;
	email: string;
	emailNorm?: string;
	phone: string;
	phoneNorm?: string;
	stage: Stage;
	stageChangedAt: string;
	source: ContactSource;
	propertyOfInterest: string;
	notes: string;
	consentSource: ConsentSource;
	emailOptOutAt: string | null;
	lastContactedAt: string | null;
	sample: boolean;
}

export interface Task extends SyncableFields {
	contactId: string;
	title: string;
	/** Local calendar date, YYYY-MM-DD. */
	dueDate: string;
	status: 'open' | 'done';
	doneAt: string | null;
	sample: boolean;
}

export interface Activity extends SyncableFields {
	contactId: string;
	type: ActivityType;
	text: string;
	at: string;
	fromStage?: Stage;
	toStage?: Stage;
	taskId?: string;
	sample: boolean;
}

export interface PostalAddress {
	street: string;
	line2: string;
	city: string;
	state: string;
	zip: string;
}

/** Base64 PNG (see the decision note at the top of this file). */
export interface StoredLogo {
	base64: string;
	mime: 'image/png';
	width: number;
	height: number;
	bytes: number;
}

export interface AgentProfile extends SyncableFields {
	id: 'profile';
	name: string;
	brokerage: string;
	teamName: string;
	licenseType: LicenseType | '';
	licenseNumber: string;
	licenseState: string;
	brokerageLicenseNumber: string;
	brokeragePhone: string;
	phone: string;
	email: string;
	website: string;
	iabsUrl: string;
	postal: PostalAddress;
	brandPrimary: string;
	brandAccent: string;
	logo: StoredLogo | null;
	web3formsAccessKey: string;
}

export type ProfileInput = Omit<AgentProfile, Exclude<keyof SyncableFields, 'id'>>;

/** A contact as typed into quick add or the edit form, before Syncable fields are stamped. */
export type ContactDraft = Pick<
	Contact,
	'name' | 'email' | 'phone' | 'propertyOfInterest' | 'notes' | 'stage'
>;

/**
 * One lead on its way into the CRM (paste, CSV, quick add).
 * rowNumber is 1-based (CSV: file line; paste: block order).
 */
export interface IncomingLead {
	rowNumber: number;
	name: string;
	email: string;
	phone: string;
	propertyOfInterest: string;
	notes: string;
	stage?: Stage;
	unknownStage?: string;
	source: ContactSource;
	consentSource: ConsentSource;
	message?: string;
	id?: string;
	createdAt?: string;
	lastContactedAt?: string | null;
	emailOptOutAt?: string | null;
}

export const EMPTY_PROFILE_INPUT: ProfileInput = Object.freeze({
	id: 'profile',
	name: '',
	brokerage: '',
	teamName: '',
	licenseType: '',
	licenseNumber: '',
	licenseState: '',
	brokerageLicenseNumber: '',
	brokeragePhone: '',
	phone: '',
	email: '',
	website: '',
	iabsUrl: '',
	postal: Object.freeze({ street: '', line2: '', city: '', state: '', zip: '' }),
	brandPrimary: '',
	brandAccent: '',
	logo: null,
	web3formsAccessKey: ''
}) as ProfileInput;
