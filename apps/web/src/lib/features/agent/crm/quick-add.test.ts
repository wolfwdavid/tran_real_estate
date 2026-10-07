// Quick add rules (08-15): exact validation copy, first-invalid order and duplicate precedence.
import { describe, expect, it } from 'vitest';
import type { Contact } from '@tran/core/agent/types';
import { duplicateMessage, validateQuickAdd } from './quick-add';

const v = (name: string, email = '', phone = '') => validateQuickAdd({ name, email, phone });

describe('validateQuickAdd', () => {
	it('accepts a name with an email or a phone', () => {
		expect(v('Avery', 'avery@example.com')).toEqual({ errors: {}, firstInvalid: null });
		expect(v('Avery', '', '(555) 555-0120')).toEqual({ errors: {}, firstInvalid: null });
		expect(v('Avery', '', '555-555-0120 ext 4')).toEqual({ errors: {}, firstInvalid: null });
	});

	it('requires a name and one way to reach the lead', () => {
		const r = v('  ');
		expect(r.errors).toEqual({ name: 'Add a name.', email: 'Add an email or a phone number.' });
		expect(r.firstInvalid).toBe('name');
	});

	it('flags an incomplete email', () => {
		const r = v('Avery', 'avery@example');
		expect(r.errors.email).toBe(
			'This email address looks incomplete. Check it, like name@example.com.'
		);
		expect(r.firstInvalid).toBe('email');
	});

	it('flags a phone without an area code', () => {
		const r = v('Avery', '', '555-0120');
		expect(r.errors).toEqual({ phone: 'Enter a phone number with area code.' });
		expect(r.firstInvalid).toBe('phone');
	});
});

describe('duplicateMessage', () => {
	const a = { id: 'a', name: 'Avery Example' } as Contact;
	const b = { id: 'b', name: 'Blake Example' } as Contact;

	it('is null with no match', () => {
		expect(duplicateMessage({ byEmail: null, byPhone: null })).toBeNull();
	});
	it('names the email match first', () => {
		expect(duplicateMessage({ byEmail: a, byPhone: b })).toEqual({
			existing: a,
			reason: 'Same email address.'
		});
	});
	it('falls back to the phone match', () => {
		expect(duplicateMessage({ byEmail: null, byPhone: b })).toEqual({
			existing: b,
			reason: 'Same phone number.'
		});
	});
});
