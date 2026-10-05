import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GatewayError } from '@tran/core/request';
import { jsonResponse, spyFetch, TEST_KEY } from '../testing/harness';
import { createRentCastClient, RENTCAST_ORIGIN } from './client';

const LISTINGS_URL =
	'https://api.rentcast.io/v1/listings/rental/long-term?city=Austin&limit=500&offset=0&state=TX&status=Active&suppressLogging=true';

/** Wraps the harness spy so the RequestInit options are recorded too. */
function recordingFetch(handler: (url: URL) => Response | Promise<Response>) {
	const spy = spyFetch(handler);
	const inits: (RequestInit | undefined)[] = [];
	const fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		inits.push(init);
		return spy.fetch(input, init);
	}) as typeof globalThis.fetch;
	return { fetch, calls: spy.calls, inits };
}

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;
let consoleSpies: MockInstance[] = [];

beforeEach(() => {
	consoleSpies = consoleMethods.map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => {
	for (const s of consoleSpies) {
		expect(s).not.toHaveBeenCalled();
		s.mockRestore();
	}
});

describe('createRentCastClient', () => {
	it('exposes the RentCast origin', () => {
		expect(RENTCAST_ORIGIN).toBe('https://api.rentcast.io');
	});

	it('builds the wire URL from the canonical params plus suppressLogging', async () => {
		const f = recordingFetch(() => jsonResponse(200, []));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await client.get({
			endpoint: 'rental-listings',
			params: { city: 'Austin', state: 'TX', status: 'Active', limit: 500, offset: 0 }
		});
		expect(f.calls).toHaveLength(1);
		expect(f.calls[0]!.url).toBe(LISTINGS_URL);
	});

	it('encodes a city with a space so it round-trips', async () => {
		const f = recordingFetch(() => jsonResponse(200, []));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await client.get({
			endpoint: 'rental-listings',
			params: { city: 'Harlow Springs', state: 'tx' }
		});
		const url = new URL(f.calls[0]!.url);
		expect(url.searchParams.get('city')).toBe('Harlow Springs');
		expect(url.searchParams.get('state')).toBe('TX');
	});

	it('puts a by-id request id in the path, not the query', async () => {
		const f = recordingFetch(() => jsonResponse(200, {}));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await client.get({ endpoint: 'rental-listing-by-id', params: { id: 'SAMPLE-74201-R001' } });
		const url = new URL(f.calls[0]!.url);
		expect(url.pathname).toBe('/v1/listings/rental/long-term/SAMPLE-74201-R001');
		expect([...url.searchParams.entries()]).toEqual([['suppressLogging', 'true']]);
	});

	it('sends only X-Api-Key and Accept, GET, no credentials, no referrer, no cache', async () => {
		const f = recordingFetch(() => jsonResponse(200, []));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await client.get({ endpoint: 'markets', params: { zipCode: '74201' } });
		expect(f.calls[0]!.headers).toEqual({ 'x-api-key': TEST_KEY, accept: 'application/json' });
		const init = f.inits[0]!;
		expect(init.method).toBe('GET');
		expect(init.credentials).toBe('omit');
		expect(init.referrerPolicy).toBe('no-referrer');
		expect(init.cache).toBe('no-store');
		expect(init.body).toBeUndefined();
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('never puts the key in the URL', async () => {
		const f = recordingFetch(() => jsonResponse(200, []));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await client.get({ endpoint: 'markets', params: { zipCode: '74201' } });
		expect(f.calls[0]!.url).not.toContain(TEST_KEY);
	});

	it('honors an origin override', async () => {
		const f = recordingFetch(() => jsonResponse(200, []));
		const client = createRentCastClient({
			fetch: f.fetch,
			getKey: () => TEST_KEY,
			origin: 'https://fixtures.invalid'
		});
		await client.get({ endpoint: 'markets', params: { zipCode: '74201' } });
		expect(f.calls[0]!.url).toBe(
			'https://fixtures.invalid/v1/markets?zipCode=74201&suppressLogging=true'
		);
	});

	it('returns the status and parsed JSON body for an error status', async () => {
		const f = recordingFetch(() => jsonResponse(404, { error: 'not-found' }));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await expect(
			client.get({ endpoint: 'markets', params: { zipCode: '74201' } })
		).resolves.toEqual({ status: 404, body: { error: 'not-found' } });
	});

	it('returns body undefined when the response is not JSON', async () => {
		const f = recordingFetch(() => new Response('<html>oops</html>', { status: 200 }));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => TEST_KEY });
		await expect(
			client.get({ endpoint: 'markets', params: { zipCode: '74201' } })
		).resolves.toEqual({ status: 200, body: undefined });
	});

	it('maps a rejected fetch to status 0', async () => {
		const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
		const client = createRentCastClient({ fetch: failing, getKey: () => TEST_KEY });
		await expect(
			client.get({ endpoint: 'markets', params: { zipCode: '74201' } })
		).resolves.toEqual({ status: 0, body: undefined });
	});

	it('aborts after timeoutMs and maps the abort to status 0', async () => {
		let sawAbort = false;
		const hanging = ((_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					sawAbort = true;
					reject(new DOMException('aborted', 'AbortError'));
				});
			})) as typeof fetch;
		const client = createRentCastClient({ fetch: hanging, getKey: () => TEST_KEY, timeoutMs: 10 });
		await expect(
			client.get({ endpoint: 'markets', params: { zipCode: '74201' } })
		).resolves.toEqual({ status: 0, body: undefined });
		expect(sawAbort).toBe(true);
	});

	it('rejects with InvalidKey/missing-key and makes no request when there is no key', async () => {
		const f = recordingFetch(() => jsonResponse(200, []));
		const client = createRentCastClient({ fetch: f.fetch, getKey: () => null });
		const err = await client
			.get({ endpoint: 'markets', params: { zipCode: '74201' } })
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(GatewayError);
		expect((err as GatewayError).kind).toBe('InvalidKey');
		expect((err as GatewayError).detail).toBe('missing-key');
		expect(f.calls).toHaveLength(0);
	});
});
