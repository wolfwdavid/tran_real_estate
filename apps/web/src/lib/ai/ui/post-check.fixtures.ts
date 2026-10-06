// Shared test fixtures: a numbers-style post-check and its group copy (07-UI-SPEC wording).
import { createPostCheck, type CheckGroupCopy, type PostCheck } from './post-check';

/** Flags every percentage as a number not in the analysis (Must fix). */
export const numbersStub: PostCheck = createPostCheck({
	checker: 'numbers',
	entryId: 'numbers.not-in-analysis',
	category: 'number-not-in-analysis',
	categoryLabel: 'Number not in your analysis',
	explanation: 'This number does not match any figure from your analysis.',
	detect: (text) =>
		[...text.matchAll(/\d+%/g)].map((m) => ({
			start: m.index,
			end: m.index + m[0].length,
			severity: 'block' as const
		}))
});

export const numbersCopy: CheckGroupCopy = {
	checker: 'numbers',
	label: 'Number check',
	passedTitle: 'Number check passed',
	passedNote: 'Every number in this memo matches a figure from your analysis.',
	findingsTitle: (b, w) =>
		`Number check: ${[b > 0 ? `${b} to fix` : '', w > 0 ? `${w} to review` : '']
			.filter(Boolean)
			.join(', ')}`,
	allowRemovePhrase: false,
	doneSentence: (b) =>
		b === 0 ? 'Every number matches your analysis.' : `${b} number${b === 1 ? '' : 's'} to fix.`
};
