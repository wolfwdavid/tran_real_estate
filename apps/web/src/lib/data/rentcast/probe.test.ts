import { describe, expect, it } from 'vitest';
import { jsonResponse, spyFetch } from '../testing/harness';
import { testRentCastKey } from './probe';

const PROBE_URL =
	'https://api.rentcast.io/v1/markets?dataType=Rental&historyRange=1&zipCode=00000&suppressLogging=true';
const KEY = 'k'.repeat(32);

describe('testRentCastKey', () => {
	it('sends exactly one zero-cost probe request', async () => {
		const f = spyFetch(() => jsonResponse(404, { error: 'not-found' }));
		await testRentCastKey(KEY, { fetch: f.fetch });
		expect(f.calls).toHaveLength(1);
		expect(f.calls[0]!.url).toBe(PROBE_URL);
		expect(f.calls[0]!.url).not.toContain(KEY);
	});

	it.each([
		[400, 'valid'],
		[404, 'valid'],
		[200, 'valid-billed'],
		[401, 'invalid'],
		[403, 'restricted'],
		[429, 'rate-limited'],
		[500, 'unverified'],
		[504, 'unverified']
	] as const)('maps status %i to %s', async (status, outcome) => {
		const f = spyFetch(() => jsonResponse(status, { error: 'x' }));
		await expect(testRentCastKey(KEY, { fetch: f.fetch })).resolves.toEqual({ outcome, status });
	});

	it('maps a rejecting fetch to unverified with status 0', async () => {
		const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
		await expect(testRentCastKey(KEY, { fetch: failing })).resolves.toEqual({
			outcome: 'unverified',
			status: 0
		});
	});

	it.each([
		['', 'empty'],
		['abc def', 'whitespace'],
		['k'.repeat(15), 'length']
	] as const)('rejects %j as bad-format (%s) without a request', async (raw, formatError) => {
		const f = spyFetch(() => jsonResponse(404, {}));
		await expect(testRentCastKey(raw, { fetch: f.fetch })).resolves.toEqual({
			outcome: 'bad-format',
			formatError,
			status: null
		});
		expect(f.calls).toHaveLength(0);
	});

	it('trims the key before sending it', async () => {
		const f = spyFetch(() => jsonResponse(404, {}));
		await testRentCastKey('  ' + KEY + '\n', { fetch: f.fetch });
		expect(f.calls[0]!.headers['x-api-key']).toBe(KEY);
	});

	it('honors an origin override', async () => {
		const f = spyFetch(() => jsonResponse(404, {}));
		await testRentCastKey(KEY, { fetch: f.fetch, origin: 'https://fixtures.invalid' });
		expect(new URL(f.calls[0]!.url).origin).toBe('https://fixtures.invalid');
	});
});
