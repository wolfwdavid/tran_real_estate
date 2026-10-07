import { describe, expect, test } from 'vitest';
import type { Contact } from '@tran/core/agent';
import { EXPORT_COLUMNS } from '@tran/core/csv';
import { buildExport } from './csv-export';

const TODAY = '2026-10-07';

const contact = (over: Partial<Contact> = {}): Contact => ({
	id: '11111111-1111-4111-8111-111111111111',
	ownerId: 'local',
	createdAt: '2026-09-20T12:00:00.000Z',
	updatedAt: '2026-09-20T12:00:00.000Z',
	schemaVersion: 1,
	name: 'Jordan Real',
	email: 'jordan.real@example.com',
	phone: '(555) 555-0199',
	stage: 'new',
	stageChangedAt: '2026-09-20T12:00:00.000Z',
	source: 'manual',
	propertyOfInterest: '',
	notes: '',
	consentSource: 'unknown',
	emailOptOutAt: null,
	lastContactedAt: null,
	sample: false,
	...over
});

const sample = (n: number): Contact =>
	contact({
		id: `5a3b1e00-0000-4000-8100-${String(n).padStart(12, '0')}`,
		name: `Sample ${n}`,
		email: `sample${n}@example.com`,
		sample: true
	});

const HEADER = EXPORT_COLUMNS.map((c) => `"${c}"`).join(',');
// The BOM is built at runtime so no formatter can turn an escape into a literal U+FEFF.
const BOM = String.fromCharCode(0xfeff);
const lines = (text: string) => (text.startsWith(BOM) ? text.slice(1) : text).split('\r\n');

describe('buildExport', () => {
	test('is null with no contacts', () => {
		expect(buildExport([], TODAY)).toBeNull();
	});

	test('is null with only sample contacts', () => {
		expect(buildExport([sample(1), sample(2), sample(3)], TODAY)).toBeNull();
	});

	test('is null when the only real contact is a tombstone', () => {
		expect(buildExport([contact({ deletedAt: '2026-10-01T00:00:00.000Z' })], TODAY)).toBeNull();
	});

	test('names the file from the injected today', () => {
		expect(buildExport([contact()], TODAY)?.filename).toBe('tran-contacts-2026-10-07.csv');
		expect(buildExport([contact()], '2027-01-02')?.filename).toBe('tran-contacts-2027-01-02.csv');
	});

	test('text starts with the BOM and the quoted header', () => {
		const out = buildExport([contact()], TODAY);
		expect(out).not.toBeNull();
		expect(out?.text.startsWith(BOM + '"name","email"')).toBe(true);
		expect(out?.text).toContain('\r\n');
	});

	test('has exactly one header row and no disclosure row', () => {
		const out = buildExport(
			[contact(), contact({ id: '22222222-2222-4222-8222-222222222222' })],
			TODAY
		);
		const all = lines(out?.text ?? '');
		expect(all.filter((l) => l.startsWith('"name"'))).toHaveLength(1);
		expect(all[0]).toBe(HEADER);
		// header + 2 data rows + the empty string after the final CRLF
		expect(all).toHaveLength(4);
	});

	test('counts and exports only the live non-sample contacts', () => {
		const out = buildExport([sample(1), contact(), sample(2)], TODAY);
		expect(out?.count).toBe(1);
		expect(out?.text).toContain('jordan.real@example.com');
		expect(out?.text).not.toContain('sample1@example.com');
		expect(out?.text).not.toContain('sample2@example.com');
	});

	test('neutralizes a formula in notes with a leading apostrophe', () => {
		const out = buildExport([contact({ notes: '=HYPERLINK("http://evil.test","x")' })], TODAY);
		expect(out?.text).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
		expect(out?.text).not.toContain(',"=HYPERLINK(');
	});
});
