/**
 * AI provider and model registry (verified 2026-10-04, 05-RESEARCH Pattern 4).
 *
 * Data only. Extras are sent ONLY for the exact model ID they were verified for: other
 * models return 400 (RESEARCH Anti-Patterns). A user-overridden model with no row gets no
 * extras and no cost estimate.
 *
 * Every `host` must appear in the CSP connect-src (apps/web/src/lib/csp-policy.js); models.test.ts
 * enforces it.
 */
import type { AiProviderId, LiveProviderId, PricingRow } from '@tran/core/ai';

export type ModelInfo = {
	pricing: readonly PricingRow[];
	extras?: Record<string, unknown>;
	note?: string;
};

export type ProviderInfo = {
	host: string;
	defaultModel: string;
	models: Record<string, ModelInfo>;
};

export const PROVIDER_ORDER: readonly LiveProviderId[] = [
	'anthropic',
	'openai',
	'gemini',
	'openrouter'
];

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
	anthropic: 'Anthropic',
	openai: 'OpenAI',
	gemini: 'Google Gemini',
	openrouter: 'OpenRouter',
	fixture: 'Sample output'
};

export const PROVIDERS: Record<LiveProviderId, ProviderInfo> = {
	anthropic: {
		host: 'api.anthropic.com',
		defaultModel: 'claude-sonnet-5-5',
		models: {
			'claude-sonnet-5-5': {
				pricing: [{ from: '2026-09-28', inUsdPerMTok: 2, outUsdPerMTok: 10 }],
				extras: { output_config: { effort: 'low' }, thinking: { type: 'between_tools' } }
			},
			'claude-opus-5-5': {
				pricing: [{ from: '2026-01-01', inUsdPerMTok: 4, outUsdPerMTok: 20 }]
			},
			'claude-haiku-4-5': {
				pricing: [{ from: '2025-10-01', inUsdPerMTok: 1, outUsdPerMTok: 5 }],
				note: 'retirement not sooner than 2026-10-15'
			}
		}
	},
	openai: {
		host: 'api.openai.com',
		defaultModel: 'gpt-6.1-sol',
		models: {
			'gpt-6.1-sol': {
				pricing: [{ from: '2026-01-01', inUsdPerMTok: 2, outUsdPerMTok: 10 }],
				extras: { reasoning: { effort: 'low' } }
			},
			'gpt-5.6-terra': {
				pricing: [{ from: '2026-01-01', inUsdPerMTok: 2, outUsdPerMTok: 12 }]
			}
		}
	},
	gemini: {
		host: 'generativelanguage.googleapis.com',
		defaultModel: 'gemini-3.8-flash',
		models: {
			'gemini-3.8-flash': {
				pricing: [
					{ from: '2026-01-01', inUsdPerMTok: 0.75, outUsdPerMTok: 3.75 },
					{ from: '2027-01-01', inUsdPerMTok: 1.5, outUsdPerMTok: 7.5 }
				],
				extras: { thinkingConfig: { thinkingLevel: 'low' } },
				note: 'thinkingLevel casing unverified on generateContent REST; live UAT confirms (RESEARCH Open Question 1)'
			}
		}
	},
	openrouter: {
		host: 'openrouter.ai',
		defaultModel: 'anthropic/claude-sonnet-5.5',
		models: {
			// Fallback only: the stream-reported usage.cost wins.
			'anthropic/claude-sonnet-5.5': {
				pricing: [{ from: '2026-09-28', inUsdPerMTok: 2, outUsdPerMTok: 10 }]
			}
		}
	}
};

function modelInfo(id: LiveProviderId, model: string): ModelInfo | undefined {
	const models = PROVIDERS[id].models;
	return Object.hasOwn(models, model) ? models[model] : undefined;
}

export function defaultModel(id: LiveProviderId): string {
	return PROVIDERS[id].defaultModel;
}

export function hostFor(id: LiveProviderId): string {
	return PROVIDERS[id].host;
}

/** Model-specific request extras, deep-copied, or undefined for any other model ID. */
export function extrasFor(id: LiveProviderId, model: string): Record<string, unknown> | undefined {
	const extras = modelInfo(id, model)?.extras;
	return extras ? structuredClone(extras) : undefined;
}

/** Date-effective pricing rows; undefined for the fixture provider and unknown models. */
export function pricingFor(id: AiProviderId, model: string): readonly PricingRow[] | undefined {
	if (id === 'fixture') return undefined;
	return modelInfo(id, model)?.pricing;
}

/** Settings model-override validation (UI-SPEC copy keys: 'empty' | 'spaces'). */
export function validateModelId(value: string): 'empty' | 'spaces' | null {
	const v = value.trim();
	if (v === '') return 'empty';
	if (/\s/.test(v)) return 'spaces';
	return null;
}
