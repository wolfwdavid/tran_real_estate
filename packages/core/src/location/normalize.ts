// Local location normalization (04-RESEARCH Pattern 8). RentCast's `city` parameter is
// case-sensitive, so free-text input is resolved to `{ city, state }` or a 5-digit ZIP without
// spending an API call. Mixed-case input ("DeKalb", "LaGrange") is kept exactly as typed because
// title-casing would break it; all-lower or all-upper input is title-cased.
import { stateFromInput } from './states.js';

export type NormalizedLocation =
	| { kind: 'zip'; zipCode: string; label: string }
	| { kind: 'city'; city: string; state: string; label: string };

export type LocationError = 'empty' | 'invalid-zip' | 'missing-state' | 'unknown-state';

export type LocationResult = ({ ok: true } & NormalizedLocation) | { ok: false; error: LocationError };

const ZIP_RE = /^\d{5}(-\d{4})?$/;

function capitalize(segment: string): string {
	if (/^mc[a-z]/i.test(segment)) {
		return 'Mc' + segment.charAt(2).toUpperCase() + segment.slice(3).toLowerCase();
	}
	return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

/** Title-case per space-separated word and per hyphen segment, keeping punctuation. */
export function titleCaseCity(city: string): string {
	return city
		.split(' ')
		.map((word) => word.split('-').map(capitalize).join('-'))
		.join(' ');
}

function canonicalCity(head: string): string {
	const mixed = /[A-Z]/.test(head) && /[a-z]/.test(head);
	return mixed ? head : titleCaseCity(head);
}

function cityResult(head: string, state: string): LocationResult {
	const city = canonicalCity(head);
	return { ok: true, kind: 'city', city, state, label: `${city}, ${state}` };
}

export function normalizeLocation(input: string): LocationResult {
	const text = input.trim().replace(/\s+/g, ' ');
	if (text === '') return { ok: false, error: 'empty' };

	if (ZIP_RE.test(text)) {
		const zipCode = text.slice(0, 5);
		if (zipCode === '00000') return { ok: false, error: 'invalid-zip' };
		return { ok: true, kind: 'zip', zipCode, label: zipCode };
	}

	const comma = text.lastIndexOf(',');
	if (comma !== -1) {
		const head = text.slice(0, comma).trim();
		const tail = text.slice(comma + 1).trim();
		if (head === '') return { ok: false, error: 'missing-state' };
		const state = stateFromInput(tail);
		return state ? cityResult(head, state) : { ok: false, error: 'unknown-state' };
	}

	const tokens = text.split(' ');
	// Longest state name first ("district of columbia", "new york") so "kansas city missouri"
	// resolves to Kansas City, MO rather than "kansas city" + an unknown tail.
	for (const n of [3, 2, 1]) {
		if (tokens.length <= n) continue; // the head must be non-empty
		const state = stateFromInput(tokens.slice(-n).join(' '));
		if (state) return cityResult(tokens.slice(0, -n).join(' '), state);
	}
	return { ok: false, error: 'missing-state' };
}

export const parseLocation = normalizeLocation;
