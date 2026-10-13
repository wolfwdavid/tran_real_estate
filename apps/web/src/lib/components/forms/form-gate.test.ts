import { describe, expect, test } from 'vitest';
import {
	MIN_FILL_MS,
	TOPICS,
	feedbackBody,
	formMode,
	gateSubmit,
	mailtoHref,
	validateEmail,
	waitlistBody
} from './form-gate';

// Low-entropy test UUID (RESEARCH Pitfall 10): never a real Web3Forms key.
const K = '00000000-0000-4000-8000-000000000000';

describe('gateSubmit', () => {
	test('MIN_FILL_MS is 3 seconds', () => {
		expect(MIN_FILL_MS).toBe(3000);
	});

	test('a checked honeypot is a bot, whatever the timing', () => {
		expect(gateSubmit({ honeypot: true, mountedAt: 0, now: 10_000 })).toBe('bot');
		expect(gateSubmit({ honeypot: true, mountedAt: 1_000, now: 1_001 })).toBe('bot');
	});

	test('a submit under 3 seconds after mount is too fast', () => {
		expect(gateSubmit({ honeypot: false, mountedAt: 1_000, now: 3_999 })).toBe('too-fast');
	});

	test('exactly 3 seconds is ok (inclusive)', () => {
		expect(gateSubmit({ honeypot: false, mountedAt: 1_000, now: 4_000 })).toBe('ok');
		expect(gateSubmit({ honeypot: false, mountedAt: 1_000, now: 60_000 })).toBe('ok');
	});
});

describe('validateEmail', () => {
	test('empty is an error only when required', () => {
		expect(validateEmail('', true)).toBe('empty');
		expect(validateEmail('   ', true)).toBe('empty');
		expect(validateEmail('', false)).toBeNull();
	});

	test('bad shapes', () => {
		expect(validateEmail('name@example', true)).toBe('shape');
		expect(validateEmail('a b@example.com', true)).toBe('shape');
		expect(validateEmail('name@example', false)).toBe('shape');
		expect(validateEmail('example.com', true)).toBe('shape');
	});

	test('a good address passes', () => {
		expect(validateEmail('name@example.com', true)).toBeNull();
		expect(validateEmail(' name@example.com ', true)).toBeNull();
	});
});

describe('formMode', () => {
	test('a key opens the form', () => {
		expect(formMode(K, '')).toBe('open');
		expect(formMode(K, 'hello@example.com')).toBe('open');
	});

	test('no key: coming soon, with or without a contact', () => {
		expect(formMode('', 'hello@example.com')).toBe('coming-soon-contact');
		expect(formMode('', '')).toBe('coming-soon');
	});
});

describe('mailtoHref', () => {
	test('encodes the subject', () => {
		expect(mailtoHref('hello@example.com', 'Tran Renter waitlist')).toBe(
			'mailto:hello@example.com?subject=Tran%20Renter%20waitlist'
		);
	});
});

describe('waitlistBody', () => {
	test('exact key set and values', () => {
		expect(waitlistBody({ key: K, portal: 'investor', email: 'a@example.com' })).toStrictEqual({
			access_key: K,
			subject: 'Tran waitlist: Investor',
			from_name: 'Tran Real Estate Tools',
			email: 'a@example.com',
			portal: 'investor',
			botcheck: false
		});
	});

	test('subject names each portal', () => {
		expect(waitlistBody({ key: K, portal: 'renter', email: 'a@example.com' }).subject).toBe(
			'Tran waitlist: Renter'
		);
		expect(waitlistBody({ key: K, portal: 'agent', email: 'a@example.com' }).subject).toBe(
			'Tran waitlist: Agent'
		);
	});

	test('trims the email', () => {
		expect(waitlistBody({ key: K, portal: 'renter', email: ' a@example.com ' }).email).toBe(
			'a@example.com'
		);
	});
});

describe('feedbackBody', () => {
	test('email key is absent when empty', () => {
		const body = feedbackBody({ key: K, topic: 'tools', message: 'Hi', email: '' });
		expect(body).toStrictEqual({
			access_key: K,
			subject: 'Tran feedback: Free calculators',
			from_name: 'Tran Real Estate Tools',
			topic: 'tools',
			message: 'Hi',
			botcheck: false
		});
		expect(Object.keys(body)).not.toContain('email');
	});

	test('email is present when given', () => {
		expect(
			feedbackBody({ key: K, topic: 'renter', message: 'Hi', email: 'a@example.com' })
		).toStrictEqual({
			access_key: K,
			subject: 'Tran feedback: Renter portal',
			from_name: 'Tran Real Estate Tools',
			topic: 'renter',
			message: 'Hi',
			email: 'a@example.com',
			botcheck: false
		});
	});
});

describe('TOPICS', () => {
	test('order and labels', () => {
		expect(TOPICS).toEqual([
			['renter', 'Renter portal'],
			['investor', 'Investor portal'],
			['agent', 'Agent portal'],
			['tools', 'Free calculators'],
			['other', 'Something else']
		]);
	});
});

describe('privacy', () => {
	test('bodies carry no user agent, URL, query or analytics id', () => {
		const all = JSON.stringify([
			waitlistBody({ key: K, portal: 'renter', email: 'a@example.com' }),
			feedbackBody({ key: K, topic: 'other', message: 'Hi', email: 'a@example.com' })
		]);
		expect(all).not.toMatch(/http|user_?agent|url|page|referr|website/i);
	});
});
