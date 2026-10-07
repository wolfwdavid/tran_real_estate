// Follow-up email gates and composition (08-25, AGT-06; 08-UI-SPEC "FollowUpComposer").
//
// Pure: no Svelte, no storage. followupState decides what the contact page shows:
// - opted out: no draft panel at all (CAN-SPAM opt-out honoring);
// - real contact + incomplete profile: the prerequisite block with the missing items;
// - otherwise ready: the deterministic email footer (composeEmailFooter, outside the LLM), the
//   tokens the panel restores locally, and the per-exit disables (no email: Open in email app).
// Sample contacts fall back to the sample agent profile so the keyless demo can draft.
import {
	EMPTY_PROFILE_INPUT,
	type Contact,
	type ProfileInput,
	type Stage
} from '@tran/core/agent/types';
import { SAMPLE_AGENT_PROFILE } from '@tran/core/agent/fixtures/sample-profile';
import { PROFILE_FIELD_LABELS, composeEmailFooter, missingForDrafts } from '@tran/core/disclosure';
import { firstName } from '@tran/core/leads/normalize';
import type { ExitDisabled } from '$lib/ai/ui/panel-controller';
import type { FollowupInputs } from './followup-prompt';

export const FOOTER_LABEL = 'Added to the end of every follow-up';
export const MAX_SUBJECT = 120;
export const MAX_POINTS = 500;

export const SUBJECT_DEFAULTS: Readonly<Record<Stage, string>> = Object.freeze({
	new: 'Thanks for reaching out',
	contacted: 'Checking in',
	touring: 'Following up on your tour',
	offer: 'Checking in on your offer',
	closed: 'Staying in touch'
});

export const PURPOSES: Readonly<Record<Stage, string>> = Object.freeze({
	new: 'Reply to a new inquiry',
	contacted: 'Check in',
	touring: 'Follow up after a tour',
	offer: 'Check in on an offer',
	closed: 'Stay in touch'
});

export type FollowupState =
	| { kind: 'opted-out'; message: string }
	| {
			kind: 'profile-incomplete';
			/** Lower-case labels in profile field order, e.g. 'mailing address'. */
			missing: string[];
			/** The same list as one phrase: 'license number and mailing address'. */
			missingText: string;
	  }
	| {
			kind: 'ready';
			usingSampleProfile: boolean;
			emailFooter: { text: string; label: string };
			tokens: Record<string, string>;
			exitDisabled: ExitDisabled;
	  };

const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

const lower = (s: string): string => s.charAt(0).toLocaleLowerCase('en-US') + s.slice(1);

export function followupState(i: {
	contact: Contact;
	profile: ProfileInput | null;
}): FollowupState {
	const { contact } = i;
	const name = contact.name.trim();
	if (contact.emailOptOutAt !== null) {
		return {
			kind: 'opted-out',
			message: `${name} asked not to get emails from you, so Tran won't draft follow-up emails to them. To change this, edit their details.`
		};
	}

	const own = i.profile;
	const missing = missingForDrafts(own ?? EMPTY_PROFILE_INPUT);
	const usingSampleProfile = missing.length > 0;
	if (usingSampleProfile && !contact.sample) {
		const labels = missing.map((f) => lower(PROFILE_FIELD_LABELS[f]));
		return { kind: 'profile-incomplete', missing: labels, missingText: LIST.format(labels) };
	}

	const profile = usingSampleProfile || !own ? SAMPLE_AGENT_PROFILE : own;
	const footer = composeEmailFooter(profile, { consentSource: contact.consentSource });
	const first = firstName(name);
	return {
		kind: 'ready',
		usingSampleProfile,
		emailFooter: { text: footer.text, label: FOOTER_LABEL },
		tokens: { client_first_name: first, client_name: name },
		exitDisabled:
			contact.email.trim() === ''
				? { email: `Add an email address for ${name} to open this in your email app.` }
				: {}
	};
}

export function validateSubject(subject: string): string | null {
	const s = subject.trim();
	if (s === '') return 'Add a subject line.';
	if (s.length > MAX_SUBJECT) return 'Keep the subject under 120 characters.';
	return null;
}

const DAY_MS = 86_400_000;

export function buildFollowupInputs(
	contact: Contact,
	form: { purpose: string; subject: string; points: string },
	now: Date = new Date()
): FollowupInputs {
	const last = contact.lastContactedAt ? Date.parse(contact.lastContactedAt) : NaN;
	const name = contact.name.trim();
	return {
		purpose: form.purpose.trim(),
		subject: form.subject.trim(),
		points: form.points.trim().slice(0, MAX_POINTS),
		stage: contact.stage,
		notes: contact.notes.trim(),
		propertyOfInterest: contact.propertyOfInterest.trim(),
		daysSinceContact: Number.isFinite(last)
			? Math.max(0, Math.floor((now.getTime() - last) / DAY_MS))
			: null,
		clientName: name,
		clientFirstName: firstName(name),
		clientEmail: contact.email.trim(),
		clientPhone: contact.phone.trim()
	};
}
