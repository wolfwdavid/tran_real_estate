import type { KnownPii, Redaction } from '@tran/core/privacy';

/** What a prompt definition produces before the registry adds the guardrail and redacts. */
export type PromptBuild = { system: string; user: string; known: KnownPii[] };

export interface PromptDef<I = unknown> {
	/** e.g. 'shared/demo' */
	id: string;
	version: number;
	feature: string;
	/** True → the property-not-people guardrail is prepended to the system prompt. */
	housingCopy: boolean;
	/** Drives the Gemini free-tier dialog and the "What will be sent" redaction list. */
	containsClientData: boolean;
	/** At least 2048: thinking tokens count against it on some providers. */
	maxTokens: number;
	build(inputs: I): PromptBuild;
}

/** The exact payload that is sent. Raw inputs are never stored here. */
export type BuiltPrompt = {
	id: string;
	version: number;
	/** `${id}@${version}` */
	promptId: string;
	feature: string;
	system: string;
	user: string;
	redactions: Redaction[];
	containsClientData: boolean;
	maxTokens: number;
	/** sha256 hex of `system + '\n\n' + user`, computed after redaction. */
	inputHash: string;
};
