// Analysis hash for memo staleness (INV-06, RESEARCH Pattern 5 step 7). A saved memo records the
// hash of the deal inputs it narrates; when the inputs (or the analyzer's formulas, via
// ANALYZER_VERSION) change, the hash changes and the memo is shown as out of date.
//
// Synchronous by design (used during render), so no Web Crypto. FNV-1a 32-bit is a staleness
// fingerprint, not a security boundary.

import { ANALYZER_VERSION } from './analyze.js';
import type { DealInputs } from './types.js';

/** JSON with object keys sorted at every level and no whitespace; arrays keep their order. */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, v: unknown) => {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const sorted: Record<string, unknown> = {};
			for (const k of Object.keys(v).sort()) sorted[k] = (v as Record<string, unknown>)[k];
			return sorted;
		}
		return v;
	});
}

/** FNV-1a over UTF-16 code units, as 8 lowercase hex characters. */
export function fnv1a32(str: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, '0');
}

/** Fingerprint of a deal's inputs plus the analyzer version. */
export function analysisHash(inputs: DealInputs): string {
	return fnv1a32(`${canonicalJson(inputs)}|v${ANALYZER_VERSION}`);
}
