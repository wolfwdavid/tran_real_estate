import { describe, expect, test } from 'vitest';
import { evaluateGate, MIN_ELAPSED_MS, validateInquiry } from './inquiry-gate';

describe('evaluateGate', () => {
	test('a checked honeypot is dropped silently, whatever the timing', () => {
		expect(evaluateGate({ honeypotChecked: true, elapsedMs: 10_000 })).toBe('drop-silently');
		expect(evaluateGate({ honeypotChecked: true, elapsedMs: 0 })).toBe('drop-silently');
	});

	test('a submit under three seconds is too fast', () => {
		expect(MIN_ELAPSED_MS).toBe(3000);
		expect(evaluateGate({ honeypotChecked: false, elapsedMs: 2_999 })).toBe('too-fast');
	});

	test('three seconds or more sends', () => {
		expect(evaluateGate({ honeypotChecked: false, elapsedMs: 3_000 })).toBe('send');
		expect(evaluateGate({ honeypotChecked: false, elapsedMs: 60_000 })).toBe('send');
	});
});

describe('validateInquiry', () => {
	const ok = { name: 'Jordan', email: 'jordan@example.com', message: 'Hello', consent: true };

	test('a complete inquiry has no errors', () => {
		expect(validateInquiry(ok, 'Sample Agent')).toEqual({ errors: {}, firstInvalid: null });
	});

	test('an empty inquiry reports every field, name first', () => {
		const r = validateInquiry({ name: ' ', email: '', message: '  ', consent: false }, 'Sam');
		expect(r.errors).toEqual({
			name: 'Add your name.',
			email: 'Add your email address so Sam can reply.',
			message: 'Write a short message.',
			consent: 'Check the box to agree to be contacted about your inquiry.'
		});
		expect(r.firstInvalid).toBe('name');
	});

	test('an incomplete email', () => {
		for (const email of [
			'jordan@',
			'jordan',
			'jordan@example',
			'@example.com',
			'a b@example.com'
		]) {
			const r = validateInquiry({ ...ok, email }, 'Sam');
			expect(r.errors).toEqual({
				email: 'This email address looks incomplete. Check it, like name@example.com.'
			});
			expect(r.firstInvalid).toBe('email');
		}
	});

	test('a message over 2,000 characters', () => {
		const r = validateInquiry({ ...ok, message: 'x'.repeat(2001) }, 'Sam');
		expect(r.errors).toEqual({ message: 'Keep your message under 2,000 characters.' });
		expect(validateInquiry({ ...ok, message: 'x'.repeat(2000) }, 'Sam').errors).toEqual({});
	});

	test('consent only', () => {
		expect(validateInquiry({ ...ok, consent: false }, 'Sam').firstInvalid).toBe('consent');
	});
});
