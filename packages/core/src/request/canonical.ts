import type { EndpointId } from './endpoints.js';

export type ParamValue =
	string | number | boolean | readonly (string | number)[] | undefined | null;
export type RequestParams = Readonly<Record<string, ParamValue>>;

export interface DataRequest {
	readonly endpoint: EndpointId;
	readonly params: RequestParams;
}

/** Sent on the wire (suppressLogging is always sent) but never part of the request identity. */
export const TRANSPORT_ONLY: ReadonlySet<string> = new Set([
	'suppressLogging',
	'includeTotalCount'
]);

const API_KEY_NAME = /api.?key/i;

function scalar(name: string, value: string | number | boolean): string {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new TypeError(`Param ${name} must be a finite number`);
		return String(value);
	}
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	const trimmed = value.trim();
	if (name === 'state') return trimmed.toUpperCase();
	if (name === 'zipCode') return trimmed.slice(0, 5);
	return trimmed;
}

/**
 * The normalized, sorted [name, value] pairs that identify a request. Used for both the
 * canonical cache key and the wire query string.
 * Drops undefined/null/blank values and transport-only params; sorts and pipe-joins multi-values;
 * uppercases state; trims ZIP+4 to 5 digits. Throws if a param name could carry an API key.
 */
export function canonicalParams(params: RequestParams): [string, string][] {
	const out: [string, string][] = [];
	for (const [name, value] of Object.entries(params)) {
		if (API_KEY_NAME.test(name)) throw new TypeError('API keys never belong in request params');
		if (TRANSPORT_ONLY.has(name) || value === undefined || value === null) continue;
		const normalized = Array.isArray(value)
			? (value as readonly (string | number)[])
					.map((v) => scalar(name, v))
					.filter((v) => v !== '')
					.sort()
					.join('|')
			: scalar(name, value as string | number | boolean);
		if (normalized !== '') out.push([name, normalized]);
	}
	return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** `endpoint?name=value&…` with each value percent-encoded. The cache, dedupe and ledger key. */
export function canonicalKey(req: DataRequest): string {
	const query = canonicalParams(req.params)
		.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
		.join('&');
	return `${req.endpoint}?${query}`;
}
