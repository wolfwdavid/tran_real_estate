// Local inverse of redactPii: re-inserts real values into a draft on the user's device, so the
// provider only ever sees `{token}` placeholders. Pure: no I/O, no logging.

import type { Redaction } from './redact-pii.js';

/** Same token grammar redactPii emits; prose braces like `{not a token}` never match. */
const TOKEN = /\{([a-z][a-z0-9_]*)\}/g;

/**
 * Replaces each `{token}` whose name is an own key of `tokens` with its value, inserted
 * literally (a replacer function, so `$&` / `$1` in values are not expanded).
 */
export function restorePii(text: string, tokens: Readonly<Record<string, string>>): string {
	return text.replace(TOKEN, (whole, name: string) =>
		Object.hasOwn(tokens, name) ? tokens[name]! : whole
	);
}

/** Builds a token -> original record; the first original seen per token wins. */
export function tokensFromRedactions(redactions: readonly Redaction[]): Record<string, string> {
	const entries = new Map<string, string>();
	for (const { original, token } of redactions) {
		if (!entries.has(token)) entries.set(token, original);
	}
	// fromEntries defines own properties, so a token can never touch the prototype.
	return Object.fromEntries(entries);
}
