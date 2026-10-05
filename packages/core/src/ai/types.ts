/**
 * Shared AI-layer types for `@tran/core/ai`.
 *
 * Provider ids are deliberately named `LiveProviderId` / `AiProviderId` so they
 * never clash with the Phase 3 `ProviderId` registry type exported from `@tran/core`.
 */

/** Providers that make real network calls. */
export type LiveProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter';

/** Every selectable AI provider, including the in-page fixture (sample) provider. */
export type AiProviderId = LiveProviderId | 'fixture';

/** Token usage as reported by a provider (all fields optional; providers differ). */
export type LlmUsage = {
	inputTokens?: number;
	/** Billed output tokens (adapters fold reasoning/thinking tokens in here). */
	outputTokens?: number;
	reasoningTokens?: number;
	/** Provider-reported cost in USD (OpenRouter `usage.cost`); wins over estimates. */
	costUsd?: number;
};

export type LlmFinish = 'stop' | 'length' | 'refused';

export type LlmErrorKind =
	| 'aborted'
	| 'auth'
	| 'quota'
	| 'model-not-found'
	| 'refused'
	| 'interrupted'
	| 'cors-blocked'
	| 'network'
	| 'locked'
	| 'consent-required';

/** A date-effective pricing row. `from` is a UTC calendar date (YYYY-MM-DD). */
export type PricingRow = { from: string; inUsdPerMTok: number; outUsdPerMTok: number };
