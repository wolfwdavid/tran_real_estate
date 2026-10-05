// Defense in depth for "backups never contain keys". Structurally, the export only reads the
// registered tables of the app database and the vault lives in a separate database; this scan
// additionally refuses to produce a file that looks like it holds a key.
//
// There is deliberately no bare hex shape: it would false-positive on sha256 hashes such as
// Phase 5's inputHash. RentCast's key format is undocumented, so RentCast is covered only by the
// exact-value check against the vault's known secrets.
// Regexes are non-global, so `test` carries no lastIndex state between calls.
export const KEY_SHAPES: readonly { readonly provider: string; readonly re: RegExp }[] =
	Object.freeze([
		Object.freeze({ provider: 'anthropic', re: /sk-ant-[A-Za-z0-9_-]{20,}/ }),
		Object.freeze({ provider: 'openrouter', re: /sk-or-(?:v1-)?[A-Za-z0-9]{20,}/ }),
		Object.freeze({ provider: 'openai', re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/ }),
		Object.freeze({ provider: 'gemini', re: /AIza[0-9A-Za-z_-]{35}/ })
	]);

/** Minimum length for the exact-value check, so short values cannot match by accident. */
const MIN_SECRET_LENGTH = 8;

/** Returns deduplicated provider labels (plus 'vault-value'), never the matched text. */
export function findKeyMaterial(json: string, knownSecrets: readonly string[]): string[] {
	const hits = new Set<string>();
	for (const { provider, re } of KEY_SHAPES) if (re.test(json)) hits.add(provider);
	for (const s of knownSecrets) {
		if (s.length >= MIN_SECRET_LENGTH && json.includes(s)) hits.add('vault-value');
	}
	return [...hits];
}
