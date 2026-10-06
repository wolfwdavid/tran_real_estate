// Agent record schemas: the trust boundary for backups and imported files.
//
// Each schema extends the shared SyncableSchema (uuid id, ISO createdAt/updatedAt, schemaVersion,
// OPTIONAL ISO deletedAt; null is rejected). The profile is a singleton whose id is the literal
// 'profile' instead of a uuid.
import * as z from 'zod/mini';

import { SyncableSchema } from '../syncable.js';
import {
	ACTIVITY_TYPES,
	CONSENT_SOURCES,
	CONTACT_SOURCES,
	LICENSE_TYPES,
	STAGES
} from './types.js';

export const MAX_NAME = 120;
export const MAX_EMAIL = 254;
export const MAX_PHONE = 40;
export const MAX_PROPERTY = 300;
export const MAX_CONTACT_NOTES = 2000;
export const MAX_TASK_TITLE = 120;
export const MAX_ACTIVITY_TEXT = 400;
export const MAX_LOGO_BASE64 = 700_000;
export const MAX_LOGO_BYTES = 524_288;

const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX6_OR_EMPTY = /^(#[0-9A-Fa-f]{6})?$/;
const UUID_OR_EMPTY =
	/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})?$/;

const capped = (max: number) => z.string().check(z.maxLength(max));
const isoNullable = z.nullable(z.iso.datetime());
const stage = z.enum(STAGES);

export const contactSchema = z.extend(SyncableSchema, {
	name: capped(MAX_NAME),
	email: capped(MAX_EMAIL),
	emailNorm: z.optional(capped(MAX_EMAIL)),
	phone: capped(MAX_PHONE),
	phoneNorm: z.optional(capped(MAX_PHONE)),
	stage,
	stageChangedAt: z.iso.datetime(),
	source: z.enum(CONTACT_SOURCES),
	propertyOfInterest: capped(MAX_PROPERTY),
	notes: capped(MAX_CONTACT_NOTES),
	consentSource: z.enum(CONSENT_SOURCES),
	emailOptOutAt: isoNullable,
	lastContactedAt: isoNullable,
	sample: z.boolean()
});

export const taskSchema = z.extend(SyncableSchema, {
	contactId: z.string().check(z.minLength(1)),
	title: capped(MAX_TASK_TITLE),
	dueDate: z.string().check(z.regex(DUE_DATE)),
	status: z.enum(['open', 'done']),
	doneAt: isoNullable,
	sample: z.boolean()
});

export const activitySchema = z.extend(SyncableSchema, {
	contactId: z.string().check(z.minLength(1)),
	type: z.enum(ACTIVITY_TYPES),
	text: capped(MAX_ACTIVITY_TEXT),
	at: z.iso.datetime(),
	fromStage: z.optional(stage),
	toStage: z.optional(stage),
	taskId: z.optional(z.string()),
	sample: z.boolean()
});

const logoSchema = z.object({
	base64: capped(MAX_LOGO_BASE64),
	mime: z.literal('image/png'),
	width: z.number().check(z.int(), z.positive()),
	height: z.number().check(z.int(), z.positive()),
	bytes: z.number().check(z.int(), z.positive(), z.lte(MAX_LOGO_BYTES))
});

export const agentProfileSchema = z.extend(SyncableSchema, {
	id: z.literal('profile'),
	name: capped(MAX_NAME),
	brokerage: capped(MAX_NAME),
	teamName: capped(MAX_NAME),
	licenseType: z.union([z.enum(LICENSE_TYPES), z.literal('')]),
	licenseNumber: capped(MAX_PHONE),
	licenseState: z.string().check(z.regex(/^([A-Z]{2})?$/)),
	brokerageLicenseNumber: capped(MAX_PHONE),
	brokeragePhone: capped(MAX_PHONE),
	phone: capped(MAX_PHONE),
	email: capped(MAX_EMAIL),
	website: capped(MAX_PROPERTY),
	iabsUrl: capped(MAX_PROPERTY),
	postal: z.object({
		street: capped(MAX_NAME),
		line2: capped(MAX_NAME),
		city: capped(MAX_NAME),
		state: z.string().check(z.regex(/^([A-Z]{2})?$/)),
		zip: z.string().check(z.regex(/^(\d{5}(-\d{4})?)?$/))
	}),
	brandPrimary: z.string().check(z.regex(HEX6_OR_EMPTY)),
	brandAccent: z.string().check(z.regex(HEX6_OR_EMPTY)),
	logo: z.nullable(logoSchema),
	web3formsAccessKey: z.string().check(z.regex(UUID_OR_EMPTY))
});
