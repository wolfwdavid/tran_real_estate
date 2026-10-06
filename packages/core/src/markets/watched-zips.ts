/**
 * Watched-ZIP rules for the markets page (INV-05): up to 5 ZIPs, no duplicates, valid 5-digit
 * ZIPs only. Pure and non-mutating; the store in features/shared/markets persists the result.
 */

/** UI-SPEC: "You're watching 5 ZIP codes, the most Tran tracks." */
export const MAX_WATCHED_ZIPS = 5;

const ZIP_RE = /^\d{5}$/;

/** A trimmed 5-digit ZIP. 00000 was never assigned, so it is rejected (as in location/normalize). */
export function validateZip(
	input: string
): { ok: true; zip: string } | { ok: false; error: 'invalid' } {
	const zip = input.trim();
	if (!ZIP_RE.test(zip) || zip === '00000') return { ok: false, error: 'invalid' };
	return { ok: true, zip };
}

/** Appends a ZIP. Checked in order: invalid, duplicate, then the 5-ZIP limit. */
export function addWatchedZip(
	list: readonly string[],
	input: string
):
	| { ok: true; list: string[]; zip: string }
	| { ok: false; error: 'invalid' | 'duplicate' | 'limit'; zip?: string } {
	const v = validateZip(input);
	if (!v.ok) return { ok: false, error: 'invalid' };
	if (list.includes(v.zip)) return { ok: false, error: 'duplicate', zip: v.zip };
	if (list.length >= MAX_WATCHED_ZIPS) return { ok: false, error: 'limit', zip: v.zip };
	return { ok: true, list: [...list, v.zip], zip: v.zip };
}

export function removeWatchedZip(list: readonly string[], zip: string): string[] {
	return list.filter((z) => z !== zip);
}
