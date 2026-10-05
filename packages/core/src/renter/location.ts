// Renter location input → RentCast's case-sensitive location. Delegates to Phase 4's
// `normalizeLocation` (state table, casing rules) and only maps its result into the renter shape
// and the four renter error kinds. A location is required: every error means "send no request".
import { normalizeLocation } from '../location/normalize.js';
import type { LocationError, RenterLocation } from './types.js';

export type RenterLocationResult =
	{ ok: true; location: RenterLocation } | { ok: false; error: LocationError };

/** Digits (optionally with a dash) that are not a valid ZIP: the user meant a ZIP and mistyped it. */
const ZIPLIKE = /^[\d-]+$/;
/** A trailing two-letter token that looks like an attempted (but unknown) state abbreviation. */
const TWO_LETTER_TAIL = /\s[a-z]{2}$/i;

export function normalizeRenterLocation(input: string): RenterLocationResult {
	const text = input.trim().replace(/\s+/g, ' ');
	const r = normalizeLocation(text);
	if (r.ok) {
		return r.kind === 'zip'
			? { ok: true, location: { kind: 'zip', zipCode: r.zipCode } }
			: { ok: true, location: { kind: 'city', city: r.city, state: r.state } };
	}
	switch (r.error) {
		case 'empty':
			return { ok: false, error: 'empty' };
		case 'invalid-zip':
			return { ok: false, error: 'bad-zip' };
		case 'unknown-state':
			return { ok: false, error: 'unrecognized' };
		case 'missing-state':
			if (ZIPLIKE.test(text)) return { ok: false, error: 'bad-zip' };
			if (TWO_LETTER_TAIL.test(text)) return { ok: false, error: 'unrecognized' };
			return { ok: false, error: 'city-without-state' };
	}
}

export function locationDisplay(l: RenterLocation): string {
	return l.kind === 'zip' ? l.zipCode : `${l.city}, ${l.state}`;
}
