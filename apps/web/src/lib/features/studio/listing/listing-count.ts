// Listing description count line (09-UI-SPEC "Listing description", Count line). Pure helpers:
// the description's words and characters, then the length of what Copy text actually produces
// (the draft plus a blank line plus the disclosure), and an optional listing-site limit line.
// Counts use String.length (UTF-16 code units, conservative), like every studio counter.
// Over the site limit is informational only; it never gates an exit.

const MIDDOT = String.fromCharCode(0xb7);
const NUMBER = new Intl.NumberFormat('en-US');

const n = (v: number): string => NUMBER.format(v);
const plural = (v: number, one: string, many: string): string => `${n(v)} ${v === 1 ? one : many}`;

/** Whitespace-separated words in the draft (0 for blank text). */
export function wordCount(text: string): number {
	const t = text.trim();
	return t === '' ? 0 : t.split(/\s+/).length;
}

/**
 * The copied text: the draft (trailing whitespace dropped), a blank line, then the disclosure.
 * Also the panel's formatForExit, so the count line and the clipboard always agree.
 */
export function withDisclosure(draft: string, disclosure: string): string {
	const body = draft.trimEnd();
	return disclosure === '' ? body : `${body}\n\n${disclosure}`;
}

/** "{w} words · {c} characters. With your disclosure: {d} characters." */
export function countLine(draft: string, disclosure: string): string {
	const words = wordCount(draft);
	const chars = draft.length;
	const total = withDisclosure(draft, disclosure).length;
	return (
		`${plural(words, 'word', 'words')} ${MIDDOT} ${plural(chars, 'character', 'characters')}. ` +
		`With your disclosure: ${plural(total, 'character', 'characters')}.`
	);
}

export interface SiteLimitLine {
	/** The description's length (the CharacterCount `length`). */
	length: number;
	limit: number;
	/** "{c} of {limit} characters for your listing site." */
	text: string;
	/** Shown instead of `text` when length > limit. */
	overText: string;
	over: boolean;
}

/** The listing-site line, or null when no limit (or a limit of 0) is set. */
export function siteLimitLine(draft: string, limit: number | undefined): SiteLimitLine | null {
	if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return null;
	const length = draft.length;
	const overBy = length - limit;
	return {
		length,
		limit,
		text: `${n(length)} of ${n(limit)} characters for your listing site.`,
		overText:
			`${plural(Math.max(overBy, 0), 'character', 'characters')} over your listing site's limit. ` +
			"Shorten the description, or leave the disclosure off if your site doesn't allow it there.",
		over: overBy > 0
	};
}
