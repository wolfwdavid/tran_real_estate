// The contacts CSV column contract (AGT-07): one module shared by export and import so a Tran
// export always re-imports to the same contacts.
//
// Byte decoding (UTF-8 fatal, windows-1252 fallback) is NOT here: core has no TextDecoder type.
// The web import flow decodes, checks MAX_CSV_BYTES, then hands text to parseCsv.
import * as z from 'zod/mini';

import {
	MAX_CONTACT_NOTES,
	MAX_EMAIL,
	MAX_NAME,
	MAX_PHONE,
	MAX_PROPERTY
} from '../agent/schemas.js';
import type { ConsentSource, Contact, ContactSource, IncomingLead, Stage } from '../agent/types.js';
import { CONTACT_SOURCES, isLive, STAGE_LABELS, STAGES } from '../agent/types.js';
import { cleanText, formatPhoneUS, normEmail, normPhoneUS } from '../leads/normalize.js';
import { toCsv, unescapeFormula } from './csv.js';

/** Data rows (after the header, blank rows ignored) accepted per import. Never truncate. */
export const MAX_CSV_ROWS = 5000;
/** File size checked before reading. */
export const MAX_CSV_BYTES = 5 * 1024 * 1024;

/**
 * Stable export header. UI-SPEC's added_at / last_contacted_at names plus RESEARCH's
 * consent_source / email_opt_out_at / id, which an exact Tran round trip and honoring
 * email opt-outs need.
 */
export const EXPORT_COLUMNS = Object.freeze([
	'name',
	'email',
	'phone',
	'stage',
	'source',
	'property_of_interest',
	'notes',
	'consent_source',
	'email_opt_out_at',
	'added_at',
	'last_contacted_at',
	'id'
] as const);
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

export const MAPPING_TARGETS = Object.freeze([
	'name',
	'firstName',
	'lastName',
	'email',
	'phone',
	'stage',
	'source',
	'propertyOfInterest',
	'notes',
	'consentSource',
	'emailOptOutAt',
	'createdAt',
	'lastContactedAt',
	'id',
	'skip'
] as const);
export type MappingTarget = (typeof MAPPING_TARGETS)[number];
type FieldTarget = Exclude<MappingTarget, 'skip'>;

export const MAPPING_LABELS: Readonly<Record<MappingTarget, string>> = Object.freeze({
	name: 'Name',
	firstName: 'First name',
	lastName: 'Last name',
	email: 'Email',
	phone: 'Phone',
	stage: 'Stage',
	source: 'Source',
	propertyOfInterest: 'Property of interest',
	notes: 'Notes',
	consentSource: 'Consent',
	emailOptOutAt: 'Opted out of email',
	createdAt: 'Added on',
	lastContactedAt: 'Last contact on',
	id: 'Tran ID',
	skip: "Don't import"
});

/** Normalized header (lowercase, alphanumerics only) to Tran field. */
const SYNONYMS: ReadonlyMap<string, FieldTarget> = new Map<string, FieldTarget>([
	...(['name', 'fullname', 'contact', 'contactname', 'client'] as const).map(
		(h) => [h, 'name'] as const
	),
	...(['firstname', 'first', 'givenname'] as const).map((h) => [h, 'firstName'] as const),
	...(['lastname', 'last', 'surname', 'familyname'] as const).map((h) => [h, 'lastName'] as const),
	...(['email', 'emailaddress', 'email1', 'primaryemail'] as const).map(
		(h) => [h, 'email'] as const
	),
	...(['phone', 'phonenumber', 'mobile', 'cell', 'phone1', 'mobilephone'] as const).map(
		(h) => [h, 'phone'] as const
	),
	...(['stage', 'status', 'pipelinestage'] as const).map((h) => [h, 'stage'] as const),
	...(['source', 'leadsource'] as const).map((h) => [h, 'source'] as const),
	...(['property', 'address', 'propertyofinterest'] as const).map(
		(h) => [h, 'propertyOfInterest'] as const
	),
	...(['notes', 'note', 'comments'] as const).map((h) => [h, 'notes'] as const),
	// Tran export headers, 1:1.
	['consentsource', 'consentSource'],
	['emailoptoutat', 'emailOptOutAt'],
	['addedat', 'createdAt'],
	['createdat', 'createdAt'],
	['lastcontactedat', 'lastContactedAt'],
	['id', 'id']
]);

const normHeader = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Suggests a target per CSV column. Unknown headers are 'skip', and a target already taken by an
 * earlier column is 'skip' for the later one. The user can change any of it.
 */
export function autoMap(headers: readonly string[]): MappingTarget[] {
	const taken = new Set<MappingTarget>();
	return headers.map((h) => {
		const t = SYNONYMS.get(normHeader(h));
		if (t === undefined || taken.has(t)) return 'skip';
		taken.add(t);
		return t;
	});
}

export type MappingError = 'need-name' | 'need-contact' | { kind: 'duplicate'; field: FieldTarget };

/** Name (or first + last name) and at least one of email/phone; each field mapped once. */
export function validateMapping(mapping: readonly MappingTarget[]): MappingError[] {
	const errors: MappingError[] = [];
	const has = (t: MappingTarget) => mapping.includes(t);
	if (!has('name') && !(has('firstName') && has('lastName'))) errors.push('need-name');
	if (!has('email') && !has('phone')) errors.push('need-contact');
	const seen = new Set<MappingTarget>();
	const reported = new Set<MappingTarget>();
	for (const t of mapping) {
		if (t === 'skip') continue;
		if (seen.has(t) && !reported.has(t)) {
			errors.push({ kind: 'duplicate', field: t });
			reported.add(t);
		}
		seen.add(t);
	}
	return errors;
}

/** 'too-long' extends the plan's reason list: a cell over a contact field cap. */
export type RowReason = 'no-name' | 'no-email-or-phone' | 'bad-email' | 'short-phone' | 'too-long';

export interface RowsToLeadsResult {
	leads: IncomingLead[];
	invalid: { row: number; reason: RowReason }[];
	unknownStages: { row: number; value: string }[];
}

export interface RowsToLeadsOptions {
	/** File line of the first data row (the header is line 1). */
	firstLine?: number;
	/** Opt-out stamp for a non-date "yes"-style opt-out cell. Defaults to the current time. */
	now?: Date;
}

const leadSchema = z.object({
	name: z.string().check(z.minLength(1), z.maxLength(MAX_NAME)),
	email: z.string().check(z.maxLength(MAX_EMAIL)),
	phone: z.string().check(z.maxLength(MAX_PHONE)),
	propertyOfInterest: z.string().check(z.maxLength(MAX_PROPERTY)),
	notes: z.string().check(z.maxLength(MAX_CONTACT_NOTES))
});
const isoSchema = z.iso.datetime();
const uuidSchema = z.string().check(z.uuid());
const isIso = (v: string): boolean => z.safeParse(isoSchema, v).success;

const STAGE_BY_TEXT: ReadonlyMap<string, Stage> = new Map(
	STAGES.flatMap((s) => [
		[s, s],
		[STAGE_LABELS[s].toLowerCase(), s]
	])
);
const IMPORTABLE_SOURCES: ReadonlySet<string> = new Set(
	CONTACT_SOURCES.filter((s) => s !== 'sample')
);
const OPT_OUT_NO = new Set(['no', 'n', 'false', '0', 'none']);

const isBlankRow = (row: readonly string[]): boolean =>
	row.every((cell) => cleanText(unescapeFormula(cell)) === '');

/**
 * Turns data rows (no header) into IncomingLeads. Each cell is formula-unescaped and cleaned.
 * Blank rows are skipped silently; invalid rows are listed by line with a reason; unknown stages
 * import as 'new' and are listed. Row numbers count records: a quoted cell with an embedded line
 * break is still one spreadsheet row.
 */
export function rowsToIncomingLeads(
	rows: readonly (readonly string[])[],
	mapping: readonly MappingTarget[],
	options: RowsToLeadsOptions = {}
): RowsToLeadsResult {
	const firstLine = options.firstLine ?? 2;
	const result: RowsToLeadsResult = { leads: [], invalid: [], unknownStages: [] };

	rows.forEach((row, index) => {
		if (isBlankRow(row)) return;
		const rowNumber = firstLine + index;
		const cells = new Map<FieldTarget, string>();
		mapping.forEach((t, col) => {
			if (t === 'skip' || cells.has(t)) return;
			cells.set(t, cleanText(unescapeFormula(row[col] ?? '')));
		});
		const get = (t: FieldTarget): string => cells.get(t) ?? '';
		const fail = (reason: RowReason) => result.invalid.push({ row: rowNumber, reason });

		const name =
			get('name') || [get('firstName'), get('lastName')].filter((p) => p !== '').join(' ');
		const email = get('email');
		const phone = get('phone');
		if (name === '') return fail('no-name');
		if (email === '' && phone === '') return fail('no-email-or-phone');
		if (email !== '' && normEmail(email) === null) return fail('bad-email');
		if (phone !== '' && phone.replace(/\D/g, '').length < 10) return fail('short-phone');

		const fields = {
			name,
			email,
			phone,
			propertyOfInterest: get('propertyOfInterest'),
			notes: get('notes')
		};
		if (!z.safeParse(leadSchema, fields).success) return fail('too-long');

		const sourceText = get('source').toLowerCase();
		const lead: IncomingLead = {
			rowNumber,
			...fields,
			source: (IMPORTABLE_SOURCES.has(sourceText) ? sourceText : 'csv') as ContactSource,
			consentSource: (get('consentSource').toLowerCase() === 'inquiry-form'
				? 'inquiry-form'
				: 'unknown') as ConsentSource
		};

		const stageText = get('stage');
		if (stageText !== '') {
			const stage = STAGE_BY_TEXT.get(stageText.toLowerCase());
			if (stage) lead.stage = stage;
			else {
				lead.stage = 'new';
				lead.unknownStage = stageText;
				result.unknownStages.push({ row: rowNumber, value: stageText });
			}
		}

		if (cells.has('id')) {
			const id = get('id');
			if (z.safeParse(uuidSchema, id).success) lead.id = id;
		}
		if (cells.has('createdAt') && isIso(get('createdAt'))) lead.createdAt = get('createdAt');
		if (cells.has('lastContactedAt')) {
			const v = get('lastContactedAt');
			lead.lastContactedAt = isIso(v) ? v : null;
		}
		if (cells.has('emailOptOutAt')) {
			// Opt-outs are honored conservatively: any non-empty value that is not a clear "no"
			// counts as opted out (CAN-SPAM); a non-date marker is stamped with `now`.
			const v = get('emailOptOutAt');
			if (v === '' || OPT_OUT_NO.has(v.toLowerCase())) lead.emailOptOutAt = null;
			else lead.emailOptOutAt = isIso(v) ? v : (options.now ?? new Date()).toISOString();
		}

		result.leads.push(lead);
	});

	return result;
}

/** Data rows after the header, ignoring fully blank rows. */
export function countDataRows(rows: readonly (readonly string[])[]): number {
	return rows.slice(1).filter((r) => !isBlankRow(r)).length;
}

/** ok when count is within MAX_CSV_ROWS; over the cap the file is rejected, never truncated. */
export function checkRowCap(count: number): { ok: boolean; count: number } {
	return { ok: count <= MAX_CSV_ROWS, count };
}

const exportPhone = (raw: string): string => {
	const e164 = normPhoneUS(raw);
	// National format: E.164 '+1...' would be formula-escaped and coerced to a number by Excel.
	return e164 !== null && e164.startsWith('+1') ? formatPhoneUS(e164) : raw;
};

/**
 * The contacts CSV: BOM, one header row, one row per live non-sample contact ordered by createdAt
 * (stable for ties). No disclosure row: this is a private data file meant for re-import.
 */
export function exportContactsCsv(contacts: readonly Contact[]): string {
	const rows = contacts
		.filter((c) => !c.sample && isLive(c))
		.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
		.map((c): string[] => [
			c.name,
			c.email,
			exportPhone(c.phone),
			c.stage,
			c.source,
			c.propertyOfInterest,
			c.notes,
			c.consentSource,
			c.emailOptOutAt ?? '',
			c.createdAt,
			c.lastContactedAt ?? '',
			c.id
		]);
	return toCsv([[...EXPORT_COLUMNS], ...rows]);
}
