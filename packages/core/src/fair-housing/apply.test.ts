import { describe, expect, test } from 'vitest';

import { applyAlternative } from './apply.js';
import type { Finding, FindingMember, Severity } from './types.js';

function member(
	text: string,
	phrase: string,
	alternative: string,
	severity: Severity
): FindingMember {
	const start = text.indexOf(phrase);
	if (start < 0) throw new Error(`phrase not in text: ${phrase}`);
	return {
		entryId: `t.${severity}`,
		checker: 'fair-housing',
		category: 'familial-status',
		categoryLabel: 'Familial status',
		scope: 'federal',
		severity,
		explanation: '',
		alternative,
		source: '',
		phrase,
		start,
		end: start + phrase.length
	};
}

function group(text: string, members: FindingMember[]): Finding {
	const start = Math.min(...members.map((m) => m.start));
	const end = Math.max(...members.map((m) => m.end));
	return {
		id: `${start}-${end}`,
		start,
		end,
		severity: members.some((m) => m.severity === 'block') ? 'block' : 'warn',
		phrase: text.slice(start, end),
		members
	};
}

function f(
	text: string,
	phrase: string,
	alternative: string,
	severity: Severity = 'block'
): Finding {
	return group(text, [member(text, phrase, alternative, severity)]);
}

const ALT = 'close to transit and downtown';

describe('applyAlternative: replace', () => {
	test('keeps capitalization at sentence start and reports the cursor', () => {
		const text = 'Perfect for young professionals, with a great view.';
		const result = applyAlternative(text, f(text, 'Perfect for young professionals', ALT));
		expect(result.text).toBe('Close to transit and downtown, with a great view.');
		expect(result.cursor).toBe('Close to transit and downtown'.length);
	});

	test('keeps lowercase mid-sentence', () => {
		const text = 'A home perfect for young professionals.';
		const result = applyAlternative(text, f(text, 'perfect for young professionals', ALT));
		expect(result.text).toBe('A home close to transit and downtown.');
		expect(result.cursor).toBe('A home close to transit and downtown'.length);
	});

	test('only the first character changes, and only when the phrase starts uppercase', () => {
		const upper = 'Perfect for young professionals.';
		expect(
			applyAlternative(upper, f(upper, 'Perfect for young professionals', 'near the BART line'))
				.text
		).toBe('Near the BART line.');
		const lower = 'A home perfect for young professionals.';
		expect(
			applyAlternative(lower, f(lower, 'perfect for young professionals', 'Near the BART line'))
				.text
		).toBe('A home Near the BART line.');
	});

	test('a merged group uses the block member alternative', () => {
		const text = 'Perfect for young professionals.';
		const warn = member(text, 'young professionals', 'warn alternative', 'warn');
		const block = member(text, 'Perfect for young professionals', ALT, 'block');
		const result = applyAlternative(text, group(text, [warn, block]));
		expect(result.text).toBe('Close to transit and downtown.');
	});

	test('a warn-only group uses the first member', () => {
		const text = 'Walking distance to church.';
		const result = applyAlternative(
			text,
			f(text, 'Walking distance to church', 'walkable to shops and parks', 'warn')
		);
		expect(result.text).toBe('Walkable to shops and parks.');
	});
});

describe('applyAlternative: remove phrase', () => {
	test('mid-list clause', () => {
		const text = 'Two bedrooms, no Section 8, utilities included.';
		const result = applyAlternative(text, f(text, 'no Section 8', ''));
		expect(result.text).toBe('Two bedrooms, utilities included.');
		expect(result.cursor).toBe('Two bedrooms, '.length);
	});

	test('trailing sentence', () => {
		const text = 'Utilities included. No Section 8.';
		const result = applyAlternative(text, f(text, 'No Section 8', ''));
		expect(result.text).toBe('Utilities included.');
		expect(result.cursor).toBe('Utilities included.'.length);
	});

	test('leading sentence', () => {
		const text = 'No Section 8. Utilities included.';
		const result = applyAlternative(text, f(text, 'No Section 8', ''));
		expect(result.text).toBe('Utilities included.');
		expect(result.cursor).toBe(0);
	});

	test('line start keeps the newline structure', () => {
		const text = 'Hi,\nNo kids. Two bedrooms.';
		expect(applyAlternative(text, f(text, 'No kids', '')).text).toBe('Hi,\nTwo bedrooms.');
	});

	test('text outside the edited window is untouched', () => {
		const text = 'A  b. Two bedrooms, no Section 8, utilities.';
		expect(applyAlternative(text, f(text, 'no Section 8', '')).text).toBe(
			'A  b. Two bedrooms, utilities.'
		);
	});

	test('final list item before a period drops the dangling comma', () => {
		const text = 'Utilities included, no Section 8.';
		expect(applyAlternative(text, f(text, 'no Section 8', '')).text).toBe('Utilities included.');
	});

	test('capitalizes the next word when it becomes the sentence start', () => {
		const text = 'No kids, two bedrooms.';
		expect(applyAlternative(text, f(text, 'No kids', '')).text).toBe('Two bedrooms.');
	});

	test('inline removal collapses to a single space', () => {
		const text = 'A great no kids home.';
		const result = applyAlternative(text, f(text, 'no kids', ''));
		expect(result.text).toBe('A great home.');
		expect(result.cursor).toBe('A great '.length);
	});

	test('removing the whole text leaves an empty string', () => {
		const text = 'No kids.';
		expect(applyAlternative(text, f(text, 'No kids', ''))).toEqual({ text: '', cursor: 0 });
	});
});
