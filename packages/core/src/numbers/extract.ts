/**
 * Numeral extraction for the numeric post-check.
 *
 * Pure and DOM-free. Every token carries offsets into the ORIGINAL text, so a
 * UI can highlight the exact span. Pre-strip rules blank out text that looks
 * numeric but is not a figure (named rules, list enumerators, markdown
 * bullets) by replacing it with the same number of spaces, so indices survive.
 */

export interface NumeralToken {
	/** Offset of the first character (sign, parenthesis or currency included). */
	start: number;
	/** Exclusive end offset; `text.slice(start, end) === raw`. */
	end: number;
	/** Exact matched substring. */
	raw: string;
	/** sign × number × scale. */
	value: number;
	/** Digits after the decimal point as typed. */
	decimals: number;
	/** 1, 1e3 (k|K|thousand) or 1e6 (M|million). */
	scale: number;
	/**
	 * Significant digits as typed: leading zeros dropped; integers without
	 * decimals also drop trailing zeros ("15,000" -> 2, "1,064.48" -> 6).
	 */
	sig: number;
	unit: '%' | 'x' | null;
	currency: boolean;
}

/**
 * The numeral pattern. The `(?<![\w.])` lookbehind keeps digits inside words
 * ("B2B", "v1") out and makes the second half of a range ("1,800–2,100" or
 * "1,800-2,100") parse as positive, because the dash follows a digit.
 */
const NUM =
	/(?<![\w.])(?<neg>[-−(])?\s?(?<cur>\$)?(?<int>\d{1,3}(?:,\d{3})+|\d+)(?:\.(?<dec>\d+))?\s?(?<scale>k\b|K\b|thousand\b|M\b|million\b)?(?<unit>\s?%|\s?percent\b|x\b|×)?/g;

/**
 * Text that is never a figure. Line-anchored rules use `[ \t]*` rather than
 * `\s*` so `^` cannot scan across blank lines (keeps the scan linear).
 */
const PRE_STRIP: readonly RegExp[] = [
	/\b(1|50)%\s+rule\b/gi, // "the 1% rule", "50% rule"
	/^[ \t]*\d+[.)]\s/gm, // list enumerators "1. " and "2) "
	/^[ \t]*[-*•][ \t]/gm // markdown bullets, so "- 30-year" is not -30
];

function blank(match: string): string {
	return ' '.repeat(match.length);
}

function preStrip(text: string): string {
	let out = text;
	for (const re of PRE_STRIP) out = out.replace(re, blank);
	return out;
}

const SCALES: Record<string, number> = {
	k: 1e3,
	K: 1e3,
	thousand: 1e3,
	M: 1e6,
	million: 1e6
};

function significantDigits(intDigits: string, dec: string): number {
	if (dec.length > 0) {
		const all = (intDigits + dec).replace(/^0+/, '');
		return Math.max(all.length, 1);
	}
	const trimmed = intDigits.replace(/^0+/, '').replace(/0+$/, '');
	return Math.max(trimmed.length, 1);
}

function isSpace(ch: string | undefined): boolean {
	return ch !== undefined && /\s/.test(ch);
}

/**
 * Extract every numeral in `text`, in order.
 *
 * Sign rules: "-" and "−" (U+2212) mark a negative. An opening "(" marks an
 * accounting negative only when the numeral is closed by ")" right after it
 * and carries no "%"/"x" unit: "(183.52)" and "($183.52)" are negative, while
 * "(7.49%)" and "(1.17x)" are ordinary parentheticals.
 */
export function extractNumerals(text: string): NumeralToken[] {
	const scan = preStrip(text);
	const tokens: NumeralToken[] = [];
	for (const m of scan.matchAll(NUM)) {
		const g = m.groups ?? {};
		const intRaw = g.int ?? '';
		const dec = g.dec ?? '';
		const unitRaw = g.unit?.trim();
		const unit: NumeralToken['unit'] =
			unitRaw === undefined ? null : unitRaw === '%' || unitRaw === 'percent' ? '%' : 'x';
		const scale = g.scale === undefined ? 1 : (SCALES[g.scale] ?? 1);

		let start = m.index;
		let end = m.index + m[0].length;
		while (end > start && isSpace(scan[end - 1])) end--;

		let negative = false;
		if (g.neg === '(') {
			if (unit === null && scan[end] === ')') {
				negative = true;
				end++;
			} else {
				start++; // drop the "(" from the span
			}
		} else if (g.neg !== undefined) {
			negative = true;
		}
		while (start < end && isSpace(scan[start])) start++;

		const intDigits = intRaw.replace(/,/g, '');
		const decimals = dec.length;
		const magnitude = (Number(intDigits + dec) * scale) / 10 ** decimals;
		const value = negative && magnitude !== 0 ? -magnitude : magnitude;

		tokens.push({
			start,
			end,
			raw: text.slice(start, end),
			value,
			decimals,
			scale,
			sig: significantDigits(intDigits, dec),
			unit,
			currency: g.cur !== undefined
		});
	}
	return tokens;
}
