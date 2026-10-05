// The shared no-network harness for renter E2E specs (06-09). A plain module, not a spec.
//
// Import `test` and `expect` from here instead of '@playwright/test'. The extended `test` carries
// an automatic `net` fixture that, before the test body runs:
//   1) routes every non-local http(s) request to an abort and records its URL (deny-all), then
//   2) answers https://tile.openstreetmap.org/** with the committed synthetic tile, counting each
//      request and recording its Referer.
// After the test it asserts that nothing was denied. RentCast is answered by mockRentCast
// (rentcast-mocks.ts), which a test registers itself, so it lands after the deny-all.
//
// RESEARCH Pitfall 10 (06-RESEARCH.md): Playwright gives precedence to the most recently
// registered matching route, so the deny-all MUST be registered first or it swallows every mock.
// page.route also misses requests a Service Worker makes, so every renter spec starts with
// `test.use(RENTER_TEST_OPTIONS)`, which blocks service workers.
import { test as base, expect, type Request } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export { expect };

/** The committed 256x256 synthetic PNG (scripts/gen-test-tile.mjs). Never OSM imagery. */
export const TILE = fileURLToPath(new URL('../assets/tile.png', import.meta.url));

export const TILE_ROUTE = 'https://tile.openstreetmap.org/**';

/** Every http(s) URL whose origin is not the local test server (127.0.0.1 or localhost). */
export const NON_LOCAL = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost)(?:[:/]|$))/;

export interface NetRequest {
	url: string;
	method: string;
}

export interface Net {
	/**
	 * Requests served by a mock, keyed by `host + pathname`
	 * (e.g. 'api.rentcast.io/v1/listings/rental/long-term'), plus `tiles` for map tiles.
	 */
	counts: Record<string, number>;
	/** Every RentCast request a mock answered (CORS preflights excluded), in order. */
	requests: NetRequest[];
	/** URLs the deny-all aborted. Must be empty at teardown. */
	external: string[];
	/** The Referer header of each tile request, in order ('' when none was sent). */
	tileReferers: string[];
}

/** Counts a request a mock answered under `host + pathname` and records it in `net.requests`. */
export function recordRequest(net: Net, request: Request): void {
	const url = new URL(request.url());
	const key = url.host + url.pathname;
	net.counts[key] = (net.counts[key] ?? 0) + 1;
	net.requests.push({ url: request.url(), method: request.method() });
}

/**
 * RentCast requests a mock answered. With `path` (e.g. '/v1/listings/rental/long-term'), only
 * requests to exactly that path; the query string is ignored.
 */
export function rentcastCalls(net: Net, path?: string): number {
	return net.requests.filter((r) => {
		const url = new URL(r.url);
		return url.host === 'api.rentcast.io' && (path === undefined || url.pathname === path);
	}).length;
}

/** Every renter spec: `test.use(RENTER_TEST_OPTIONS)` (page.route misses service-worker requests). */
export const RENTER_TEST_OPTIONS = { serviceWorkers: 'block' } as const;

export const test = base.extend<{ net: Net }>({
	net: [
		async ({ page }, use) => {
			const net: Net = { counts: {}, requests: [], external: [], tileReferers: [] };

			// 1) deny-all FIRST: Playwright gives precedence to later-registered routes, so every
			//    mock registered after this line (tiles below, RentCast in the test) wins over it.
			await page.route(NON_LOCAL, (r) => {
				net.external.push(r.request().url());
				return r.abort();
			});

			// 2) Map tiles: the synthetic PNG, counted, with the Referer recorded (OSM tile policy).
			await page.route(TILE_ROUTE, (r) => {
				net.counts.tiles = (net.counts.tiles ?? 0) + 1;
				net.tileReferers.push(r.request().headers()['referer'] ?? '');
				return r.fulfill({
					path: TILE,
					contentType: 'image/png',
					headers: { 'access-control-allow-origin': '*' }
				});
			});

			await use(net);

			// A test that probes the deny-all on purpose empties net.external after asserting it.
			expect(net.external, 'unexpected external requests').toEqual([]);
		},
		{ auto: true }
	]
});
