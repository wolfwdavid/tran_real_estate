// Pure, unit-testable rules for the banned-terms copy-compliance gate.
// No I/O here: scripts/banned-terms.mjs supplies file lists and contents.
//
// Copy must never imply brokerage, appraisal, guaranteed outcomes or investment advice, and must
// carry no fabricated testimonials or metrics. Word phrases match across any whitespace (Prettier
// wraps long Svelte text at printWidth 100), case-insensitively, with explicit inflections.
// Symbols are matched literally and as HTML entities. There is deliberately no allowlist.

/** @param {string} s */
const words = (s) => s.trim().split(/\s+/).join('\\s+');

/** @type {ReadonlyArray<readonly [string, RegExp]>} */
export const BANNED = [
	['appraisal', /\bappraisals?\b/i],
	['appraise', /\bapprais(?:e|es|ed|ing|er|ers)\b/i],
	['guarantee', /\bguarantee(?:s|d)?\b/i],
	['guaranty', /\bguarant(?:y|ies)\b/i],
	['best investment', new RegExp(`\\b${words('best investment')}s?\\b`, 'i')],
	['we represent', new RegExp(`\\b${words('we represent')}\\b`, 'i')],
	['brokerage services', new RegExp(`\\b${words('brokerage services')}\\b`, 'i')],
	['risk-free', /\brisk[-\s]?free\b/i],
	['will appreciate', new RegExp(`\\b${words('will appreciate')}\\b`, 'i')],
	['passive income', new RegExp(`\\b${words('passive income')}\\b`, 'i')],
	['testimonial', /\btestimonials?\b/i],
	['rated 5', /\brated\s+5\b|\b(?:5|five)[-\s]star\b/i],
	['star glyph', /[★☆]|&#9733;|&#x2605;|&starf;|&#9734;|&star;/i],
	['trusted by', new RegExp(`\\b${words('trusted by')}\\b`, 'i')],
	['thousands of', new RegExp(`\\b${words('thousands of')}\\b`, 'i')]
];

/** Repo-relative folders whose copy is scanned. */
export const SCOPE = [
	'apps/web/src/routes',
	'apps/web/src/lib/components',
	'apps/web/src/lib/content'
];
export const SCANNED_EXT = /\.(svelte|ts|js|md)$/i;
export const EXCLUDED = /\.(test|spec)\.[tj]s$/i;

/**
 * Scans the WHOLE text (not line by line) so phrases wrapped across lines are still caught.
 * @param {string} file repo-relative path (forward slashes)
 * @param {string} text file contents
 * @returns {string[]} one `file:line: banned term "X" (matched "...")` per hit
 */
export function findBanned(file, text) {
	const src = text ?? '';
	/** @type {string[]} */
	const hits = [];
	for (const [label, re] of BANNED) {
		// Clone with 'g' per call so callers never see a stale lastIndex.
		const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
		for (const m of src.matchAll(g)) {
			const line = (src.slice(0, m.index).match(/\n/g)?.length ?? 0) + 1;
			hits.push(`${file}:${line}: banned term "${label}" (matched "${m[0].replace(/\s+/g, ' ')}")`);
		}
	}
	return hits;
}
