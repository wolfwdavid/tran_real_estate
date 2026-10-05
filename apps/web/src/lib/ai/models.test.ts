import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pricingAt } from '@tran/core/ai';
import {
	PROVIDERS,
	PROVIDER_LABELS,
	PROVIDER_ORDER,
	defaultModel,
	extrasFor,
	hostFor,
	pricingFor,
	validateModelId
} from './models.js';

describe('model registry defaults', () => {
	it('uses the research-verified default IDs', () => {
		expect(defaultModel('anthropic')).toBe('claude-sonnet-5-5');
		expect(defaultModel('openai')).toBe('gpt-6.1-sol');
		expect(defaultModel('gemini')).toBe('gemini-3.8-flash');
		expect(defaultModel('openrouter')).toBe('anthropic/claude-sonnet-5.5');
	});

	it('never defaults to the stale CONTEXT IDs', () => {
		for (const id of PROVIDER_ORDER) {
			const m = defaultModel(id);
			expect(m).not.toBe('claude-haiku-4-5');
			expect(m).not.toBe('claude-sonnet-5');
			expect(m).not.toMatch(/claude-sonnet-5$/);
		}
	});

	it('orders and labels providers', () => {
		expect(PROVIDER_ORDER).toEqual(['anthropic', 'openai', 'gemini', 'openrouter']);
		expect(PROVIDER_LABELS.gemini).toBe('Google Gemini');
		expect(PROVIDER_LABELS.anthropic).toBe('Anthropic');
		expect(PROVIDER_LABELS.openai).toBe('OpenAI');
		expect(PROVIDER_LABELS.openrouter).toBe('OpenRouter');
		expect(PROVIDER_LABELS.fixture).toBe('Sample output');
	});

	it('exposes hosts', () => {
		expect(hostFor('anthropic')).toBe('api.anthropic.com');
		expect(hostFor('gemini')).toBe('generativelanguage.googleapis.com');
	});
});

describe('extrasFor (exact model ID only)', () => {
	it('anthropic', () => {
		expect(extrasFor('anthropic', 'claude-sonnet-5-5')).toEqual({
			output_config: { effort: 'low' },
			thinking: { type: 'between_tools' }
		});
		expect(extrasFor('anthropic', 'claude-sonnet-5')).toBeUndefined();
		expect(extrasFor('anthropic', 'claude-opus-5-5')).toBeUndefined();
	});

	it('openai', () => {
		expect(extrasFor('openai', 'gpt-6.1-sol')).toEqual({ reasoning: { effort: 'low' } });
		expect(extrasFor('openai', 'gpt-5.6-terra')).toBeUndefined();
	});

	it('gemini, openrouter and unknown models', () => {
		expect(extrasFor('gemini', 'gemini-3.8-flash')).toEqual({
			thinkingConfig: { thinkingLevel: 'low' }
		});
		expect(extrasFor('openrouter', 'anthropic/claude-sonnet-5.5')).toBeUndefined();
		expect(extrasFor('anthropic', 'my-custom-model')).toBeUndefined();
		expect(extrasFor('openai', 'constructor')).toBeUndefined();
	});

	it('returns deep copies', () => {
		const a = extrasFor('anthropic', 'claude-sonnet-5-5') as {
			thinking: { type: string };
		};
		a.thinking.type = 'mutated';
		expect(extrasFor('anthropic', 'claude-sonnet-5-5')).toEqual({
			output_config: { effort: 'low' },
			thinking: { type: 'between_tools' }
		});
	});
});

describe('pricingFor', () => {
	it('every default has a pricing row valid on 2026-10-04 and today', () => {
		for (const id of PROVIDER_ORDER) {
			const rows = pricingFor(id, defaultModel(id));
			expect(pricingAt(rows, new Date('2026-10-04T12:00:00Z')), id).toBeDefined();
			expect(pricingAt(rows, new Date()), id).toBeDefined();
		}
	});

	it('gemini doubles on 2027-01-01', () => {
		const rows = pricingFor('gemini', 'gemini-3.8-flash');
		expect(rows).toContainEqual({ from: '2027-01-01', inUsdPerMTok: 1.5, outUsdPerMTok: 7.5 });
	});

	it('fixture and unknown models have no pricing', () => {
		expect(pricingFor('fixture', 'anything')).toBeUndefined();
		expect(pricingFor('openai', 'my-custom-model')).toBeUndefined();
		expect(pricingFor('openai', 'toString')).toBeUndefined();
	});
});

describe('CSP coverage', () => {
	it('every registry host is listed in svelte.config.js connect-src', () => {
		const cfg = readFileSync(resolve(import.meta.dirname, '../../../svelte.config.js'), 'utf8');
		for (const id of PROVIDER_ORDER) {
			expect(cfg, id).toContain(`'https://${PROVIDERS[id].host}'`);
		}
	});
});

describe('validateModelId', () => {
	it.each([
		['', 'empty'],
		['   ', 'empty'],
		['claude sonnet', 'spaces'],
		['claude-sonnet-5-5', null],
		['anthropic/claude-sonnet-5.5', null],
		['  gpt-6.1-sol  ', null]
	] as const)('%j -> %s', (value, expected) => {
		expect(validateModelId(value)).toBe(expected);
	});
});
