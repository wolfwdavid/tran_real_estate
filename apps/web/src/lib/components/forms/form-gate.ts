// Pure logic for the site's own forms (GTM-02): the per-portal waitlist and /feedback/.
//
// Spam gates run before anything is sent: a checked honeypot shows success and sends nothing (bots
// get no signal), and a submit under 3 seconds after mount sends nothing and asks the visitor to
// try again (the next submit is checked again, so a person is never blocked for good).
//
// Request bodies carry only what the visitor typed plus fixed labels. Never a user agent, page URL,
// query string or analytics id.

export const MIN_FILL_MS = 3000;

export type Portal = 'renter' | 'investor' | 'agent';
export type Topic = 'renter' | 'investor' | 'agent' | 'tools' | 'other';
export type GateResult = 'bot' | 'too-fast' | 'ok';
export type EmailError = 'empty' | 'shape';
export type FormMode = 'open' | 'coming-soon-contact' | 'coming-soon';

export const PORTAL_NAMES: Readonly<Record<Portal, string>> = Object.freeze({
	renter: 'Renter',
	investor: 'Investor',
	agent: 'Agent'
});

export const TOPICS: ReadonlyArray<readonly [Topic, string]> = [
	['renter', 'Renter portal'],
	['investor', 'Investor portal'],
	['agent', 'Agent portal'],
	['tools', 'Free calculators'],
	['other', 'Something else']
];

const FROM_NAME = 'Tran Real Estate Tools';
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Honeypot first, then the minimum fill time (inclusive: exactly 3 s is ok). */
export function gateSubmit(i: { honeypot: boolean; mountedAt: number; now: number }): GateResult {
	if (i.honeypot) return 'bot';
	if (i.now - i.mountedAt < MIN_FILL_MS) return 'too-fast';
	return 'ok';
}

/** null when valid. An empty optional field is valid; a filled one must look like x@y.z. */
export function validateEmail(value: string, required: boolean): EmailError | null {
	const v = value.trim();
	if (v === '') return required ? 'empty' : null;
	return EMAIL_SHAPE.test(v) ? null : 'shape';
}

/** The owner's key opens the form; without it the form is a coming-soon panel. */
export function formMode(accessKey: string, contactEmail: string): FormMode {
	if (accessKey !== '') return 'open';
	return contactEmail !== '' ? 'coming-soon-contact' : 'coming-soon';
}

export function mailtoHref(email: string, subject: string): string {
	return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export type WaitlistBody = {
	access_key: string;
	subject: string;
	from_name: string;
	email: string;
	portal: Portal;
	botcheck: false;
};

export function waitlistBody(i: { key: string; portal: Portal; email: string }): WaitlistBody {
	return {
		access_key: i.key,
		subject: `Tran waitlist: ${PORTAL_NAMES[i.portal]}`,
		from_name: FROM_NAME,
		email: i.email.trim(),
		portal: i.portal,
		botcheck: false
	};
}

export type FeedbackBody = {
	access_key: string;
	subject: string;
	from_name: string;
	topic: Topic;
	message: string;
	email?: string;
	botcheck: false;
};

export function topicLabel(topic: Topic): string {
	return TOPICS.find(([t]) => t === topic)?.[1] ?? 'Something else';
}

export function feedbackBody(i: {
	key: string;
	topic: Topic;
	message: string;
	email: string;
}): FeedbackBody {
	const email = i.email.trim();
	return {
		access_key: i.key,
		subject: `Tran feedback: ${topicLabel(i.topic)}`,
		from_name: FROM_NAME,
		topic: i.topic,
		message: i.message,
		...(email === '' ? {} : { email }),
		botcheck: false
	};
}
