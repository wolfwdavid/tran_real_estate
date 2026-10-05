import { describe, expect, test } from 'vitest';

import { PROVIDERS, PROVIDER_IDS, providerById, type ProviderId } from './providers.js';

describe('PROVIDER_IDS', () => {
	test('lists the five providers in display order, RentCast first', () => {
		expect(PROVIDER_IDS).toEqual(['rentcast', 'anthropic', 'openai', 'gemini', 'openrouter']);
	});

	test('is frozen', () => {
		expect(Object.isFrozen(PROVIDER_IDS)).toBe(true);
		expect(() => (PROVIDER_IDS as unknown as string[]).push('nope')).toThrow(TypeError);
	});
});

describe('PROVIDERS', () => {
	test('follows PROVIDER_IDS order exactly', () => {
		expect(PROVIDERS.map((p) => p.id)).toEqual([...PROVIDER_IDS]);
	});

	test('the array and every entry are frozen', () => {
		expect(Object.isFrozen(PROVIDERS)).toBe(true);
		expect(() => (PROVIDERS as unknown as unknown[]).push({})).toThrow(TypeError);
		for (const p of PROVIDERS) {
			expect(Object.isFrozen(p), p.id).toBe(true);
			expect(Object.isFrozen(p.auth), p.id).toBe(true);
		}
	});

	test('every provider authenticates with a header, never a URL query parameter', () => {
		for (const p of PROVIDERS) {
			expect(p.auth.kind, p.id).toBe('header');
			expect(p.auth.header.length, p.id).toBeGreaterThan(0);
			expect(JSON.stringify(p), p.id).not.toMatch(/[?&]key=/);
		}
	});

	test('Gemini uses the x-goog-api-key header', () => {
		expect(providerById('gemini')?.auth.header).toBe('x-goog-api-key');
	});

	test('every key URL is https with no query string', () => {
		for (const p of PROVIDERS) {
			expect(p.keyUrl.startsWith('https://'), p.id).toBe(true);
			expect(new URL(p.keyUrl).search, p.id).toBe('');
			expect(p.keyUrl, p.id).not.toContain('?');
		}
	});

	test('hosts are bare hostnames', () => {
		for (const p of PROVIDERS) {
			expect(p.host, p.id).toMatch(/^[a-z0-9.-]+$/);
		}
	});

	test('only RentCast and Gemini carry a provider note', () => {
		expect(PROVIDERS.filter((p) => p.note).map((p) => p.id)).toEqual(['rentcast', 'gemini']);
	});
});

describe('providerById', () => {
	test('finds a provider by id', () => {
		expect(providerById('gemini')?.host).toBe('generativelanguage.googleapis.com');
		expect(providerById('rentcast')?.label).toBe('RentCast');
	});

	test('returns undefined for an unknown id', () => {
		expect(providerById('nope' as ProviderId)).toBeUndefined();
	});
});
