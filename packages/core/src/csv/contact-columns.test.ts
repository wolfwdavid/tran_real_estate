import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Contact } from '../agent/types.js';
import { CONSENT_SOURCES, CONTACT_SOURCES, STAGES } from '../agent/types.js';
import { cleanText, normPhoneUS } from '../leads/normalize.js';
import {
	autoMap,
	checkRowCap,
	countDataRows,
	EXPORT_COLUMNS,
	exportContactsCsv,
	MAPPING_LABELS,
	MAPPING_TARGETS,
	MAX_CSV_BYTES,
	MAX_CSV_ROWS,
	type MappingTarget,
	rowsToIncomingLeads,
	validateMapping
} from './contact-columns.js';
import { parseCsv, toCsv } from './csv.js';

const BOM = '\uFEFF';
const ID_A = '0b6f1e52-5b8e-4c1a-9d7e-2f4a6c8e0a11';
const ID_B = '1c7a2f63-6c9f-4d2b-8e8f-3a5b7d9f1b22';
const ID_C = '2d8b3a74-7daa-4e3c-9f90-4b6c8eaa2c33';

function contact(over: Partial<Contact> = {}): Contact {
	return {
		id: ID_A,
		ownerId: 'local',
		createdAt: '2026-09-01T12:00:00.000Z',
		updatedAt: '2026-09-01T12:00:00.000Z',
		schemaVersion: 1,
		name: 'Jo Rivera',
		email: 'jo@example.com',
		phone: '555-555-0142',
		stage: 'touring',
		stageChangedAt: '2026-09-01T12:00:00.000Z',
		source: 'csv',
		propertyOfInterest: '12 Sample St',
		notes: 'Likes yards',
		consentSource: 'unknown',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false,
		...over
	};
}

describe('constants', () => {
	it('exports the reconciled column order', () => {
		expect(EXPORT_COLUMNS).toEqual([
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
		]);
	});

	it('exports mapping targets and labels', () => {
		expect(MAPPING_TARGETS).toEqual([
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
		]);
		expect(MAPPING_LABELS.skip).toBe("Don't import");
		expect(MAPPING_LABELS.consentSource).toBe('Consent');
		expect(MAPPING_LABELS.emailOptOutAt).toBe('Opted out of email');
		expect(MAPPING_LABELS.createdAt).toBe('Added on');
		expect(MAPPING_LABELS.lastContactedAt).toBe('Last contact on');
		expect(MAPPING_LABELS.id).toBe('Tran ID');
		for (const t of MAPPING_TARGETS) expect(MAPPING_LABELS[t]).toBeTruthy();
	});

	it('caps rows at 5,000 and bytes at 5 MB', () => {
		expect(MAX_CSV_ROWS).toBe(5000);
		expect(MAX_CSV_BYTES).toBe(5 * 1024 * 1024);
	});
});

describe('exportContactsCsv', () => {
	it('writes the BOM, one header row and one row per contact', () => {
		const csv = exportContactsCsv([contact()]);
		expect(csv.startsWith(BOM)).toBe(true);
		expect(csv).toBe(
			toCsv([
				[...EXPORT_COLUMNS],
				[
					'Jo Rivera',
					'jo@example.com',
					'(555) 555-0142',
					'touring',
					'csv',
					'12 Sample St',
					'Likes yards',
					'unknown',
					'',
					'2026-09-01T12:00:00.000Z',
					'',
					ID_A
				]
			])
		);
		const rows = parseCsv(csv);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
	});

	it('excludes sample and tombstoned contacts', () => {
		const rows = parseCsv(
			exportContactsCsv([
				contact({ id: ID_A, sample: true }),
				contact({ id: ID_B, deletedAt: '2026-09-02T12:00:00.000Z' }),
				contact({ id: ID_C })
			])
		);
		expect(rows).toHaveLength(2);
		expect(rows[1]?.[11]).toBe(ID_C);
	});

	it('writes only the header when nothing is exportable', () => {
		expect(parseCsv(exportContactsCsv([contact({ sample: true })]))).toEqual([[...EXPORT_COLUMNS]]);
	});

	it('orders rows by createdAt ascending', () => {
		const rows = parseCsv(
			exportContactsCsv([
				contact({ id: ID_A, createdAt: '2026-09-03T00:00:00.000Z' }),
				contact({ id: ID_B, createdAt: '2026-09-01T00:00:00.000Z' }),
				contact({ id: ID_C, createdAt: '2026-09-02T00:00:00.000Z' })
			])
		);
		expect(rows.slice(1).map((r) => r[11])).toEqual([ID_B, ID_C, ID_A]);
	});

	it('exports raw phones that do not normalize to +1 and keeps stored dates', () => {
		const rows = parseCsv(
			exportContactsCsv([
				contact({
					phone: '555-0101',
					emailOptOutAt: '2026-09-05T10:00:00.000Z',
					lastContactedAt: '2026-09-04T09:00:00.000Z',
					consentSource: 'inquiry-form',
					source: 'inquiry',
					stage: 'offer'
				})
			])
		);
		expect(rows[1]).toEqual([
			'Jo Rivera',
			'jo@example.com',
			'555-0101',
			'offer',
			'inquiry',
			'12 Sample St',
			'Likes yards',
			'inquiry-form',
			'2026-09-05T10:00:00.000Z',
			'2026-09-01T12:00:00.000Z',
			'2026-09-04T09:00:00.000Z',
			ID_A
		]);
	});

	it('escapes formula cells', () => {
		const csv = exportContactsCsv([contact({ notes: '=HYPERLINK("http://example.com")' })]);
		expect(csv).toContain(`"'=HYPERLINK(""http://example.com"")"`);
	});
});

describe('autoMap', () => {
	it('maps common CRM headers', () => {
		expect(autoMap(['Full Name', 'E-mail', 'Mobile', 'Status'])).toEqual([
			'name',
			'email',
			'phone',
			'stage'
		]);
	});

	it.each<[string, MappingTarget]>([
		['Name', 'name'],
		['Contact Name', 'name'],
		['contact', 'name'],
		['Client', 'name'],
		['First Name', 'firstName'],
		['first', 'firstName'],
		['Given Name', 'firstName'],
		['Last Name', 'lastName'],
		['Surname', 'lastName'],
		['Family Name', 'lastName'],
		['last', 'lastName'],
		['Email Address', 'email'],
		['Email 1', 'email'],
		['Primary Email', 'email'],
		['Phone Number', 'phone'],
		['Cell', 'phone'],
		['Phone 1', 'phone'],
		['Mobile Phone', 'phone'],
		['Pipeline Stage', 'stage'],
		['Lead Source', 'source'],
		['Source', 'source'],
		['Property', 'propertyOfInterest'],
		['Address', 'propertyOfInterest'],
		['Property of Interest', 'propertyOfInterest'],
		['Comments', 'notes'],
		['Note', 'notes'],
		['consent_source', 'consentSource'],
		['email_opt_out_at', 'emailOptOutAt'],
		['added_at', 'createdAt'],
		['last_contacted_at', 'lastContactedAt'],
		['id', 'id'],
		['Favorite color', 'skip'],
		['', 'skip']
	])('maps %j to %s', (header, target) => {
		expect(autoMap([header])).toEqual([target]);
	});

	it('maps the Tran export header 1:1', () => {
		expect(autoMap(EXPORT_COLUMNS)).toEqual([
			'name',
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
			'id'
		]);
	});

	it('skips a later column whose target is already taken', () => {
		expect(autoMap(['Email', 'E-mail', 'Phone', 'Mobile'])).toEqual([
			'email',
			'skip',
			'phone',
			'skip'
		]);
	});
});

describe('validateMapping', () => {
	it('accepts name plus email', () => {
		expect(validateMapping(['name', 'email'])).toEqual([]);
	});

	it('accepts first + last name plus phone', () => {
		expect(validateMapping(['firstName', 'lastName', 'phone', 'skip', 'skip'])).toEqual([]);
	});

	it('needs a name', () => {
		expect(validateMapping(['email'])).toEqual(['need-name']);
		expect(validateMapping(['firstName', 'email'])).toEqual(['need-name']);
		expect(validateMapping(['lastName', 'email'])).toEqual(['need-name']);
	});

	it('needs an email or phone', () => {
		expect(validateMapping(['name', 'notes'])).toEqual(['need-contact']);
	});

	it('reports duplicate targets once each, ignoring skip', () => {
		expect(validateMapping(['name', 'email', 'email', 'email', 'skip', 'skip'])).toEqual([
			{ kind: 'duplicate', field: 'email' }
		]);
	});

	it('reports every problem at once', () => {
		expect(validateMapping(['notes', 'notes'])).toEqual([
			'need-name',
			'need-contact',
			{ kind: 'duplicate', field: 'notes' }
		]);
	});
});

describe('rowsToIncomingLeads', () => {
	const mapping: MappingTarget[] = ['name', 'email', 'phone', 'stage', 'notes'];

	it('builds leads with file line numbers', () => {
		const r = rowsToIncomingLeads(
			[
				['Jo Rivera', 'jo@example.com', '555-555-0142', 'Touring', 'hi'],
				['Sam Lee', '', '555-555-0143', '', '']
			],
			mapping,
			{ firstLine: 2 }
		);
		expect(r.invalid).toEqual([]);
		expect(r.unknownStages).toEqual([]);
		expect(r.leads).toHaveLength(2);
		expect(r.leads[0]).toMatchObject({
			rowNumber: 2,
			name: 'Jo Rivera',
			email: 'jo@example.com',
			phone: '555-555-0142',
			stage: 'touring',
			notes: 'hi',
			source: 'csv',
			consentSource: 'unknown',
			propertyOfInterest: ''
		});
		expect(r.leads[1]?.rowNumber).toBe(3);
		expect(r.leads[1]?.stage).toBeUndefined();
	});

	it('defaults firstLine to 2', () => {
		const r = rowsToIncomingLeads([['Jo', 'jo@example.com', '', '', '']], mapping);
		expect(r.leads[0]?.rowNumber).toBe(2);
	});

	it('joins first and last name with one space', () => {
		const r = rowsToIncomingLeads(
			[
				['  Jo ', ' Rivera', 'jo@example.com'],
				['', 'Lee', 'lee@example.com']
			],
			['firstName', 'lastName', 'email']
		);
		expect(r.leads.map((l) => l.name)).toEqual(['Jo Rivera', 'Lee']);
	});

	it('skips fully blank rows without counting them', () => {
		const r = rowsToIncomingLeads(
			[['', ' ', '', '', ''], ['Jo', 'jo@example.com', '', '', ''], []],
			mapping
		);
		expect(r.leads).toHaveLength(1);
		expect(r.leads[0]?.rowNumber).toBe(3);
		expect(r.invalid).toEqual([]);
	});

	it('lists invalid rows by line with a reason', () => {
		const r = rowsToIncomingLeads(
			[
				['', 'jo@example.com', '', '', ''],
				['Jo', '', '', '', 'notes only'],
				['Jo', 'not-an-email', '', '', ''],
				['Jo', '', '555-0101', '', ''],
				['Jo', 'jo@example.com', '', '', '']
			],
			mapping,
			{ firstLine: 2 }
		);
		expect(r.invalid).toEqual([
			{ row: 2, reason: 'no-name' },
			{ row: 3, reason: 'no-email-or-phone' },
			{ row: 4, reason: 'bad-email' },
			{ row: 5, reason: 'short-phone' }
		]);
		expect(r.leads.map((l) => l.rowNumber)).toEqual([6]);
	});

	it('rejects rows over the field caps', () => {
		const r = rowsToIncomingLeads(
			[
				['x'.repeat(121), 'jo@example.com', '', '', ''],
				['x'.repeat(120), 'jo@example.com', '', '', 'n'.repeat(2001)],
				['x'.repeat(120), 'jo@example.com', '', '', 'n'.repeat(2000)]
			],
			mapping
		);
		expect(r.invalid).toEqual([
			{ row: 2, reason: 'too-long' },
			{ row: 3, reason: 'too-long' }
		]);
		expect(r.leads).toHaveLength(1);
	});

	it('matches stages case-insensitively and lists unknown stages', () => {
		const r = rowsToIncomingLeads(
			[
				['A', 'a@example.com', '', 'CLOSED', ''],
				['B', 'b@example.com', '', 'offer', ''],
				['C', 'c@example.com', '', 'Hot lead', '']
			],
			mapping
		);
		expect(r.leads.map((l) => l.stage)).toEqual(['closed', 'offer', 'new']);
		expect(r.leads[2]?.unknownStage).toBe('Hot lead');
		expect(r.unknownStages).toEqual([{ row: 4, value: 'Hot lead' }]);
	});

	it('unescapes formula cells and strips hostile characters', () => {
		const r = rowsToIncomingLeads([['Jo\u202E', 'jo@example.com', '', '', "'=1+1"]], mapping);
		expect(r.leads[0]?.name).toBe('Jo');
		expect(r.leads[0]?.notes).toBe('=1+1');
	});

	it('keeps known sources except sample, and inquiry-form consent only', () => {
		const r = rowsToIncomingLeads(
			[
				['A', 'a@example.com', 'Inquiry', 'inquiry-form'],
				['B', 'b@example.com', 'sample', 'yes'],
				['C', 'c@example.com', 'Zillow', ''],
				['D', 'd@example.com', 'manual', 'INQUIRY-FORM']
			],
			['name', 'email', 'source', 'consentSource']
		);
		expect(r.leads.map((l) => l.source)).toEqual(['inquiry', 'csv', 'csv', 'manual']);
		expect(r.leads.map((l) => l.consentSource)).toEqual([
			'inquiry-form',
			'unknown',
			'unknown',
			'inquiry-form'
		]);
	});

	it('carries Tran id and dates when mapped, nulls for empty nullable dates', () => {
		const r = rowsToIncomingLeads(
			[['Jo', 'jo@example.com', ID_A, '2026-09-01T12:00:00.000Z', '', '2026-09-05T10:00:00.000Z']],
			['name', 'email', 'id', 'createdAt', 'lastContactedAt', 'emailOptOutAt']
		);
		expect(r.leads[0]).toMatchObject({
			id: ID_A,
			createdAt: '2026-09-01T12:00:00.000Z',
			lastContactedAt: null,
			emailOptOutAt: '2026-09-05T10:00:00.000Z'
		});
	});

	it('leaves unmapped Tran fields undefined and drops malformed ids and dates', () => {
		const plain = rowsToIncomingLeads([['Jo', 'jo@example.com']], ['name', 'email']);
		expect(plain.leads[0]?.id).toBeUndefined();
		expect(plain.leads[0]?.createdAt).toBeUndefined();
		expect(plain.leads[0]?.emailOptOutAt).toBeUndefined();
		const bad = rowsToIncomingLeads(
			[['Jo', 'jo@example.com', 'crm-123', 'yesterday', 'last week']],
			['name', 'email', 'id', 'createdAt', 'lastContactedAt']
		);
		expect(bad.leads[0]?.id).toBeUndefined();
		expect(bad.leads[0]?.createdAt).toBeUndefined();
		expect(bad.leads[0]?.lastContactedAt).toBeNull();
	});

	it('honors a non-date opt-out marker conservatively', () => {
		const now = new Date('2026-10-01T00:00:00.000Z');
		const r = rowsToIncomingLeads(
			[
				['A', 'a@example.com', 'Yes'],
				['B', 'b@example.com', 'no'],
				['C', 'c@example.com', 'FALSE'],
				['D', 'd@example.com', '']
			],
			['name', 'email', 'emailOptOutAt'],
			{ now }
		);
		expect(r.leads.map((l) => l.emailOptOutAt)).toEqual([
			'2026-10-01T00:00:00.000Z',
			null,
			null,
			null
		]);
	});

	it('ignores skipped columns and columns past the mapping', () => {
		const r = rowsToIncomingLeads(
			[['Jo', 'secret', 'jo@example.com', 'extra']],
			['name', 'skip', 'email']
		);
		expect(r.leads[0]).toMatchObject({ name: 'Jo', email: 'jo@example.com', notes: '' });
	});
});

describe('row cap', () => {
	it('counts non-blank data rows after the header', () => {
		expect(countDataRows([['name'], ['a'], [''], [' ', ''], ['b'], []])).toBe(2);
		expect(countDataRows([])).toBe(0);
		expect(countDataRows([['name']])).toBe(0);
	});

	it('accepts exactly 5000 and rejects 5001', () => {
		expect(checkRowCap(5000)).toEqual({ ok: true, count: 5000 });
		expect(checkRowCap(5001)).toEqual({ ok: false, count: 5001 });
	});

	it('rejects a generated 5001-row file without truncating', () => {
		const lines = ['name,email'];
		for (let i = 0; i < 5001; i++) lines.push(`Lead ${i},lead${i}@example.com`);
		const rows = parseCsv(lines.join('\r\n'));
		const count = countDataRows(rows);
		expect(count).toBe(5001);
		expect(checkRowCap(count)).toEqual({ ok: false, count: 5001 });
	});

	it('accepts a 5000-row file padded with blank lines', () => {
		const lines = ['name,email'];
		for (let i = 0; i < 5000; i++) lines.push(`Lead ${i},lead${i}@example.com`);
		lines.push('', ',', '');
		const count = countDataRows(parseCsv(lines.join('\n')));
		expect(count).toBe(5000);
		expect(checkRowCap(count).ok).toBe(true);
	});
});

describe('export then import', () => {
	const iso = fc
		.date({
			min: new Date('2000-01-01T00:00:00.000Z'),
			max: new Date('2099-12-31T23:59:59.999Z'),
			noInvalidDate: true
		})
		.map((d) => d.toISOString());
	const nasty = fc.string({
		unit: fc.constantFrom('a', 'Z', ' ', ',', '"', '\n', '=', '+', '-', '@', "'", ';', '\u00E9'),
		maxLength: 30
	});
	const text = (max: number) =>
		fc
			.oneof(nasty, fc.string({ unit: 'grapheme', maxLength: 30 }))
			.map((s) => cleanText(s).slice(0, max))
			.map(cleanText);
	const phone = fc.oneof(
		fc.constant(''),
		fc.integer({ min: 0, max: 99 }).map((n) => `555-555-01${String(n).padStart(2, '0')}`)
	);
	const email = fc.oneof(
		fc.constant(''),
		fc
			.emailAddress()
			.map((e) => e.toLowerCase())
			.filter((e) => e.length <= 254)
	);
	const contactArb = fc
		.record({
			id: fc.uuid({ version: 4 }),
			createdAt: iso,
			name: text(120).filter((s) => s !== ''),
			email,
			phone,
			stage: fc.constantFrom(...STAGES),
			source: fc.constantFrom(...CONTACT_SOURCES.filter((s) => s !== 'sample')),
			propertyOfInterest: text(300),
			notes: text(2000),
			consentSource: fc.constantFrom(...CONSENT_SOURCES),
			emailOptOutAt: fc.option(iso, { nil: null }),
			lastContactedAt: fc.option(iso, { nil: null })
		})
		.filter((c) => c.email !== '' || c.phone !== '')
		.map((c) => contact(c));

	it('re-imports every exported field unchanged', () => {
		fc.assert(
			fc.property(fc.array(contactArb, { maxLength: 6 }), (cs) => {
				const rows = parseCsv(exportContactsCsv(cs));
				const header = rows[0] ?? [];
				const { leads, invalid, unknownStages } = rowsToIncomingLeads(
					rows.slice(1),
					autoMap(header)
				);
				expect(invalid).toEqual([]);
				expect(unknownStages).toEqual([]);
				const sorted = [...cs].sort((a, b) =>
					a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
				);
				expect(leads).toHaveLength(sorted.length);
				leads.forEach((lead, i) => {
					const c = sorted[i] as Contact;
					expect(lead.name).toBe(c.name);
					expect(lead.email).toBe(c.email);
					expect(normPhoneUS(lead.phone)).toBe(normPhoneUS(c.phone));
					expect(lead.stage).toBe(c.stage);
					expect(lead.source).toBe(c.source);
					expect(lead.propertyOfInterest).toBe(c.propertyOfInterest);
					expect(lead.notes).toBe(c.notes);
					expect(lead.consentSource).toBe(c.consentSource);
					expect(lead.emailOptOutAt).toBe(c.emailOptOutAt);
					expect(lead.createdAt).toBe(c.createdAt);
					expect(lead.lastContactedAt).toBe(c.lastContactedAt);
					expect(lead.id).toBe(c.id);
				});
			}),
			{ numRuns: 200 }
		);
	});
});
