/**
 * Spelled-out quantities. The memo prompt asks for digits, so a quantity
 * written in words cannot be checked against the allowed set. These are
 * `warn` findings (the user reviews them) rather than blocks: small counts
 * like "two bedrooms" are normal prose and are not reported.
 *
 * Reported: any maximal run of number words containing a word above ten
 * ("eleven units", "twenty thousand", "one hundred and fifty", "a dozen"), and
 * any run of number words directly followed by "percent" ("five percent").
 * Words that are part of a digit numeral ("20 million") are not reported.
 */
import { NUMERIC_CATEGORY, type NumberFinding } from './check.js';
import { extractNumerals } from './extract.js';

const BIG =
	'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen';
const SMALL = 'one|two|three|four|five|six|seven|eight|nine|ten';
const WORD = `(?:${BIG}|${SMALL})\\b`;

/** A maximal run of number words joined by spaces, hyphens or "and". */
const RUN = new RegExp(`\\b${WORD}(?:(?:[ \\t]*-[ \\t]*|\\s+(?:and\\s+)?)${WORD})*`, 'gi');
const HAS_BIG = new RegExp(`\\b(?:${BIG})\\b`, 'i');
const PERCENT_AFTER = /^\s+percent\b/i;

export function findSpelledQuantities(
	text: string,
	category: string = NUMERIC_CATEGORY
): NumberFinding[] {
	const numerals = extractNumerals(text);
	const findings: NumberFinding[] = [];
	for (const m of text.matchAll(RUN)) {
		const start = m.index;
		let end = start + m[0].length;
		const percent = PERCENT_AFTER.exec(text.slice(end, end + 32));
		if (!HAS_BIG.test(m[0]) && percent === null) continue;
		if (percent !== null) end += percent[0].length;
		if (numerals.some((n) => n.start < end && start < n.end)) continue;
		findings.push({
			start,
			end,
			text: text.slice(start, end),
			severity: 'warn',
			category,
			reason: 'spelled-out'
		});
	}
	return findings;
}
