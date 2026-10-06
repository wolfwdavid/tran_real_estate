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
	'apps/web/src/lib/content',
	// Phase 6 renter portal: the global list applies here too.
	'apps/web/src/lib/features/renter',
	'apps/web/src/lib/features/shared/listings',
	'apps/web/src/lib/features/shared/affordability',
	// Phase 7 investor portal and the shared pieces it introduces (markets, print, portal sub-nav).
	'apps/web/src/lib/features/investor',
	'apps/web/src/lib/features/shared/markets',
	'apps/web/src/lib/features/shared/print',
	'apps/web/src/lib/features/shared/nav'
];

/**
 * Phase 6 (06-UI-SPEC "banned-terms additions"): renter copy never claims a listing is available
 * (listing data can be stale) and never judges a price. Scoped to renter paths only, because these
 * phrases can be legitimate elsewhere. Model output is not scanned (the Fair Housing checker owns it).
 */
export const RENTER_SCOPES = [
	'apps/web/src/routes/(app)/renter/',
	'apps/web/src/lib/features/renter/',
	'apps/web/src/lib/features/shared/listings/'
];

/** @type {ReadonlyArray<readonly [string, RegExp]>} */
export const RENTER_BANNED = [
	['is available', new RegExp(`\\b${words('is available')}\\b`, 'i')],
	['still available', new RegExp(`\\b${words('still available')}\\b`, 'i')],
	['available now', new RegExp(`\\b${words('available now')}\\b`, 'i')],
	['overpriced', /\bover-?priced\b/i],
	['underpriced', /\bunder-?priced\b/i],
	['good deal', new RegExp(`\\b${words('good deal')}s?\\b`, 'i')],
	['bargain', /\bbargains?\b/i],
	['fair market value', new RegExp(`\\b${words('fair market value')}s?\\b`, 'i')],
	['market value', new RegExp(`\\b${words('market value')}s?\\b`, 'i')],
	['valuation report', new RegExp(`\\b${words('valuation report')}s?\\b`, 'i')],
	['appraised', /\bappraised\b/i]
];
/**
 * Phase 7 (07-UI-SPEC "Copywriting Contract"): investor copy never judges a deal or tells the
 * reader what to buy, because Tran gives no investment advice. Scoped to the investor routes, the
 * memo printout and the shared folders Phase 7 introduces; the global list applies there too.
 */
export const INVESTOR_SCOPES = [
	'apps/web/src/routes/(app)/investor/',
	'apps/web/src/routes/(print)/print/memo/',
	'apps/web/src/lib/features/investor/',
	'apps/web/src/lib/features/shared/markets/',
	'apps/web/src/lib/features/shared/print/',
	'apps/web/src/lib/features/shared/nav/'
];

/** @type {ReadonlyArray<readonly [string, RegExp]>} */
export const INVESTOR_BANNED = [
	['cash cow', new RegExp(`\\b${words('cash cow')}s?\\b`, 'i')],
	["can't lose", /\bcan[’']?t\s+lose\b/i],
	['no-brainer', /\bno[-\s]?brainers?\b/i],
	['great deal', new RegExp(`\\b${words('great deal')}s?\\b`, 'i')],
	['good deal', new RegExp(`\\b${words('good deal')}s?\\b`, 'i')],
	['bad deal', new RegExp(`\\b${words('bad deal')}s?\\b`, 'i')],
	['you should buy', new RegExp(`\\b${words('you should buy')}\\b`, 'i')],
	['we recommend', new RegExp(`\\b${words('we recommend')}\\b`, 'i')]
];

/** Each path-scoped list with the folders it applies to (the global BANNED applies everywhere). */
const SCOPED_LISTS = [
	{ scopes: RENTER_SCOPES, list: RENTER_BANNED },
	{ scopes: INVESTOR_SCOPES, list: INVESTOR_BANNED }
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
	const lists = [BANNED];
	for (const { scopes, list } of SCOPED_LISTS) {
		if (scopes.some((s) => file.startsWith(s))) lists.push(list);
	}
	for (const list of lists) {
		for (const [label, re] of list) {
			// Clone with 'g' per call so callers never see a stale lastIndex.
			const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
			for (const m of src.matchAll(g)) {
				const line = (src.slice(0, m.index).match(/\n/g)?.length ?? 0) + 1;
				hits.push(
					`${file}:${line}: banned term "${label}" (matched "${m[0].replace(/\s+/g, ' ')}")`
				);
			}
		}
	}
	return hits;
}
