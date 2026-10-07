/**
 * Agent follow-up email (AGT-06), prompt `agent/followup` v1 (fixture key `agent/followup@1`).
 *
 * PII minimization (08-RESEARCH Pattern 11): the model sees the stage, the agent's notes, the
 * property of interest, the days since last contact, the purpose, the subject and the agent's
 * points. The contact's name, first name, email and phone are declared PII, so buildPrompt
 * replaces them with `{client_name}` / `{client_first_name}` / `{client_email}` /
 * `{client_phone}` (and any stray email or phone in the notes with numbered tokens). The draft
 * addresses the client as `{client_first_name}`, which the panel restores locally.
 *
 * The signature, mailing address, opt-out line and disclosure are never part of the prompt:
 * they are the deterministic email footer, appended in the browser after generation.
 */
import { STAGE_LABELS, type Stage } from '@tran/core/agent/types';
import type { KnownPii } from '@tran/core/privacy';
import { getPrompt, registerPrompt } from '$lib/ai/prompts/registry';
import type { PromptDef } from '$lib/ai/prompts/types';

export const FOLLOWUP_PROMPT_ID = 'agent/followup';
export const FOLLOWUP_FEATURE = 'agent-followup';

export type FollowupInputs = {
	purpose: string;
	subject: string;
	points: string;
	stage: Stage;
	notes: string;
	propertyOfInterest: string;
	daysSinceContact: number | null;
	clientName: string;
	clientFirstName: string;
	clientEmail: string;
	clientPhone: string;
};

const SYSTEM =
	"You write short follow-up emails from a real estate agent to a client. Address the client as {client_first_name} and keep that token exactly as written. Write plain text, 80 to 180 words, with a greeting and two or three short paragraphs. Do not write a subject line, a signature, a sign-off name, contact details, an address, an unsubscribe line or any license or brokerage text: they are added separately. Do not invent facts, prices, dates or urgency. Describe homes and services, never people or neighborhoods' residents.";

export const followupV1: PromptDef<FollowupInputs> = {
	id: FOLLOWUP_PROMPT_ID,
	version: 1,
	feature: FOLLOWUP_FEATURE,
	housingCopy: true,
	containsClientData: true,
	maxTokens: 2048,
	build: (i) => {
		const known: KnownPii[] = [
			{ value: i.clientName, token: 'client_name', kind: 'name' as const },
			{ value: i.clientFirstName, token: 'client_first_name', kind: 'name' as const },
			{ value: i.clientEmail, token: 'client_email', kind: 'email' as const },
			{ value: i.clientPhone, token: 'client_phone', kind: 'phone' as const }
		].filter((k) => k.value.trim() !== '');
		return {
			system: SYSTEM,
			user: [
				`Purpose: ${i.purpose}`,
				`Subject: ${i.subject}`,
				`Stage: ${STAGE_LABELS[i.stage]}`,
				`Property of interest: ${i.propertyOfInterest || 'none given'}`,
				`Days since last contact: ${i.daysSinceContact ?? 'not contacted yet'}`,
				`Agent notes: ${i.notes || 'none'}`,
				`Points to include: ${i.points || 'none'}`
			].join('\n'),
			known
		};
	}
};

/** Registers once per module instance; the registry throws on a duplicate id + version. */
function ensureRegistered(): void {
	try {
		if (getPrompt(FOLLOWUP_PROMPT_ID).version === followupV1.version) return;
	} catch {
		// Not registered yet.
	}
	registerPrompt(followupV1 as PromptDef);
}

ensureRegistered();
