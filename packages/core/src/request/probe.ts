import type { DataRequest } from './canonical.js';

export type KeyTestOutcome =
	'valid' | 'valid-billed' | 'invalid' | 'restricted' | 'rate-limited' | 'unverified';

/**
 * The zero-cost key test.
 * ZIP 00000 was never assigned; auth is checked before validation (live-verified 2026-10-04).
 * Swap here if real-key UAT U3 returns 200.
 */
export const PROBE_REQUEST: DataRequest = {
	endpoint: 'markets',
	params: { zipCode: '00000', dataType: 'Rental', historyRange: 1 }
};

/** Pure mapping of the probe's HTTP status. 0 = fetch threw. */
export function classifyProbe(status: number): KeyTestOutcome {
	switch (status) {
		case 400:
		case 404:
			return 'valid';
		case 200:
			return 'valid-billed';
		case 401:
			return 'invalid';
		case 403:
			return 'restricted';
		case 429:
			return 'rate-limited';
		default:
			return 'unverified';
	}
}

const PRINTABLE_ASCII = /^[\x21-\x7E]+$/;
const WHITESPACE = /\s/;

/**
 * Format check before any request: trimmed, non-empty, no inner whitespace, printable ASCII,
 * length 16..128. The real RentCast key format is unverified, so no hex/32 assumption.
 */
export function validateKeyFormat(
	key: string
): { ok: true; key: string } | { ok: false; error: 'empty' | 'whitespace' | 'charset' | 'length' } {
	const trimmed = key.trim();
	if (trimmed === '') return { ok: false, error: 'empty' };
	if (WHITESPACE.test(trimmed)) return { ok: false, error: 'whitespace' };
	if (!PRINTABLE_ASCII.test(trimmed)) return { ok: false, error: 'charset' };
	if (trimmed.length < 16 || trimmed.length > 128) return { ok: false, error: 'length' };
	return { ok: true, key: trimmed };
}
