// Import commit (08-14): planFromDiff selection, the single-transaction commit, fill-blank-only
// updates, inquiry activities and a 5,000-lead smoke run. fake-indexeddb, fresh factory per test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingLead } from '@tran/core/agent/types';
import { diffLeads } from '@tran/core/leads/diff-leads';
import { _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import {
	addContact,
	getContact,
	listActivities,
	listContacts,
	updateContact
} from './contacts-repo';
import { commitImport, ImportCommitError, inquiryText, planFromDiff } from './import-commit';

const T1 = '2026-10-06T12:00:00.000Z';
const T2 = '2026-10-06T13:00:00.000Z';

beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => {
	vi.restoreAllMocks();
	_resetDb();
});

function lead(rowNumber: number, o: Partial<IncomingLead> = {}): IncomingLead {
	return {
		rowNumber,
		name: `Lead ${rowNumber}`,
		email: `lead${rowNumber}@example.com`,
		phone: '',
		propertyOfInterest: '',
		notes: '',
		source: 'paste',
		consentSource: 'unknown',
		...o
	};
}

async function existing(o: { name: string; email: string; phone?: string; notes?: string }) {
	return addContact(
		{
			name: o.name,
			email: o.email,
			phone: o.phone ?? '',
			propertyOfInterest: '',
			notes: o.notes ?? '',
			source: 'manual',
			consentSource: 'unknown'
		},
		T1
	);
}

describe('planFromDiff', () => {
	it('takes checked new and update rows and counts the rest as skipped', async () => {
		const a = await existing({ name: 'Ann Update', email: 'ann@example.com' });
		const b = await existing({ name: 'Bo Dup', email: 'bo@example.com' });
		const c = await existing({ name: 'Cy Phone', email: 'cy@example.com', phone: '555-555-0100' });
		const incoming = [
			lead(1),
			lead(2),
			lead(3, { email: 'ann@example.com', phone: '555-555-0199' }),
			lead(4),
			lead(5, { email: 'bo@example.com' }),
			lead(6, { email: 'ann@example.com', phone: '555-555-0100' })
		];
		const { rows } = diffLeads(incoming, await listContacts());
		expect(rows.map((r) => r.kind)).toEqual([
			'new',
			'new',
			'update',
			'new',
			'duplicate',
			'same-as-row'
		]);
		// Row 6 shares row 3's email, so it merges in the batch; a second diff (no shared batch
		// keys) yields a duplicate and a true conflict.
		const dc = diffLeads(
			[
				lead(7, { email: 'bo@example.com' }),
				lead(8, { email: 'ann@example.com', phone: '555-555-0100' })
			],
			await listContacts()
		).rows;
		expect(dc.map((r) => r.kind)).toEqual(['duplicate', 'conflict']);
		const all = [...rows.slice(0, 4), ...dc];
		const plan = planFromDiff(all, new Set([1, 2, 3, 7, 8]));
		expect(plan.adds.map((l) => l.rowNumber)).toEqual([1, 2]);
		expect(plan.updates).toEqual([{ contactId: a.id, fills: { phone: '555-555-0199' } }]);
		expect(plan.skipped).toBe(3);
		expect(b.id).not.toBe(c.id);
	});

	it('applies preview edits to new rows', () => {
		const { rows } = diffLeads([lead(1, { name: 'garbled', email: 'x' })], []);
		const plan = planFromDiff(
			rows,
			new Set([1]),
			new Map([[1, { name: 'Dana Fixed', email: 'dana@example.com' }]])
		);
		expect(plan.adds[0]).toMatchObject({ name: 'Dana Fixed', email: 'dana@example.com' });
	});

	it('carries an inquiry message on an update row', async () => {
		const a = await existing({ name: 'Ann', email: 'ann@example.com' });
		const { rows } = diffLeads(
			[lead(1, { email: 'ann@example.com', message: 'Still available?' })],
			await listContacts()
		);
		expect(planFromDiff(rows, new Set([1])).updates).toEqual([
			{ contactId: a.id, fills: {}, inquiryMessage: 'Still available?' }
		]);
	});
});

describe('commitImport', () => {
	it.each([
		['inquiry', 'Added from your inquiry page'],
		['paste', 'Added from a pasted email'],
		['csv', 'Imported from CSV']
	] as const)('adds contacts with the %s added activity', async (source, text) => {
		const res = await commitImport({ adds: [lead(1, { source })], updates: [], skipped: 2 }, T1);
		expect(res).toEqual({ added: 1, updated: 0, skipped: 2 });
		const [c] = await listContacts();
		expect(c).toMatchObject({ name: 'Lead 1', source, emailNorm: 'lead1@example.com' });
		const acts = await listActivities(c!.id);
		expect(acts.map((a) => [a.type, a.text])).toEqual([['added', text]]);
	});

	it('logs an inquiry message as an activity and leaves notes alone', async () => {
		const long = 'I would love to tour the Oak Street place this weekend. '.repeat(3);
		await commitImport(
			{
				adds: [lead(1, { source: 'inquiry', notes: 'Prefers text', message: long })],
				updates: [],
				skipped: 0
			},
			T1
		);
		const [c] = await listContacts();
		expect(c!.notes).toBe('Prefers text');
		const inquiry = (await listActivities(c!.id)).find((a) => a.type === 'inquiry');
		expect(inquiry!.text).toBe(inquiryText(long));
		expect(inquiry!.text.startsWith('Inquiry received: "I would love')).toBe(true);
		expect(inquiry!.text.endsWith('..."')).toBe(true);
		expect(inquiryText('Short one')).toBe('Inquiry received: "Short one"');
	});

	it('update fills a blank field, logs Details updated and an inquiry, keeps notes', async () => {
		const a = await existing({ name: 'Ann', email: 'ann@example.com', notes: 'Keep me' });
		const res = await commitImport(
			{
				adds: [],
				updates: [
					{ contactId: a.id, fills: { phone: '(555) 555-0142' }, inquiryMessage: 'Is it open?' }
				],
				skipped: 0
			},
			T2
		);
		expect(res).toEqual({ added: 0, updated: 1, skipped: 0 });
		const c = await getContact(a.id);
		expect(c).toMatchObject({
			phone: '(555) 555-0142',
			phoneNorm: '+15555550142',
			notes: 'Keep me'
		});
		const types = (await listActivities(a.id)).map((x) => x.text);
		expect(types).toContain('Details updated');
		expect(types).toContain('Inquiry received: "Is it open?"');
	});

	it('never overwrites a value set between the review and the commit', async () => {
		const a = await existing({ name: 'Ann', email: 'ann@example.com' });
		const { rows } = diffLeads(
			[lead(1, { email: 'ann@example.com', phone: '555-555-0199' })],
			await listContacts()
		);
		const plan = planFromDiff(rows, new Set([1]));
		expect(plan.updates[0]!.fills).toEqual({ phone: '555-555-0199' });
		await updateContact(a.id, { phone: '555-555-0111' }, T1);
		const res = await commitImport(plan, T2);
		expect(res.updated).toBe(0);
		expect((await getContact(a.id))!.phone).toBe('555-555-0111');
	});

	it('is all or nothing: an invalid third add throws ImportCommitError and writes nothing', async () => {
		await existing({ name: 'Ann', email: 'ann@example.com' });
		const a = (await listContacts())[0]!;
		const before = await getDb().contacts.count();
		const actsBefore = await getDb().activities.count();
		const plan = {
			adds: [lead(1), lead(2), lead(3, { name: '' }), lead(4)],
			updates: [{ contactId: a.id, fills: { phone: '555-555-0142' } }],
			skipped: 0
		};
		await expect(commitImport(plan, T2)).rejects.toBeInstanceOf(ImportCommitError);
		expect(await getDb().contacts.count()).toBe(before);
		expect(await getDb().activities.count()).toBe(actsBefore);
		expect((await getContact(a.id))!.phone).toBe('');
	});

	it('is all or nothing: a failed activity write rolls back contacts and fills', async () => {
		const a = await existing({ name: 'Ann', email: 'ann@example.com' });
		vi.spyOn(getDb().activities, 'bulkAdd').mockRejectedValue(new Error('boom'));
		await expect(
			commitImport(
				{
					adds: [lead(1), lead(2)],
					updates: [{ contactId: a.id, fills: { phone: '555-555-0142' } }],
					skipped: 0
				},
				T2
			)
		).rejects.toBeInstanceOf(ImportCommitError);
		vi.restoreAllMocks();
		expect(await getDb().contacts.count()).toBe(1);
		expect((await getContact(a.id))!.phone).toBe('');
	});

	it('commits a 5000-lead plan in one call', async () => {
		const adds = Array.from({ length: 5000 }, (_, i) => lead(i + 1, { source: 'csv' }));
		const started = Date.now();
		const res = await commitImport({ adds, updates: [], skipped: 0 }, T1);
		expect(res.added).toBe(5000);
		expect(await getDb().contacts.count()).toBe(5000);
		expect(await getDb().activities.count()).toBe(5000);
		expect(Date.now() - started).toBeLessThan(10_000);
	}, 30_000);
});
