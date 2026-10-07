// Text, email and US phone normalization: the foundation of duplicate detection (AGT-03), the
// inquiry-link sanitizer (AGT-02) and CSV import (AGT-07). Pure string logic, no platform globals.

const NBSP = /[\u00A0\u2007\u202F]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const QUOTE_MARKERS = /^(?:>\s?)+/;
// C0 except \t and \n, DEL + C1, bidi embeddings/overrides, isolates, zero-width chars.
// The control-character ranges are the point of this pattern: pasted lead text is untrusted. The
// class is built from code-point ranges (escaped \uXXXX text, never raw control characters), so
// the source stays readable and no-control-regex has no literal control pattern to object to.
const HOSTILE_RANGES: readonly (readonly [number, number])[] = [
	[0x0000, 0x0008],
	[0x000b, 0x001f],
	[0x007f, 0x009f],
	[0x202a, 0x202e],
	[0x2066, 0x2069],
	[0x200b, 0x200d],
	[0xfeff, 0xfeff]
];
const escapeCodePoint = (cp: number) => `\\u${cp.toString(16).padStart(4, '0')}`;
const HOSTILE = new RegExp(
	`[${HOSTILE_RANGES.map(([a, b]) => `${escapeCodePoint(a)}-${escapeCodePoint(b)}`).join('')}]`,
	'g'
);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NANP = /^[2-9]\d{2}[2-9]\d{6}$/;
const EXTENSION = /\s*(?:x|ext\.?|extension|#)\s*\d+\s*$/i;

/** Applies `step` until the value stops changing (bounded), so the result is idempotent. */
function fixpoint(s: string, step: (v: string) => string): string {
	let cur = s;
	for (let i = 0; i < 4; i++) {
		const next = step(cur);
		if (next === cur) return cur;
		cur = next;
	}
	return cur;
}

/**
 * Prepares pasted email text for parsing: \r\n and \r become \n, non-breaking spaces become
 * spaces, zero-width characters are removed, leading "> " quote markers are stripped from every
 * line, and the result is NFKC (full-width letters become ASCII).
 */
export function normalizeText(raw: string): string {
	return raw
		.replace(/\r\n?/g, '\n')
		.replace(NBSP, ' ')
		.replace(ZERO_WIDTH, '')
		.split('\n')
		.map((line) => line.replace(QUOTE_MARKERS, ''))
		.join('\n')
		.normalize('NFKC');
}

/** Strips control, bidi and zero-width characters, applies NFKC and trims. */
export function cleanText(raw: string): string {
	return fixpoint(raw, (s) => s.replace(HOSTILE, '').normalize('NFKC').replace(HOSTILE, '').trim());
}

/**
 * Canonical email key: NFKC, trimmed, lowercased; null when it is not email-shaped.
 * Never strip dots or +tags: that would merge distinct people.
 */
export function normEmail(raw: string): string | null {
	const s = fixpoint(raw, (v) => v.normalize('NFKC').trim().toLowerCase());
	return EMAIL.test(s) ? s : null;
}

/**
 * Canonical phone key in E.164. US/NANP numbers (10 digits, or 11 with a leading 1) become
 * +1XXXXXXXXXX; a trailing extension is dropped. Other numbers written with a leading + and 8-15
 * digits are kept unvalidated. Anything else is null: keep the raw value, never dedupe on it.
 */
export function normPhoneUS(raw: string): string | null {
	const main = raw.split(EXTENSION)[0] ?? '';
	const d = main.replace(/\D/g, '');
	const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
	if (ten !== null && NANP.test(ten)) return `+1${ten}`;
	if (main.trim().startsWith('+') && d.length >= 8 && d.length <= 15) return `+${d}`;
	return null;
}

/** '+15555550142' becomes '(555) 555-0142'; anything else is returned unchanged. */
export function formatPhoneUS(e164: string): string {
	const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
	return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** First whitespace-separated token of the cleaned name ('' for a blank name). */
export function firstName(name: string): string {
	return cleanText(name).split(/\s+/)[0] ?? '';
}
