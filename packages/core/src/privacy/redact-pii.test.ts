import { describe, expect, test } from 'vitest';

import { redactPii, type KnownPii } from './redact-pii.js';

// Fictional data only: @example.com / @example.org emails and 555-01xx phone lines.
const K: KnownPii[] = [
	{ value: 'Jordan Rivera', token: 'client_name', kind: 'name' },
	{ value: 'jordan.rivera@example.com', token: 'client_email', kind: 'email' },
	{ value: '(212) 555-0147', token: 'client_phone', kind: 'phone' }
];

describe('redactPii: known values', () => {
	test('replaces a known name, email and phone with role tokens', () => {
		const out = redactPii('From Jordan Rivera (jordan.rivera@example.com, (212) 555-0147).', K);
		expect(out.text).toBe('From {client_name} ({client_email}, {client_phone}).');
		expect(out.redactions).toHaveLength(3);
		expect(out.redactions).toEqual(
			expect.arrayContaining([
				{ original: 'Jordan Rivera', token: 'client_name' },
				{ original: 'jordan.rivera@example.com', token: 'client_email' },
				{ original: '(212) 555-0147', token: 'client_phone' }
			])
		);
	});

	test('a full name also redacts its standalone first and last name', () => {
		const out = redactPii('Thanks, Jordan. Rivera family', K);
		expect(out.text).toBe('Thanks, {client_first_name}. {client_last_name} family');
		expect(out.redactions).toEqual(
			expect.arrayContaining([
				{ original: 'Jordan', token: 'client_first_name' },
				{ original: 'Rivera', token: 'client_last_name' }
			])
		);
	});

	test('a token without the _name suffix is used as the part prefix', () => {
		const out = redactPii('Ask Casey or Morgan', [
			{ value: 'Casey Morgan', token: 'agent', kind: 'name' }
		]);
		expect(out.text).toBe('Ask {agent_first_name} or {agent_last_name}');
	});

	test('matches case-insensitively and records the original casing', () => {
		const out = redactPii('JORDAN RIVERA wrote', K);
		expect(out.text).toBe('{client_name} wrote');
		expect(out.redactions).toEqual([{ original: 'JORDAN RIVERA', token: 'client_name' }]);
	});

	test('tolerates different whitespace inside a known name', () => {
		expect(redactPii('Jordan  Rivera', K).text).toBe('{client_name}');
	});

	test('respects Unicode word boundaries', () => {
		const ana: KnownPii[] = [{ value: 'Ana', token: 'client_name', kind: 'name' }];
		expect(redactPii('Banana bread in Anaheim', ana)).toEqual({
			text: 'Banana bread in Anaheim',
			redactions: []
		});
		expect(redactPii('Hi Ana!', ana).text).toBe('Hi {client_name}!');

		const jose: KnownPii[] = [{ value: 'José Núñez', token: 'client_name', kind: 'name' }];
		const out = redactPii('José Núñez called; José will visit.', jose);
		expect(out.text).toBe('{client_name} called; {client_first_name} will visit.');
	});

	test('replaces the longest known value first', () => {
		const out = redactPii('Ann Lee and Ann', [
			{ value: 'Ann', token: 'tenant_name', kind: 'name' },
			{ value: 'Ann Lee', token: 'client_name', kind: 'name' }
		]);
		expect(out.text).toBe('{client_name} and {tenant_name}');
	});

	test('never re-matches inside an already inserted token', () => {
		const out = redactPii('Jordan Rivera and Client', [
			{ value: 'Jordan Rivera', token: 'client_name', kind: 'name' },
			{ value: 'Client', token: 'other', kind: 'name' },
			{ value: 'name', token: 'oops', kind: 'name' }
		]);
		expect(out.text).toBe('{client_name} and {other}');
	});

	test('a known email is not re-matched by the email pass', () => {
		const out = redactPii('Mail jordan.rivera@example.com', K);
		expect(out.text).toBe('Mail {client_email}');
		expect(out.text).not.toContain('{email_1}');
		expect(out.redactions).toEqual([
			{ original: 'jordan.rivera@example.com', token: 'client_email' }
		]);
	});

	test('ignores known values shorter than 2 characters', () => {
		const out = redactPii('A plan for J and a house', [
			{ value: 'J', token: 'client_name', kind: 'name' },
			{ value: ' a ', token: 'x', kind: 'name' }
		]);
		expect(out).toEqual({ text: 'A plan for J and a house', redactions: [] });
	});

	test('records a repeated value once', () => {
		const out = redactPii('Jordan Rivera, Jordan Rivera', K);
		expect(out.text).toBe('{client_name}, {client_name}');
		expect(out.redactions).toEqual([{ original: 'Jordan Rivera', token: 'client_name' }]);
	});
});

describe('redactPii: undeclared emails and phones', () => {
	test('numbers unknown emails in order of first appearance and reuses tokens', () => {
		const out = redactPii('Write to pat@example.org or sam@example.com, cc pat@example.org.', []);
		expect(out.text).toBe('Write to {email_1} or {email_2}, cc {email_1}.');
		expect(out.redactions).toEqual([
			{ original: 'pat@example.org', token: 'email_1' },
			{ original: 'sam@example.com', token: 'email_2' }
		]);
	});

	test('detects common US phone formats', () => {
		const out = redactPii('Call 212-555-0148, +1 212 555 0149, (212)555-0150 or 212.555.0151.', []);
		expect(out.text).toBe('Call {phone_1}, {phone_2}, {phone_3} or {phone_4}.');
		expect(out.redactions.map((r) => r.token)).toEqual([
			'phone_1',
			'phone_2',
			'phone_3',
			'phone_4'
		]);
	});

	test('reuses the phone token for the same number', () => {
		const out = redactPii('212-555-0148 then 212-555-0148', []);
		expect(out.text).toBe('{phone_1} then {phone_1}');
		expect(out.redactions).toHaveLength(1);
	});

	test.each([
		'Rent is $1,850 per month',
		'zip 11201',
		'2 bed 1 bath',
		'2024-2026',
		'Unit 1234567',
		'$2,450,000',
		'Listed at $1,250,000.00 in 2025',
		'Parcel 1234567890,12'
	])('does not treat %j as a phone', (text) => {
		expect(redactPii(text, [])).toEqual({ text, redactions: [] });
	});

	test('returns the text unchanged when there is no PII', () => {
		const text = 'Two-bedroom near the park, available in May.';
		expect(redactPii(text, [])).toEqual({ text, redactions: [] });
		expect(redactPii('', K)).toEqual({ text: '', redactions: [] });
	});
});
