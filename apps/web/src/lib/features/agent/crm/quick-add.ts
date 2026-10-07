// Pure rules for the Add a lead dialog (08-UI-SPEC "QuickAddDialog"): field validation with the
// exact error copy, and which existing contact a duplicate alert names (email match wins).
import type { Contact } from '@tran/core/agent/types';

/** Digits before any extension marker ("ext", "x", "#"). */
const digitsOf = (s: string) => (s.split(/(?:ext\.?|x|#)/i)[0] ?? '').replace(/\D/g, '');

export type QuickAddField = 'name' | 'email' | 'phone';

export const QUICK_ADD_ERRORS = Object.freeze({
	name: 'Add a name.',
	contact: 'Add an email or a phone number.',
	email: 'This email address looks incomplete. Check it, like name@example.com.',
	phone: 'Enter a phone number with area code.'
});

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface QuickAddValidation {
	errors: Partial<Record<QuickAddField, string>>;
	/** The first invalid field in form order, for focus. */
	firstInvalid: QuickAddField | null;
}

export function validateQuickAdd(v: {
	name: string;
	email: string;
	phone: string;
}): QuickAddValidation {
	const errors: Partial<Record<QuickAddField, string>> = {};
	const email = v.email.trim();
	const phone = v.phone.trim();
	if (v.name.trim() === '') errors.name = QUICK_ADD_ERRORS.name;
	if (email === '' && phone === '') errors.email = QUICK_ADD_ERRORS.contact;
	else {
		if (email !== '' && !EMAIL_SHAPE.test(email)) errors.email = QUICK_ADD_ERRORS.email;
		if (phone !== '' && digitsOf(phone).length < 10) errors.phone = QUICK_ADD_ERRORS.phone;
	}
	const order: QuickAddField[] = ['name', 'email', 'phone'];
	return { errors, firstInvalid: order.find((f) => errors[f] !== undefined) ?? null };
}

export type DuplicateReason = 'Same email address.' | 'Same phone number.';

/** The contact a duplicate alert names, or null. A same-email match wins over a same-phone one. */
export function duplicateMessage(dup: {
	byEmail: Contact | null;
	byPhone: Contact | null;
}): { existing: Contact; reason: DuplicateReason } | null {
	if (dup.byEmail) return { existing: dup.byEmail, reason: 'Same email address.' };
	if (dup.byPhone) return { existing: dup.byPhone, reason: 'Same phone number.' };
	return null;
}
