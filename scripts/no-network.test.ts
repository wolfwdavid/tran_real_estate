import { expect, test } from 'vitest';

test('fetch is disabled in unit tests', () => {
	// eslint-disable-next-line no-restricted-syntax -- this test exists to prove the fetch ban holds
	expect(() => fetch('https://example.com')).toThrow(/Network access is disabled/);
});

test('a test that replaces fetch does not leak into the next test', () => {
	globalThis.fetch = (async () => new Response('')) as unknown as typeof fetch;
	expect(typeof globalThis.fetch).toBe('function');
});

test('fetch is re-asserted after being replaced', () => {
	// eslint-disable-next-line no-restricted-syntax -- this test exists to prove the fetch ban holds
	expect(() => fetch('https://example.com')).toThrow(/Network access is disabled/);
});
