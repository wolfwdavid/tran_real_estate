import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Contact, IncomingLead } from '../agent/types.js';
import { diffLeads, FILLABLE_FIELDS, type LeadDiffRow } from './diff-leads.js';
import { normEmail, normPhoneUS } from './normalize.js';

const STAMP = '2026-10-01T12:00:00.000Z';
let seq = 0;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function contact(overrides: Partial<Contact> = {}): Contact {
	seq += 1;
	const base: Contact = {
		id: uuid(seq),
		ownerId: 'local',
		createdAt: STAMP,
		updatedAt: STAMP,
		schemaVersion: 1,
		name: `Contact ${seq}`,
		email: '',
		phone: '',
		stage: 'new',
		stageChangedAt: STAMP,
		source: 'manual',
		propertyOfInterest: '',
		notes: '',
		consentSource: 'unknown',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false,
		...overrides
	};
	const emailNorm = normEmail(base.email);
	const phoneNorm = normPhoneUS(base.phone);
	const out: Contact = { ...base };
	if (emailNorm !== null) out.emailNorm = emailNorm;
	if (phoneNorm !== null) out.phoneNorm = phoneNorm;
	return out;
}

function lead(rowNumber: number, overrides: Partial<IncomingLead> = {}): IncomingLead {
	return {
		rowNumber,
		name: `Lead ${rowNumber}`,
		email: '',
		phone: '',
		propertyOfInterest: '',
		notes: '',
		source: 'paste',
		consentSource: 'unknown',
		...overrides
	};
}

const kinds = (rows: readonly LeadDiffRow[]) => rows.map((r) => r.kind);

describe('diffLeads', () => {
	it('exports the fillable fields', () => {
		expect(FILLABLE_FIELDS).toEqual(['email', 'phone', 'propertyOfInterest', 'notes']);
	});

	it('classifies an unmatched lead as new', () => {
		const l = lead(1, { email: 'pat@example.com' });
		const d = diffLeads([l], []);
		expect(d.rows).toEqual([{ kind: 'new', lead: l }]);
		expect(d.counts).toEqual({ new: 1, update: 0, duplicate: 0, conflict: 0, sameAsRow: 0 });
	});

	it('ignores tombstoned (deleted) contacts entirely', () => {
		const gone = contact({ email: 'pat@example.com', deletedAt: STAMP });
		const goneById = contact({ email: 'old@example.com', deletedAt: STAMP });
		const d = diffLeads(
			[lead(1, { email: 'PAT@example.com' }), lead(2, { id: goneById.id, name: 'X' })],
			[gone, goneById]
		);
		expect(kinds(d.rows)).toEqual(['new', 'new']);
	});

	it('matches by normalized email (case and whitespace insensitive)', () => {
		const c = contact({ name: 'Pat Example', email: 'pat@example.com' });
		const d = diffLeads([lead(1, { email: '  PAT@Example.com ' })], [c]);
		expect(d.rows[0]).toEqual({
			kind: 'duplicate',
			lead: expect.objectContaining({ rowNumber: 1 }),
			target: { id: c.id, name: 'Pat Example' }
		});
	});

	it('matches by normalized phone when email does not match', () => {
		const c = contact({ phone: '(555) 555-0101' });
		const d = diffLeads([lead(1, { phone: '555.555.0101' })], [c]);
		expect(d.rows[0]?.kind).toBe('duplicate');
	});

	it('never matches on an un-normalizable phone', () => {
		const c = contact({ phone: '0101' });
		const d = diffLeads([lead(1, { phone: '0101' })], [c]);
		expect(kinds(d.rows)).toEqual(['new']);
	});

	it('matches by Tran id first', () => {
		const c = contact({ email: 'a@example.com' });
		const d = diffLeads([lead(1, { id: c.id })], [c]);
		expect(d.rows[0]).toMatchObject({ kind: 'duplicate', target: { id: c.id } });
	});

	it('id identity beats a different contact matched by email; the email collision is kept', () => {
		const byId = contact({ name: 'By Id', email: '' });
		const byEmail = contact({ name: 'By Email', email: 'pat@example.com' });
		const d = diffLeads([lead(1, { id: byId.id, email: 'pat@example.com' })], [byId, byEmail]);
		const row = d.rows[0];
		expect(row?.kind).toBe('duplicate');
		expect(row).toMatchObject({ target: { id: byId.id, name: 'By Id' } });
	});

	it('id match with email collision and another fill lists email in keeps', () => {
		const byId = contact({ name: 'By Id', email: '' });
		const byEmail = contact({ email: 'pat@example.com' });
		const d = diffLeads(
			[lead(1, { id: byId.id, email: 'pat@example.com', notes: 'Prefers texts' })],
			[byId, byEmail]
		);
		expect(d.rows[0]).toEqual({
			kind: 'update',
			lead: expect.objectContaining({ rowNumber: 1 }),
			target: { id: byId.id, name: 'By Id' },
			fills: ['notes'],
			keeps: [{ field: 'email', existing: '', incoming: 'pat@example.com' }],
			logsInquiry: false
		});
	});

	it('update fills only blank fields', () => {
		const c = contact({ name: 'Pat', email: 'pat@example.com' });
		const d = diffLeads(
			[
				lead(1, {
					email: 'pat@example.com',
					phone: '555-555-0102',
					propertyOfInterest: '12 Sample Lane'
				})
			],
			[c]
		);
		expect(d.rows[0]).toMatchObject({
			kind: 'update',
			fills: ['phone', 'propertyOfInterest'],
			keeps: [],
			logsInquiry: false
		});
		expect(d.counts.update).toBe(1);
	});

	it('never overwrite: differing non-empty values are listed in keeps', () => {
		const c = contact({
			email: 'pat@example.com',
			phone: '(555) 555-0101',
			notes: 'Old note'
		});
		const d = diffLeads(
			[
				lead(1, {
					email: 'pat@example.com',
					phone: '5555550109',
					notes: 'New note',
					propertyOfInterest: '4 Elm'
				})
			],
			[c]
		);
		expect(d.rows[0]).toMatchObject({
			kind: 'update',
			fills: ['propertyOfInterest'],
			keeps: [
				{ field: 'phone', existing: '(555) 555-0101', incoming: '(555) 555-0109' },
				{ field: 'notes', existing: 'Old note', incoming: 'New note' }
			]
		});
	});

	it('keeps-only differences without fills or message are a duplicate', () => {
		const c = contact({ email: 'pat@example.com', notes: 'Old' });
		const d = diffLeads([lead(1, { email: 'pat@example.com', notes: 'New' })], [c]);
		expect(d.rows[0]?.kind).toBe('duplicate');
	});

	it('equal values after normalization are neither fills nor keeps', () => {
		const c = contact({ email: 'pat@example.com', phone: '(555) 555-0101', notes: 'Same' });
		const d = diffLeads(
			[lead(1, { email: 'PAT@example.com', phone: '+1 555 555 0101', notes: ' Same\u200B' })],
			[c]
		);
		expect(d.rows[0]?.kind).toBe('duplicate');
	});

	it('a non-empty inquiry message makes a match an update that logs the inquiry', () => {
		const c = contact({ email: 'pat@example.com' });
		const d = diffLeads([lead(1, { email: 'pat@example.com', message: 'Is it available?' })], [c]);
		expect(d.rows[0]).toMatchObject({ kind: 'update', fills: [], keeps: [], logsInquiry: true });
	});

	it('a whitespace-only message does not log an inquiry', () => {
		const c = contact({ email: 'pat@example.com' });
		const d = diffLeads([lead(1, { email: 'pat@example.com', message: '  ' })], [c]);
		expect(d.rows[0]?.kind).toBe('duplicate');
	});

	it('conflict: email matches one contact and phone matches a different one', () => {
		const a = contact({ name: 'A', email: 'a@example.com' });
		const b = contact({ name: 'B', phone: '555-555-0102' });
		const l = lead(1, { email: 'a@example.com', phone: '(555) 555-0102' });
		const d = diffLeads([l], [a, b]);
		expect(d.rows[0]).toEqual({
			kind: 'conflict',
			lead: l,
			emailMatch: { id: a.id, name: 'A' },
			phoneMatch: { id: b.id, name: 'B' }
		});
		expect(d.counts.conflict).toBe(1);
	});

	it('no conflict when email and phone match the same contact', () => {
		const a = contact({ email: 'a@example.com', phone: '555-555-0102' });
		const d = diffLeads([lead(1, { email: 'a@example.com', phone: '5555550102' })], [a]);
		expect(d.rows[0]?.kind).toBe('duplicate');
	});

	it('in-batch: a later lead with the same email is same-as-row and merges into the first', () => {
		const first = lead(2, { email: 'pat@example.com' });
		const later = lead(5, { email: 'Pat@Example.com', phone: '555-555-0103', notes: 'From row 5' });
		const d = diffLeads([first, later], []);
		expect(kinds(d.rows)).toEqual(['new', 'same-as-row']);
		expect(d.rows[1]).toEqual({ kind: 'same-as-row', lead: later, firstRow: 2 });
		expect(d.rows[0]?.lead).toMatchObject({
			email: 'pat@example.com',
			phone: '555-555-0103',
			notes: 'From row 5'
		});
		expect(d.counts).toEqual({ new: 1, update: 0, duplicate: 0, conflict: 0, sameAsRow: 1 });
	});

	it('in-batch: merged fields from a same-as-row lead then fill the matched contact', () => {
		const c = contact({ name: 'Pat', email: 'pat@example.com' });
		const d = diffLeads(
			[
				lead(1, { email: 'pat@example.com' }),
				lead(2, { email: 'pat@example.com', propertyOfInterest: '12 Sample Lane' })
			],
			[c]
		);
		expect(d.rows[0]).toMatchObject({ kind: 'update', fills: ['propertyOfInterest'] });
		expect(d.rows[1]).toMatchObject({ kind: 'same-as-row', firstRow: 1 });
	});

	it('in-batch merge never overwrites a non-empty field of the first occurrence', () => {
		const d = diffLeads(
			[
				lead(1, { phone: '555-555-0104', notes: 'First' }),
				lead(2, { phone: '5555550104', notes: 'Second' })
			],
			[]
		);
		expect(d.rows[0]?.lead.notes).toBe('First');
	});

	it('does not mutate its inputs', () => {
		const c = contact({ email: 'pat@example.com' });
		const leads = [
			lead(1, { email: 'pat@example.com' }),
			lead(2, { email: 'pat@example.com', notes: 'n' })
		];
		const snapshot = JSON.stringify({ leads, c });
		diffLeads(leads, [c]);
		expect(JSON.stringify({ leads, c })).toBe(snapshot);
	});

	it('returns rows in input order', () => {
		const c = contact({ email: 'dup@example.com' });
		const d = diffLeads(
			[
				lead(1, { email: 'new1@example.com' }),
				lead(2, { email: 'dup@example.com' }),
				lead(3, { email: 'new1@example.com' })
			],
			[c]
		);
		expect(d.rows.map((r) => r.lead.rowNumber)).toEqual([1, 2, 3]);
		expect(kinds(d.rows)).toEqual(['new', 'duplicate', 'same-as-row']);
	});

	it('falls back to normalizing the raw email/phone when emailNorm/phoneNorm are absent', () => {
		const c = contact({ email: 'pat@example.com', phone: '555-555-0105' });
		delete c.emailNorm;
		delete c.phoneNorm;
		const d = diffLeads(
			[lead(1, { phone: '5555550105' }), lead(2, { email: 'PAT@example.com' })],
			[c]
		);
		expect(kinds(d.rows)).toEqual(['duplicate', 'duplicate']);
	});

	// Applies a diff the way the import commit would: create new contacts, fill blanks on updates.
	function apply(diff: ReturnType<typeof diffLeads>, existing: Contact[]): Contact[] {
		const out = existing.map((c) => ({ ...c }));
		for (const row of diff.rows) {
			if (row.kind === 'new') {
				out.push(
					contact({
						name: row.lead.name,
						email: row.lead.email,
						phone: row.lead.phone,
						propertyOfInterest: row.lead.propertyOfInterest,
						notes: row.lead.notes
					})
				);
			} else if (row.kind === 'update') {
				const i = out.findIndex((c) => c.id === row.target.id);
				const t = out[i];
				if (t === undefined) throw new Error('missing target');
				const next: Contact = { ...t };
				for (const f of row.fills) if (next[f].trim() === '') next[f] = row.lead[f];
				out[i] = contact({ ...next, id: t.id });
			}
		}
		return out;
	}

	it('property: re-importing after applying the diff yields no new rows and no updates', () => {
		const emails = fc.constantFrom(
			'',
			'a@example.com',
			'b@example.com',
			'C@example.com',
			'c@example.com'
		);
		const phones = fc.constantFrom('', '555-555-0101', '(555) 555-0102', '5555550103', '0101');
		const text = fc.constantFrom('', 'x', 'y');
		const leadArb = fc.record({
			email: emails,
			phone: phones,
			propertyOfInterest: text,
			notes: text
		});
		const contactArb = fc.record({ email: emails, phone: phones, notes: text, dead: fc.boolean() });
		fc.assert(
			fc.property(
				fc.array(leadArb, { maxLength: 8 }),
				fc.array(contactArb, { maxLength: 5 }),
				(ls, cs) => {
					const existing = cs.map((c) =>
						contact({
							email: c.email,
							phone: c.phone,
							notes: c.notes,
							...(c.dead ? { deletedAt: STAMP } : {})
						})
					);
					const incoming = ls.map((l, i) => lead(i + 1, l));
					const first = diffLeads(incoming, existing);
					const second = diffLeads(incoming, apply(first, existing));
					// Only leads with no usable identity key (no email, no NANP phone) stay new.
					for (const r of second.rows) {
						if (r.kind === 'new') {
							expect(normEmail(r.lead.email)).toBeNull();
							expect(normPhoneUS(r.lead.phone)).toBeNull();
						}
					}
					expect(second.counts.update).toBe(0);
					expect(second.rows).toHaveLength(incoming.length);
					// Classification is deterministic.
					expect(diffLeads(incoming, existing)).toEqual(first);
				}
			),
			{ numRuns: 200 }
		);
	});
});
