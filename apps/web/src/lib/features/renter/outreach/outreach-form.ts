// 06-UI-SPEC "OutreachForm" validation (RENT-07). Pure: runs when the renter presses
// **Draft message**, before the panel generates anything. The count is the only household detail
// the form collects, so it accepts a plain whole number and nothing else (no "3 adults").
import type { RenterOutreachForm } from '$lib/ai/prompts/renter/outreach.v1';

export const OCCUPANTS_ERROR = 'Enter a number from 1 to 12, or leave it blank.';
export const TOPICS_ERROR = 'Choose at least one topic, or type a question below.';

export const PET_DESCRIPTION_MAX = 60;
export const EXTRA_QUESTION_MAX = 500;

/** Fresh defaults: blank count and date, no pets, every topic checked, no question. */
export const DEFAULT_OUTREACH_FORM: Readonly<RenterOutreachForm> = Object.freeze({
	moveInDate: '',
	occupants: '',
	pets: 'none',
	petDescription: '',
	topics: Object.freeze({ availability: true, pets: true, fees: true, lease: true }),
	extraQuestion: ''
});

/** A mutable copy of the defaults for a new form. */
export function newOutreachForm(): RenterOutreachForm {
	return { ...DEFAULT_OUTREACH_FORM, topics: { ...DEFAULT_OUTREACH_FORM.topics } };
}

export type OutreachField = 'occupants' | 'topics';
export type OutreachErrors = { occupants?: string; topics?: string };
export type OutreachValidation =
	{ ok: true } | { ok: false; errors: OutreachErrors; first: OutreachField };

function occupantsValid(raw: string): boolean {
	const s = raw.trim();
	if (s === '') return true;
	if (!/^\d+$/.test(s)) return false;
	const n = Number(s);
	return n >= 1 && n <= 12;
}

export function validateOutreachForm(f: RenterOutreachForm): OutreachValidation {
	const errors: OutreachErrors = {};
	if (!occupantsValid(f.occupants)) errors.occupants = OCCUPANTS_ERROR;
	const anyTopic = Object.values(f.topics).some(Boolean);
	if (!anyTopic && f.extraQuestion.trim() === '') errors.topics = TOPICS_ERROR;
	if (errors.occupants) return { ok: false, errors, first: 'occupants' };
	if (errors.topics) return { ok: false, errors, first: 'topics' };
	return { ok: true };
}
