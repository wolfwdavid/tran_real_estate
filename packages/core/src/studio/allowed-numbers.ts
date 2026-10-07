/**
 * Allowed-number sets for the studio tools.
 *
 * Every studio tool (listing, social, reel) checks its AI output against the
 * numbers the agent supplied: typed field values plus any numeral inside the
 * agent's own free text. The text is parsed with the same extractor the
 * checker runs on the output, so "$2,450" or "1,450" typed by the agent always
 * matches the same figure in a draft.
 */
import { extractNumerals } from '../numbers/index.js';

/** Every numeral value found in the given texts, in order. */
export function numbersInTexts(texts: readonly (string | null | undefined)[]): number[] {
	const out: number[] = [];
	for (const text of texts) {
		if (!text) continue;
		for (const tok of extractNumerals(text)) out.push(tok.value);
	}
	return out;
}

function isFiniteNumber(v: number | null | undefined): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

/** Typed values plus numbers in free text: finite, de-duplicated, ascending. */
export function allowedSet(
	values: readonly (number | null | undefined)[],
	texts?: readonly (string | null | undefined)[]
): number[] {
	const all = [...values.filter(isFiniteNumber), ...numbersInTexts(texts ?? [])];
	return [...new Set(all)].sort((a, b) => a - b);
}
