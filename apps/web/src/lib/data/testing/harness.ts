// Test-only. Inject a clock; never use Vitest fake timers with fake-indexeddb (RESEARCH Pitfall 1).
// Fake keys stay low-entropy (Pitfall 13). Not imported by app code: it lives under src/lib only so
// `$lib` resolves in tests. Every makeDb() call is fully isolated.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createDataDb, type DataDb } from '../platform';

/** Fixed test instant. Pass `() => T0` (or offsets) as the clock. */
export const T0 = Date.parse('2026-10-15T12:00:00.000Z');

/** Obviously fake, low-entropy RentCast key: never matches a real-key shape. */
export const TEST_KEY = 'test-key-not-real';

/** A DataDb on a brand-new in-memory IndexedDB with a unique name. */
export function makeDb(): DataDb {
	return createDataDb({
		name: `t-${crypto.randomUUID()}`,
		indexedDB: new IDBFactory(),
		IDBKeyRange
	});
}

export function jsonResponse(status: number, body: unknown): Response {
	return new Response(body === undefined ? '' : JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

export type FetchCall = { url: string; headers: Record<string, string> };

/** A fetch stand-in that records every call (url + lower-cased headers) and delegates to `handler`. */
export function spyFetch(handler: (url: URL) => Response | Promise<Response>) {
	const calls: FetchCall[] = [];
	const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new URL(
			typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		);
		calls.push({
			url: url.href,
			headers: Object.fromEntries(new Headers(init?.headers).entries())
		});
		return handler(url);
	}) as typeof fetch;
	return { fetch: fn, calls };
}
