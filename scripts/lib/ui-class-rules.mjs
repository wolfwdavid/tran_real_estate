// Pure, unit-testable rules for the shadcn UI class guard.
// No I/O here: scripts/ui-class-guard.mjs supplies file lists and contents.
//
// The copied-in shadcn-svelte primitives must render Phase 2 tokens only. Under `--color-*: initial`
// palette classes compile to nothing (an invisible overlay raises no error), shadcn's `bg-secondary`
// would paint a sage block, dark mode does not exist, `ring-ring/*` replaces the outline focus
// treatment, and every tw-animate-css animation must be gated behind `motion-safe:`.

/** Repo-relative folders that are scanned. */
export const SCOPE = ['apps/web/src/lib/components/ui'];
export const SCANNED_EXT = /\.(svelte|ts)$/i;

const PALETTE =
	'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTIL =
	'bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|from|via|to|shadow|divide|placeholder|decoration|accent|caret';

/** @type {ReadonlyArray<readonly [string, (utility: string, variants: string[]) => boolean]>} */
const RULES = [
	['shadcn secondary fill (paints a sage block)', (u) => /^bg-secondary(?:\/|$)/.test(u)],
	[
		'black/white palette class (compiles to nothing under --color-*: initial)',
		(u) => new RegExp(`^(?:${COLOR_UTIL})-(?:black|white)(?:\\/|$)`).test(u)
	],
	[
		'Tailwind palette color (use a Phase 2 token)',
		(u) => new RegExp(`^(?:${COLOR_UTIL})-(?:${PALETTE})-\\d{2,3}(?:\\/|$)`).test(u)
	],
	['dark: variant (light mode only)', (_u, v) => v.includes('dark')],
	['ring-ring/* focus treatment (use the outline ring)', (u) => /^ring-ring\//.test(u)],
	[
		'animation without a leading motion-safe:',
		(u, v) =>
			/^(?:animate-in|animate-out|animate-spin|fade-in|fade-out|zoom-in|zoom-out)/.test(u) &&
			v[0] !== 'motion-safe'
	]
];

/**
 * Splits a class token into its variant chain and the utility, ignoring colons inside `[...]`.
 * @param {string} token
 * @returns {{ variants: string[]; utility: string }}
 */
function parseToken(token) {
	/** @type {string[]} */
	const parts = [];
	let depth = 0;
	let cur = '';
	for (const ch of token) {
		if (ch === '[') depth++;
		else if (ch === ']') depth = Math.max(0, depth - 1);
		if (ch === ':' && depth === 0) {
			parts.push(cur);
			cur = '';
		} else cur += ch;
	}
	const utility = cur.replace(/^!|!$/g, '').replace(/^-/, '');
	return { variants: parts, utility };
}

/**
 * Returns `file:line: <rule> (matched "<token>")` for every violation in `text`.
 * @param {string} file repo-relative POSIX path
 * @param {string} text file contents
 * @returns {string[]}
 */
export function findUiClassViolations(file, text) {
	/** @type {string[]} */
	const hits = [];
	const isButton = /(?:^|\/)button\/button\.svelte$/.test(file);
	text.split(/\r?\n/).forEach((line, i) => {
		const at = `${file}:${i + 1}`;
		if (isButton && /^\s*(?:secondary|'secondary'|"secondary")\s*:/.test(line)) {
			hits.push(`${at}: Button 'secondary' variant is not allowed (matched "secondary:")`);
		}
		for (const token of line.split(/[\s'"`{}(),;=<>]+/)) {
			if (!token) continue;
			const { variants, utility } = parseToken(token);
			for (const [rule, test] of RULES) {
				if (test(utility, variants)) hits.push(`${at}: ${rule} (matched "${token}")`);
			}
		}
	});
	return hits;
}
