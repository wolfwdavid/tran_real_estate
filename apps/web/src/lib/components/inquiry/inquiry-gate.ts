// Client-side spam gate and validation for the public inquiry form (AGT-02).
//
// The honeypot is a thin client filter (Web3Forms calls its botcheck honeypot deprecated): a
// checked honeypot shows the normal success panel and sends nothing, so bots get no signal. The
// minimum time-to-submit never blocks a person for good: a resend after 3 seconds goes through.
// Web3Forms' server-side spam check is the real protection.
import { normEmail } from '@tran/core/leads/normalize';

export const MIN_ELAPSED_MS = 3000;
export const MAX_INQUIRY_MESSAGE = 2000;

export type GateDecision = 'drop-silently' | 'too-fast' | 'send';

export function evaluateGate(i: { honeypotChecked: boolean; elapsedMs: number }): GateDecision {
	if (i.honeypotChecked) return 'drop-silently';
	if (i.elapsedMs < MIN_ELAPSED_MS) return 'too-fast';
	return 'send';
}

export type InquiryField = 'name' | 'email' | 'message' | 'consent';

export interface InquiryValues {
	name: string;
	email: string;
	message: string;
	consent: boolean;
}

export interface InquiryValidation {
	errors: Partial<Record<InquiryField, string>>;
	/** The first invalid field in form order, for focus. */
	firstInvalid: InquiryField | null;
}

const ORDER: readonly InquiryField[] = ['name', 'email', 'message', 'consent'];

export function validateInquiry(v: InquiryValues, agentName: string): InquiryValidation {
	const errors: Partial<Record<InquiryField, string>> = {};
	if (v.name.trim() === '') errors.name = 'Add your name.';
	if (v.email.trim() === '') errors.email = `Add your email address so ${agentName} can reply.`;
	else if (normEmail(v.email) === null)
		errors.email = 'This email address looks incomplete. Check it, like name@example.com.';
	if (v.message.trim() === '') errors.message = 'Write a short message.';
	else if (v.message.length > MAX_INQUIRY_MESSAGE)
		errors.message = 'Keep your message under 2,000 characters.';
	if (!v.consent) errors.consent = 'Check the box to agree to be contacted about your inquiry.';
	return { errors, firstInvalid: ORDER.find((f) => errors[f] !== undefined) ?? null };
}
