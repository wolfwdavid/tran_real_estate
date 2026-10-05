import type { EndpointId } from './endpoints.js';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/**
 * Positive-cache lifetime per endpoint.
 * Estimates 7d per locked CONTEXT; CLAUDE.md's 14d is overridden (RESEARCH Open Q1).
 */
export const TTL_MS: Record<EndpointId, number> = {
	'rental-listings': DAY_MS,
	'sale-listings': DAY_MS,
	'rental-listing-by-id': DAY_MS,
	'rent-estimate': 7 * DAY_MS,
	'value-estimate': 7 * DAY_MS,
	markets: 30 * DAY_MS
};

/** 404 (no results) and 400 (bad request) answers are cached for 24h on every endpoint. */
export const NEGATIVE_TTL_MS = DAY_MS;

export function ttlFor(endpoint: EndpointId, status: number): number {
	return status === 404 || status === 400 ? NEGATIVE_TTL_MS : TTL_MS[endpoint];
}

export function isStale(
	fetchedAt: number,
	endpoint: EndpointId,
	status: number,
	now: number
): boolean {
	return now - fetchedAt >= ttlFor(endpoint, status);
}
