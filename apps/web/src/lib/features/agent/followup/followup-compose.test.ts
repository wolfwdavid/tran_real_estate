// Follow-up email contract (08-25, AGT-06): gates, the CAN-SPAM footer in every exit payload,
// subject defaults and validation, PII minimization of the prompt, and the Fixture sample.
import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE_INPUT, type Contact, type ProfileInput } from '@tran/core/agent/types';
import { SAMPLE_AGENT_PROFILE } from '@tran/core/agent/fixtures/sample-profile';
import {
	AD_IDENTIFICATION_LINE,
	OPT_OUT_LINE,
	composeDisclosure,
	formatPostal
} from '@tran/core/disclosure';
import { checkFairHousing } from '@tran/core/fair-housing';
import { redactPii } from '@tran/core/privacy';
import { getPrompt } from '$lib/ai/prompts/registry';
import { FIXTURE_OUTPUTS } from '$lib/ai/providers/fixture-outputs';
import { exitPayload } from '$lib/ai/ui/panel-controller';
import {
	PURPOSES,
	SUBJECT_DEFAULTS,
	buildFollowupInputs,
	followupState,
	validateSubject
} from './followup-compose';
import { FOLLOWUP_PROMPT_ID, followupV1 } from './followup-prompt';

const NOW = '2026-10-06T15:00:00.000Z';

function contact(over: Partial<Contact> = {}): Contact {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		ownerId: 'local',
		createdAt: NOW,
		updatedAt: NOW,
		schemaVersion: 1,
		name: 'Pat Real',
		email: 'pat.real@example.com',
		phone: '(555) 555-0142',
		stage: 'new',
		stageChangedAt: NOW,
		source: 'manual',
		propertyOfInterest: '',
		notes: '',
		consentSource: 'inquiry-form',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false,
		...over
	};
}

const PROFILE: ProfileInput = {
	...EMPTY_PROFILE_INPUT,
	name: 'Dana Agent',
	brokerage: 'Example Homes',
	licenseType: 'salesperson',
	licenseNumber: '0123456',
	licenseState: 'TX',
	brokeragePhone: '(555) 555-0150',
	email: 'dana@example.com',
	postal: { street: '1 Example Way', line2: '', city: 'Austin', state: 'TX', zip: '78701' }
};

const DRAFT = 'Hi Pat,\n\nThanks for reaching out.';

function ready(c: Contact, p: ProfileInput | null) {
	const st = followupState({ contact: c, profile: p });
	if (st.kind !== 'ready') throw new Error(`expected ready, got ${st.kind}`);
	return st;
}

describe('followupState gates', () => {
	it('opted-out contacts get no draft panel, with the CAN-SPAM message', () => {
		const st = followupState({
			contact: contact({ name: 'Emerson Draft', emailOptOutAt: NOW }),
			profile: PROFILE
		});
		expect(st).toEqual({
			kind: 'opted-out',
			message:
				"Emerson Draft asked not to get emails from you, so Tran won't draft follow-up emails to them. To change this, edit their details."
		});
	});

	it('opt-out wins over an incomplete profile and over a sample contact', () => {
		for (const c of [
			contact({ emailOptOutAt: NOW }),
			contact({ emailOptOutAt: NOW, sample: true })
		]) {
			expect(followupState({ contact: c, profile: null }).kind).toBe('opted-out');
		}
	});

	it('a real contact with an incomplete profile is blocked with the missing labels', () => {
		const st = followupState({
			contact: contact(),
			profile: { ...PROFILE, postal: { ...PROFILE.postal, zip: '' }, licenseNumber: '' }
		});
		expect(st.kind).toBe('profile-incomplete');
		if (st.kind !== 'profile-incomplete') return;
		expect(st.missing).toEqual(['license number', 'mailing address']);
		expect(st.missingText).toBe('license number and mailing address');
	});

	it('a real contact with no profile at all lists every draft prerequisite', () => {
		const st = followupState({ contact: contact(), profile: null });
		expect(st.kind).toBe('profile-incomplete');
		if (st.kind !== 'profile-incomplete') return;
		expect(st.missing).toContain('full name');
		expect(st.missing).toContain('mailing address');
		expect(st.missing).toContain('email');
	});

	it('a sample contact with an incomplete or missing profile uses the sample agent profile', () => {
		for (const p of [
			null,
			EMPTY_PROFILE_INPUT,
			{ ...PROFILE, postal: EMPTY_PROFILE_INPUT.postal }
		]) {
			const st = ready(contact({ sample: true, name: 'Jordan Example' }), p);
			expect(st.usingSampleProfile).toBe(true);
			expect(st.emailFooter.text).toContain(SAMPLE_AGENT_PROFILE.name);
			expect(st.emailFooter.text).toContain(formatPostal(SAMPLE_AGENT_PROFILE.postal));
		}
	});

	it('a sample contact with a complete profile uses the agent profile', () => {
		const st = ready(contact({ sample: true }), PROFILE);
		expect(st.usingSampleProfile).toBe(false);
		expect(st.emailFooter.text).toContain('Dana Agent');
	});

	it('a real contact with a complete profile is ready with the labelled footer and tokens', () => {
		const st = ready(contact(), PROFILE);
		expect(st.usingSampleProfile).toBe(false);
		expect(st.emailFooter.label).toBe('Added to the end of every follow-up');
		expect(st.tokens).toEqual({ client_first_name: 'Pat', client_name: 'Pat Real' });
		expect(st.exitDisabled).toEqual({});
	});

	it('a contact without an email gates only Open in email app', () => {
		const st = ready(contact({ name: 'Morgan Demo', email: '' }), PROFILE);
		expect(st.exitDisabled).toEqual({
			email: 'Add an email address for Morgan Demo to open this in your email app.'
		});
	});
});

describe('footer in every exit payload (CAN-SPAM + disclosure)', () => {
	const disclosure = composeDisclosure(PROFILE, 'email').lines;

	it('inquiry-form consent: postal, opt-out and disclosure, no ad identification', () => {
		const st = ready(contact({ consentSource: 'inquiry-form' }), PROFILE);
		const payload = exitPayload(DRAFT, st.emailFooter);
		expect(payload.startsWith(DRAFT)).toBe(true);
		expect(payload).toContain(formatPostal(PROFILE.postal));
		expect(payload).toContain(OPT_OUT_LINE);
		expect(disclosure.length).toBeGreaterThan(0);
		for (const line of disclosure) expect(payload).toContain(line);
		expect(payload).not.toContain(AD_IDENTIFICATION_LINE);
		expect(payload.endsWith(st.emailFooter.text)).toBe(true);
	});

	it('unknown consent also carries the ad identification line', () => {
		const st = ready(contact({ consentSource: 'unknown' }), PROFILE);
		const payload = exitPayload(DRAFT, st.emailFooter);
		expect(payload).toContain(formatPostal(PROFILE.postal));
		expect(payload).toContain(OPT_OUT_LINE);
		for (const line of disclosure) expect(payload).toContain(line);
		expect(payload).toContain(AD_IDENTIFICATION_LINE);
		expect(payload.endsWith(st.emailFooter.text)).toBe(true);
	});

	it('the sample profile footer has the sample disclosure line', () => {
		const st = ready(contact({ sample: true, name: 'Jordan Example' }), null);
		const payload = exitPayload(DRAFT, st.emailFooter);
		expect(payload).toContain('12 Sample Lane, Harlow Springs, TX 75001');
		expect(payload).toContain(OPT_OUT_LINE);
		for (const line of composeDisclosure(SAMPLE_AGENT_PROFILE, 'email').lines) {
			expect(payload).toContain(line);
		}
	});
});

describe('subject and purpose copy', () => {
	it('pins the subject defaults and purposes per stage', () => {
		expect(SUBJECT_DEFAULTS).toEqual({
			new: 'Thanks for reaching out',
			contacted: 'Checking in',
			touring: 'Following up on your tour',
			offer: 'Checking in on your offer',
			closed: 'Staying in touch'
		});
		expect(PURPOSES).toEqual({
			new: 'Reply to a new inquiry',
			contacted: 'Check in',
			touring: 'Follow up after a tour',
			offer: 'Check in on an offer',
			closed: 'Stay in touch'
		});
	});

	it('validates the subject', () => {
		expect(validateSubject('')).toBe('Add a subject line.');
		expect(validateSubject('   ')).toBe('Add a subject line.');
		expect(validateSubject('x'.repeat(121))).toBe('Keep the subject under 120 characters.');
		expect(validateSubject('x'.repeat(120))).toBeNull();
		expect(validateSubject('Checking in')).toBeNull();
	});
});

describe('agent/followup prompt', () => {
	it('is registered with the Phase 5 registry', () => {
		const def = getPrompt(FOLLOWUP_PROMPT_ID);
		expect(def).toBe(followupV1);
		expect(def.id).toBe('agent/followup');
		expect(def.version).toBe(1);
		expect(def.housingCopy).toBe(true);
		expect(def.containsClientData).toBe(true);
		expect(def.maxTokens).toBeGreaterThanOrEqual(2048);
	});

	it('never sends the contact email, phone or full name after redaction', () => {
		const c = contact({
			name: 'Jordan Example',
			email: 'jordan@example.com',
			phone: '(555) 555-0101',
			notes: 'call Jordan at (555) 555-0101 or jordan@example.com',
			lastContactedAt: '2026-10-01T15:00:00.000Z'
		});
		const inputs = buildFollowupInputs(
			c,
			{
				purpose: PURPOSES.new,
				subject: SUBJECT_DEFAULTS.new,
				points: 'Jordan Example likes parks'
			},
			new Date(NOW)
		);
		expect(inputs.daysSinceContact).toBe(5);
		const b = followupV1.build(inputs);
		const { text } = redactPii(b.user, b.known);
		const sent = `${b.system}\n${text}`;
		expect(text).toContain('{client_first_name}');
		expect(text).toContain('{client_email}');
		expect(text).toContain('{client_phone}');
		for (const raw of [
			'jordan@example.com',
			'(555) 555-0101',
			'555-0101',
			'Jordan Example',
			'Jordan'
		]) {
			expect(sent).not.toContain(raw);
		}
		expect(b.system).toContain('{client_first_name}');
	});

	it('days since contact is null before the first contact', () => {
		const inputs = buildFollowupInputs(
			contact(),
			{ purpose: PURPOSES.new, subject: 'Hi', points: '' },
			new Date(NOW)
		);
		expect(inputs.daysSinceContact).toBeNull();
		expect(followupV1.build(inputs).user).toContain('Days since last contact: not contacted yet');
	});
});

describe('Fixture sample output', () => {
	const sample = (FIXTURE_OUTPUTS as Record<string, string>)['agent/followup@1'];

	it('exists, passes the Fair Housing checker and keeps the first-name token', () => {
		expect(sample).toBeDefined();
		expect(checkFairHousing(sample!)).toEqual([]);
		expect(sample).toContain('{client_first_name}');
	});

	it('has no signature block', () => {
		expect(sample).not.toMatch(/^(Best|Regards|Best regards|Thanks|Sincerely),?$/m);
		expect(sample).not.toContain('Regards');
		expect(sample).not.toContain('{client_email}');
		expect(sample).not.toContain('{your_name}');
	});
});
