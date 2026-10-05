import type { Finding, FindingMember } from './types.js';

const PUNCT = ',.;:!?';

function capitalizeFirst(value: string): string {
	const codePoint = value.codePointAt(0);
	if (codePoint === undefined) return value;
	const first = String.fromCodePoint(codePoint);
	return first.toLocaleUpperCase('en-US') + value.slice(first.length);
}

const trimEndSpaces = (value: string): string => value.replace(/[ \t]+$/, '');
const trimStartSpaces = (value: string): string => value.replace(/^[ \t]+/, '');

/** True when `left` (already trimmed of trailing spaces/tabs) ends a sentence or line. */
function atSentenceStart(leftCore: string): boolean {
	return leftCore === '' || leftCore.endsWith('\n') || /[.!?]$/.test(leftCore);
}

/** The member whose alternative a merged group applies: the first block member, else the first member. */
function primaryMember(finding: Finding): FindingMember | undefined {
	return finding.members.find((m) => m.severity === 'block') ?? finding.members[0];
}

/**
 * Applies the finding's suggested alternative in place. An empty alternative
 * removes the phrase and tidies the punctuation and spacing around it. Only the
 * local window around the finding is edited; text elsewhere is untouched.
 * Returns the new text and the cursor position just after the edit.
 */
export function applyAlternative(text: string, finding: Finding): { text: string; cursor: number } {
	const alternative = primaryMember(finding)?.alternative ?? '';
	let left = text.slice(0, finding.start);
	let right = text.slice(finding.end);

	if (alternative !== '') {
		const replacement = /^\p{Lu}/u.test(text.slice(finding.start))
			? capitalizeFirst(alternative)
			: alternative;
		return { text: left + replacement + right, cursor: left.length + replacement.length };
	}

	// 1. The phrase is gone; spaces that followed it are not needed.
	right = trimStartSpaces(right);

	// 2. Punctuation that closed the removed clause.
	const leftCore = trimEndSpaces(left);
	const next = right[0];
	if (next !== undefined && PUNCT.includes(next)) {
		if (atSentenceStart(leftCore)) {
			// Removed a whole sentence or leading clause: drop its punctuation too.
			right = trimStartSpaces(right.slice(1));
		} else if (/[,;:]$/.test(leftCore)) {
			if (',;:'.includes(next)) {
				// "a, X, b" -> "a, b": keep the left separator, drop the right one.
				right = trimStartSpaces(right.slice(1));
			} else {
				// "a, X." -> "a.": the left separator would dangle before the period.
				left = leftCore.slice(0, -1);
			}
		}
	}

	// 3. No space before punctuation, a newline or the end of the text.
	if (/[ \t]$/.test(left) && (right === '' || /^[,.;:!?\n]/.test(right))) {
		left = trimEndSpaces(left);
	}

	// 4. The next word may now start a sentence.
	if (/^\p{Ll}/u.test(right) && atSentenceStart(trimEndSpaces(left))) {
		right = capitalizeFirst(right);
	}

	return { text: left + right, cursor: left.length };
}
