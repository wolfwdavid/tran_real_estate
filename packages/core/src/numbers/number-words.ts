/**
 * Number-word detector for the studio's number check.
 *
 * The digit check cannot see a quantity written in words, so "rents rose
 * twelve percent" would slip past it. This reports each number word above ten
 * ("eleven", "twenty", "twenty-five", "hundred", "thousand", "million",
 * "billion", "dozen") and any "percent" whose preceding token is not a numeral
 * or "%". Words one through ten are normal prose ("two bedrooms") and are not
 * reported. Scale words that belong to a digit numeral ("$1.2 million",
 * "20 thousand") are left to the digit check.
 *
 * Every hit carries offsets into the original text:
 * `text.slice(hit.start, hit.end).toLowerCase() === hit.word`.
 */
import { extractNumerals } from './extract.js';

export interface NumberWordHit {
	start: number;
	end: number;
	word: string;
}

const UNITS = 'one|two|three|four|five|six|seven|eight|nine';
const TEENS = 'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const SCALE = 'hundred|thousand|million|billion|dozen';

/**
 * Letter/digit boundaries on both sides (Unicode-aware), so "Seventeenth" and
 * "eleventh" are not hits. Each alternative is a fixed word with at most one
 * optional suffix, so there are no nested quantifiers and matching is linear.
 */
const WORDS = new RegExp(
	`(?<![\\p{L}\\p{N}])(?:(?:${TENS})(?:-(?:${UNITS}))?|${TEENS}|${SCALE}|percent)(?![\\p{L}\\p{N}])`,
	'giu'
);

const SCALE_WORD = new RegExp(`^(?:${SCALE})$`, 'i');

/** True when the last non-space character before `index` is a digit or "%". */
function afterNumeral(text: string, index: number): boolean {
	let i = index - 1;
	while (i >= 0 && /\s/u.test(text[i]!)) i--;
	return i >= 0 && /[\p{N}%]/u.test(text[i]!);
}

export function findNumberWords(text: string): NumberWordHit[] {
	const numerals = extractNumerals(text);
	const hits: NumberWordHit[] = [];
	for (const m of text.matchAll(WORDS)) {
		const start = m.index;
		const end = start + m[0].length;
		const word = m[0].toLowerCase();
		const isPercent = word === 'percent';
		const isScale = !isPercent && SCALE_WORD.test(word);
		if ((isPercent || isScale) && afterNumeral(text, start)) continue;
		if (numerals.some((n) => n.start < end && start < n.end)) continue;
		hits.push({ start, end, word });
	}
	return hits;
}
