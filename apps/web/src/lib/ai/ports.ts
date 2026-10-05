/**
 * The AI provider port. Adapters (providers/*) implement `LlmProvider`; the runner and
 * the UI only ever see this interface. Type-only module.
 */
import type { AiProviderId, LiveProviderId, LlmFinish, LlmUsage } from '@tran/core/ai';

export type LlmRequest = {
	model: string;
	system: string;
	user: string;
	maxTokens: number;
	containsClientData: boolean;
	/** Gemini free-tier consent for client data (defense in depth; the gate lives in the UI). */
	clientDataAck?: boolean;
	/** e.g. 'shared/demo@1'; used by the fixture provider only. */
	promptId?: string;
};

export type LlmEvent =
	| { type: 'text'; text: string }
	| { type: 'usage'; usage: LlmUsage }
	| { type: 'finish'; reason: LlmFinish };

export interface LlmProvider {
	readonly id: AiProviderId;
	stream(req: LlmRequest, signal: AbortSignal): AsyncIterable<LlmEvent>;
}

export type FetchDeps = { fetch?: typeof fetch; isOnline?: () => boolean };

/** Phase 3 `vault.getKey` resolves undefined when the key is absent OR the vault is locked. */
export type AdapterDeps = FetchDeps & { getKey: () => Promise<string | null | undefined> };

export type TestOutcome = 'ok' | 'cors-blocked' | 'auth' | 'quota' | 'network';

export type TestConnectionResult = { outcome: TestOutcome; modelListed?: boolean };

export type ProbeResponse = { status: number; body: unknown };

export interface ProviderProbe {
	readonly id: LiveProviderId;
	readonly host: string;
	/** Keyed, zero-cost key check. Throws on network/CORS failure. */
	keyCheck(key: string, f: typeof fetch): Promise<ProbeResponse>;
	/** Whether `model` is listed for this key; undefined when unknown. */
	modelListed(
		key: string,
		model: string,
		f: typeof fetch,
		keyCheck: ProbeResponse
	): Promise<boolean | undefined>;
	/** Keyless POST to the generation endpoint; returns the status. Never sends the key. */
	canary(f: typeof fetch): Promise<number>;
}
