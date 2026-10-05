// The only RentCast fetch call site. GET only, two CORS-safelisted-or-allowed headers, no
// credentials, no referrer, and suppressLogging on every call. The key travels in a header,
// never in the URL, and nothing here logs. Response headers are never read: cross-origin,
// RentCast does not expose them.
import { GatewayError, requestTarget, type DataRequest } from '@tran/core/request';

export const RENTCAST_ORIGIN = 'https://api.rentcast.io';

const DEFAULT_TIMEOUT_MS = 20_000;

/** Status 0 means the request never produced a response (offline, CORS, abort, timeout). */
export interface RawResult {
	status: number;
	body: unknown;
}

export interface RentCastClient {
	get(req: DataRequest): Promise<RawResult>;
}

export interface RentCastClientDeps {
	fetch: typeof fetch;
	getKey: () => string | null;
	origin?: string;
	timeoutMs?: number;
}

export function createRentCastClient(deps: RentCastClientDeps): RentCastClient {
	return {
		async get(req) {
			const key = deps.getKey();
			if (!key) throw new GatewayError({ kind: 'InvalidKey', detail: 'missing-key' });

			// Same canonical params as the cache key, so the key and the wire request cannot drift.
			const target = requestTarget(req);
			const url = new URL(target.path, deps.origin ?? RENTCAST_ORIGIN);
			for (const [k, v] of target.query) url.searchParams.append(k, v);
			url.searchParams.set('suppressLogging', 'true');

			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
			try {
				const res = await deps.fetch(url, {
					method: 'GET',
					headers: { 'X-Api-Key': key, Accept: 'application/json' },
					credentials: 'omit',
					referrerPolicy: 'no-referrer',
					cache: 'no-store',
					signal: controller.signal
				});
				const body: unknown = await res.json().catch(() => undefined);
				return { status: res.status, body };
			} catch {
				return { status: 0, body: undefined };
			} finally {
				clearTimeout(timer);
			}
		}
	};
}

/**
 * The single bridge to the real fetch. Other modules receive it by injection; the ESLint fetch
 * ban blocks direct calls elsewhere.
 */
export const browserFetch: typeof fetch = (input, init) => fetch(input, init);
