// RED placeholder; implemented in the GREEN commit.
export const MAX_WATCHED_ZIPS = 0;

export function validateZip(
	_input: string
): { ok: true; zip: string } | { ok: false; error: 'invalid' } {
	throw new Error('not implemented');
}
export function addWatchedZip(
	_list: readonly string[],
	_input: string
):
	| { ok: true; list: string[]; zip: string }
	| { ok: false; error: 'invalid' | 'duplicate' | 'limit'; zip?: string } {
	throw new Error('not implemented');
}
export function removeWatchedZip(_list: readonly string[], _zip: string): string[] {
	throw new Error('not implemented');
}
