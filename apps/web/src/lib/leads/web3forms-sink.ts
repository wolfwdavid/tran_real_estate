// The Web3Forms sink: the single network adapter of the agent portal (AGT-02). It runs in the
// visitor's browser on the public inquiry page and posts one JSON request to Web3Forms, which
// emails the inquiry to the agent. Tran never receives or stores it.
//
// The access key is public by design (it can only submit to the agent's own inbox), but it is
// still never echoed back in a returned detail string.
//
// Spam: the client-side honeypot and 3-second gate run BEFORE this function (inquiry-gate.ts);
// a tripped honeypot never reaches here. The inquiry body deliberately omits the botcheck field
// (Web3Forms calls its honeypot deprecated and its handling of a false value is
// undocumented); the site's own forms send botcheck: false per the Phase 10 UI-SPEC. Web3Forms'
// server-side spam check is the real protection.
import { buildLeadBlock } from '@tran/core/leads/lead-block';

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

const CONSENT_TEXT = 'Yes: I agree to be contacted about my inquiry.';

export interface InquiryPayload {
	key: string;
	agentName: string;
	name: string;
	email: string;
	phone?: string;
	property?: string;
	message: string;
	/** ISO 8601 timestamp of the submit. */
	submittedAt: string;
}

export type SinkFailureKind =
	'rejected' | 'captcha-required' | 'rate-limited' | 'server' | 'network';

export type SinkResult = { ok: true } | { ok: false; kind: SinkFailureKind; detail?: string };

/** Removes every occurrence of the key (any case) from a provider message. */
function redact(message: string, key: string): string {
	if (key === '') return message;
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return message.replace(new RegExp(escaped, 'gi'), '[key]');
}

function readMessage(json: unknown): string {
	if (typeof json !== 'object' || json === null) return '';
	const j = json as { message?: unknown; body?: { message?: unknown } };
	const m = j.message ?? j.body?.message;
	return typeof m === 'string' ? m : '';
}

export async function submitInquiry(
	input: InquiryPayload,
	fetchImpl: typeof fetch = fetch
): Promise<SinkResult> {
	const body = {
		access_key: input.key,
		subject: `New inquiry for ${input.agentName} from ${input.name}`,
		from_name: 'Tran inquiry form',
		name: input.name,
		// Web3Forms uses `email` as the reply-to, so the agent can simply reply.
		email: input.email,
		phone: input.phone ?? '',
		property_of_interest: input.property ?? '',
		message: input.message,
		consent: CONSENT_TEXT,
		// Dedicated field so the visitor's message stays clean; Import leads parses this block.
		tran_lead_v1: buildLeadBlock({
			name: input.name,
			email: input.email,
			phone: input.phone,
			property: input.property,
			consent: true,
			submitted: input.submittedAt,
			message: input.message
		})
	};

	return postWeb3Forms(body, fetchImpl);
}

/**
 * The single Web3Forms POST and its response mapping, shared by the agent inquiry form and the
 * site's own waitlist/feedback forms (owner-forms.ts). The body is sent verbatim as JSON.
 */
export async function postWeb3Forms(
	body: Record<string, unknown>,
	fetchImpl: typeof fetch = fetch
): Promise<SinkResult> {
	const key = typeof body.access_key === 'string' ? body.access_key : '';
	let res: Response;
	try {
		res = await fetchImpl(WEB3FORMS_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(body)
		});
	} catch {
		// Offline, CORS failure or a content blocker.
		return { ok: false, kind: 'network' };
	}

	const json: unknown = await res.json().catch(() => null);
	// The message sits top-level in the AJAX example and under json.body?.message in the reference.
	const message = redact(readMessage(json), key);
	const success =
		typeof json === 'object' && json !== null && (json as { success?: unknown }).success === true;

	if (res.ok && success) return { ok: true };
	if (res.status === 429) return { ok: false, kind: 'rate-limited' };
	if (res.status >= 500) return { ok: false, kind: 'server' };
	if (/captcha/i.test(message)) return { ok: false, kind: 'captcha-required', detail: message };
	return message === ''
		? { ok: false, kind: 'rejected' }
		: { ok: false, kind: 'rejected', detail: message };
}
