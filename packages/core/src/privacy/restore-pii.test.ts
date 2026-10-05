import { describe, expect, test } from 'vitest';

import { redactPii, type KnownPii } from './redact-pii.js';
import { restorePii, tokensFromRedactions } from './restore-pii.js';

// Fictional data only: @example.com emails and 555-01xx phone lines.
const K: KnownPii[] = [
	{ value: 'Jordan Rivera', token: 'client_name', kind: 'name' },
	{ value: 'jordan.rivera@example.com', token: 'client_email', kind: 'email' },
	{ value: '(212) 555-0147', token: 'client_phone', kind: 'phone' }
];

describe('restorePii', () => {
	test('re-inserts a token value', () => {
		expect(restorePii('Hi {client_first_name}, thanks!', { client_first_name: 'Dana' })).toBe(
			'Hi Dana, thanks!'
		);
	});

	test('replaces every occurrence', () => {
		expect(restorePii('{a} and {a}', { a: 'X' })).toBe('X and X');
	});

	test('leaves unknown tokens untouched', () => {
		expect(restorePii('{client_phone}', {})).toBe('{client_phone}');
	});

	test('matches token names exactly', () => {
		expect(restorePii('{client_first_name_x}', { client_first_name: 'Dana' })).toBe(
			'{client_first_name_x}'
		);
	});

	test('inserts values literally without replacement-pattern expansion', () => {
		expect(restorePii('{a}', { a: '$1 & $&' })).toBe('$1 & $&');
	});

	test('ignores inherited object keys', () => {
		expect(restorePii('{constructor} {toString}', {})).toBe('{constructor} {toString}');
	});

	test('returns text unchanged with no tokens and leaves prose braces alone', () => {
		expect(restorePii('Plain {not a token here} text', {})).toBe('Plain {not a token here} text');
		expect(restorePii('Plain {not a token here} text', { a: 'X' })).toBe(
			'Plain {not a token here} text'
		);
	});

	test('round-trips redactPii output', () => {
		const t = 'From Jordan Rivera (jordan.rivera@example.com, (212) 555-0147). Thanks, Jordan.';
		const redacted = redactPii(t, K);
		expect(redacted.text).not.toContain('Jordan');
		expect(restorePii(redacted.text, tokensFromRedactions(redacted.redactions))).toBe(t);
	});

	test('round-trips undeclared emails and phones', () => {
		const t = 'Reach pat@example.org or 212-555-0148.';
		const redacted = redactPii(t, []);
		expect(restorePii(redacted.text, tokensFromRedactions(redacted.redactions))).toBe(t);
	});
});

describe('tokensFromRedactions', () => {
	test('builds a token-to-original record', () => {
		expect(
			tokensFromRedactions([
				{ original: 'Jordan', token: 'client_first_name' },
				{ original: 'pat@example.org', token: 'email_1' }
			])
		).toEqual({ client_first_name: 'Jordan', email_1: 'pat@example.org' });
	});

	test('keeps the first original seen per token', () => {
		const tokens = tokensFromRedactions([
			{ original: 'Jordan Rivera', token: 'client_name' },
			{ original: 'JORDAN RIVERA', token: 'client_name' }
		]);
		expect(tokens).toEqual({ client_name: 'Jordan Rivera' });
	});

	test('returns an empty record for no redactions', () => {
		expect(tokensFromRedactions([])).toEqual({});
	});
});
