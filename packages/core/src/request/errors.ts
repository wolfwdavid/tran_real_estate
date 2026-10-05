/** Where a value came from and whether it is past its TTL. */
export interface Provenance {
	source: 'rentcast' | 'sample';
	fetchedAt: number;
	stale: boolean;
}

/** The locked error taxonomy. Every RentCast status maps to exactly one kind. */
export type GatewayErrorKind =
	| 'InvalidKey'
	| 'RestrictedKey'
	| 'RateLimited'
	| 'BudgetCapReached'
	| 'NoResults'
	| 'NetworkError'
	| 'SchemaMismatch';

export type GatewayErrorDetail =
	| 'billing'
	| 'restriction'
	| 'bad-request'
	| 'outside-sample-coverage'
	| 'server'
	| 'missing-key'
	| 'dismissed';

export interface GatewayErrorInfo {
	kind: GatewayErrorKind;
	detail?: GatewayErrorDetail;
	used?: number;
	cap?: number;
	resetsAt?: number;
	retryInMs?: number;
	provenance?: Provenance;
	/** Zod issue paths only, never values. */
	issues?: readonly string[];
	requestKey?: string;
}

/**
 * The only error the data layer throws. It copies the listed fields and nothing else,
 * so a response body or an API key can never ride along into logs or serialized state.
 */
export class GatewayError extends Error {
	readonly kind: GatewayErrorKind;
	readonly detail: GatewayErrorDetail | undefined;
	readonly used: number | undefined;
	readonly cap: number | undefined;
	readonly resetsAt: number | undefined;
	readonly retryInMs: number | undefined;
	readonly provenance: Provenance | undefined;
	readonly issues: readonly string[] | undefined;
	readonly requestKey: string | undefined;

	constructor(info: GatewayErrorInfo) {
		super(info.kind);
		this.name = 'GatewayError';
		this.kind = info.kind;
		this.detail = info.detail;
		this.used = info.used;
		this.cap = info.cap;
		this.resetsAt = info.resetsAt;
		this.retryInMs = info.retryInMs;
		this.provenance = info.provenance;
		this.issues = info.issues;
		this.requestKey = info.requestKey;
	}
}

export const isGatewayError = (e: unknown): e is GatewayError => e instanceof GatewayError;

/**
 * Pure status mapping. `null` means success (200). Status 0 = fetch threw (offline, CORS, abort).
 * 403 detail comes from the body's `error` prefix; the fixture fetch answers out-of-sample
 * locations with 404 `sample/outside-coverage`.
 */
export function classifyResponse(
	status: number,
	body: unknown
): { kind: GatewayErrorKind; detail?: GatewayErrorDetail } | null {
	const code =
		typeof body === 'object' && body !== null && 'error' in body
			? String((body as { error: unknown }).error)
			: '';
	if (status === 200) return null;
	if (status === 400) return { kind: 'NoResults', detail: 'bad-request' };
	if (status === 401) return { kind: 'InvalidKey' };
	if (status === 403)
		return {
			kind: 'RestrictedKey',
			detail: code.startsWith('billing/') ? 'billing' : 'restriction'
		};
	if (status === 404)
		return code === 'sample/outside-coverage'
			? { kind: 'NoResults', detail: 'outside-sample-coverage' }
			: { kind: 'NoResults' };
	if (status === 429) return { kind: 'RateLimited' };
	if (status >= 500 || status === 405) return { kind: 'NetworkError', detail: 'server' };
	return { kind: 'NetworkError' };
}

/** Fixed exponential backoff: 2s, 4s, 8s, 16s, capped at 30s (rate-limit headers are not readable cross-origin). */
export const backoffMs = (attempt: number): number => Math.min(2000 * 2 ** attempt, 30_000);
