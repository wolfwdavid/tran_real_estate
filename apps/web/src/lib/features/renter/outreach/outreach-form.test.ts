import { describe, expect, it } from 'vitest';
import type { RenterOutreachForm } from '$lib/ai/prompts/renter/outreach.v1';
import {
	DEFAULT_OUTREACH_FORM,
	OCCUPANTS_ERROR,
	TOPICS_ERROR,
	validateOutreachForm
} from './outreach-form';

const NO_TOPICS = { availability: false, pets: false, fees: false, lease: false };

function form(over: Partial<RenterOutreachForm> = {}): RenterOutreachForm {
	return {
		...DEFAULT_OUTREACH_FORM,
		topics: { ...DEFAULT_OUTREACH_FORM.topics },
		...over
	};
}

describe('validateOutreachForm', () => {
	it('accepts the defaults (blank count, every topic, no question)', () => {
		expect(validateOutreachForm(form())).toEqual({ ok: true });
	});

	it('defaults: no pets and all four topics checked', () => {
		expect(DEFAULT_OUTREACH_FORM.pets).toBe('none');
		expect(DEFAULT_OUTREACH_FORM.topics).toEqual({
			availability: true,
			pets: true,
			fees: true,
			lease: true
		});
	});

	it.each(['1', '3', '12', ' 4 '])('accepts the people count %j', (occupants) => {
		expect(validateOutreachForm(form({ occupants }))).toEqual({ ok: true });
	});

	it.each(['0', '13', '2.5', 'two', '-1', '1e1', '3 adults'])(
		'rejects the people count %j',
		(occupants) => {
			expect(validateOutreachForm(form({ occupants }))).toEqual({
				ok: false,
				errors: { occupants: 'Enter a number from 1 to 12, or leave it blank.' },
				first: 'occupants'
			});
		}
	);

	it('needs a topic or a question', () => {
		expect(validateOutreachForm(form({ topics: NO_TOPICS, extraQuestion: '   ' }))).toEqual({
			ok: false,
			errors: { topics: 'Choose at least one topic, or type a question below.' },
			first: 'topics'
		});
	});

	it('a typed question stands in for the topics', () => {
		expect(
			validateOutreachForm(form({ topics: NO_TOPICS, extraQuestion: 'Is parking included?' }))
		).toEqual({ ok: true });
	});

	it('one topic is enough', () => {
		expect(validateOutreachForm(form({ topics: { ...NO_TOPICS, lease: true } }))).toEqual({
			ok: true
		});
	});

	it('reports both errors with occupants first', () => {
		const r = validateOutreachForm(form({ occupants: '13', topics: NO_TOPICS }));
		expect(r).toEqual({
			ok: false,
			errors: { occupants: OCCUPANTS_ERROR, topics: TOPICS_ERROR },
			first: 'occupants'
		});
	});
});
