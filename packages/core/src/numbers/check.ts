/**
 * Numeric post-check: every numeral in generated text must come from an
 * allowed set of figures (INV-06 "numbers all come from the analyzer").
 *
 * Design notes:
 * - Matching is UNIT-AGNOSTIC by design. "7%" matches an allowed 7 whether the
 *   7 was a rate or a count. The allowed set is built from the exact FACTS
 *   text sent to the model, so a unit-blind match still means the number is
 *   present in the facts.
 * - Low-precision forms can coincide with a real fact: "$0.2 million" matches
 *   a $200,000 price. That is acceptable, because the number is then factually
 *   present.
 * - Numerals from the user's own notes are part of the allowed set (tag them
 *   with `source: 'your notes'`). Derived numbers (sums, conversions,
 *   annualizations the model computes itself) are not, and get flagged.
 * - Reusable: Phase 9 passes its own allowed set and category label.
 *
 * Match rule (RESEARCH Pattern 5):
 *   halfUnit = 0.5 × 10^(−decimals) × scale
 *   match(n, a) := sign(n) == sign(a) && ( |n − a| ≤ halfUnit + 1e-9
 *                                       || (sig(n) ≥ 2 && |n − a| ≤ 0.005 × |a|) )
 * Zero has sign 0 and matches only zero.
 */
import { extractNumerals, type NumeralToken } from './extract.js';
import { findSpelledQuantities } from './spelled.js';

export const NUMERIC_CATEGORY = 'numeric-provenance';

export interface AllowedNumber {
	value: number;
	/** Where the figure came from, e.g. 'analysis' or 'your notes'. */
	source?: string;
}

export interface NumberFinding {
	start: number;
	end: number;
	/** text.slice(start, end) */
	text: string;
	severity: 'block' | 'warn';
	/** Defaults to NUMERIC_CATEGORY; other features pass their own label. */
	category: string;
	reason: 'not-in-allowed' | 'spelled-out';
}

export function matchesAllowed(tok: NumeralToken, allowed: number): boolean {
	if (Math.sign(tok.value) !== Math.sign(allowed)) return false;
	const diff = Math.abs(tok.value - allowed);
	const halfUnit = (0.5 * tok.scale) / 10 ** tok.decimals;
	return diff <= halfUnit + 1e-9 || (tok.sig >= 2 && diff <= 0.005 * Math.abs(allowed));
}

function normalize(allowed: readonly (number | AllowedNumber)[]): number[] {
	const out: number[] = [];
	for (const a of allowed) {
		const v = typeof a === 'number' ? a : a.value;
		if (Number.isFinite(v)) out.push(v);
	}
	return out;
}

/**
 * Check `text` against `allowed`. Returns block findings for numerals not in
 * the allowed set plus warn findings for spelled-out quantities, sorted by
 * start offset.
 */
export function checkNumbers(
	text: string,
	allowed: readonly (number | AllowedNumber)[],
	opts?: { category?: string }
): NumberFinding[] {
	const category = opts?.category ?? NUMERIC_CATEGORY;
	const values = normalize(allowed);
	const findings: NumberFinding[] = [];
	for (const tok of extractNumerals(text)) {
		if (values.some((a) => matchesAllowed(tok, a))) continue;
		findings.push({
			start: tok.start,
			end: tok.end,
			text: tok.raw,
			severity: 'block',
			category,
			reason: 'not-in-allowed'
		});
	}
	for (const s of findSpelledQuantities(text, category)) {
		if (findings.some((f) => f.start < s.end && s.start < f.end)) continue;
		findings.push(s);
	}
	return findings.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Allowed numbers taken from a facts text: whatever is in the prompt is allowed. */
export function allowedFromText(text: string, source?: string): AllowedNumber[] {
	return extractNumerals(text).map((t) =>
		source === undefined ? { value: t.value } : { value: t.value, source }
	);
}
