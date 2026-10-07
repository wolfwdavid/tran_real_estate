// Studio post-checks (STU-01..04). Phase 5 bare PostCheck functions every studio tool passes to
// GenerationPanel's `postChecks` prop, so marks, popovers and exit gating work unchanged:
// - numberPostCheck: every numeral must match a figure the agent supplied (or, for the Market
//   Snapshot, a figure Tran calculated). Block; no suggested replacement, because a replacement
//   number would itself be invented.
// - numberWordsPostCheck: number words above ten and a bare "percent" (the digit check cannot see
//   them). Review.
// - unsupportedFeaturePostCheck: a listing feature the agent did not select or type. Review.
// Matching lives in @tran/core (numbers, studio); this module only adapts hits to Findings.
import { mergeFindings, type Finding, type FindingMember } from '@tran/core/fair-housing';
import { checkNumbers, findNumberWords } from '@tran/core/numbers';
import {
	allowedSet,
	findUnsupportedFeatures,
	listingFreeText,
	type ListingFacts
} from '@tran/core/studio';
import { createPostCheck, type PostCheck } from '$lib/ai/ui/post-check';

export type { PostCheck };

/** Category label and popover explanation per studio tool (09-UI-SPEC, verbatim). */
export const NUMBER_CATEGORIES = {
	listing: {
		category: 'Number not in your facts',
		explanation:
			"This number isn't in the facts you entered. Change it to match your facts, or remove it."
	},
	social: {
		category: 'Number not in your brief',
		explanation: "This number isn't in your brief. Change it to match your brief, or remove it."
	},
	reel: {
		category: "Number you didn't provide",
		explanation:
			"This number isn't in what you typed. Scripts may only use results you supply. Change it or remove it."
	},
	snapshot: {
		category: 'Number not in this report',
		explanation:
			"This number isn't one of the figures in this report. Notes may only use numbers Tran calculated. Change it to a figure from the report, or remove the sentence."
	}
} as const;

export type NumberCheckKind = keyof typeof NUMBER_CATEGORIES;

/** FindingMember.checker ids (group keys for the panel's checkGroups). */
export const STUDIO_CHECKERS = {
	numbers: 'numbers',
	numberWords: 'number-words',
	features: 'unsupported-features'
} as const;

export const NUMBER_WORD_CATEGORY = 'Number written as a word';
export const NUMBER_WORD_EXPLANATION =
	'Write numbers as digits so Tran can check them against what you entered.';

export const UNSUPPORTED_FEATURE_CATEGORY = 'Not in your facts';
export const unsupportedFeatureExplanation = (feature: string): string =>
	`This mentions "${feature}", which isn't in your facts. Remove it, or add it to your facts if the home has it.`;

/** Block finding for every numeral that matches no allowed figure. */
export function numberPostCheck(kind: NumberCheckKind, allowed: readonly number[]): PostCheck {
	const copy = NUMBER_CATEGORIES[kind];
	const values = [...allowed];
	return createPostCheck({
		checker: STUDIO_CHECKERS.numbers,
		entryId: `numbers.studio-${kind}`,
		category: `number-not-in-${kind}`,
		categoryLabel: copy.category,
		explanation: copy.explanation,
		detect: (text) =>
			checkNumbers(text, values)
				// Spelled-out quantities are numberWordsPostCheck's job (warn), not a second finding.
				.filter((f) => f.reason === 'not-in-allowed')
				.map(({ start, end }) => ({ start, end, severity: 'block' as const }))
	});
}

/** Review finding for each number word above ten and each "percent" not after a numeral. */
export function numberWordsPostCheck(): PostCheck {
	return createPostCheck({
		checker: STUDIO_CHECKERS.numberWords,
		entryId: 'numbers.studio-number-word',
		category: 'number-written-as-word',
		categoryLabel: NUMBER_WORD_CATEGORY,
		explanation: NUMBER_WORD_EXPLANATION,
		detect: (text) =>
			findNumberWords(text).map(({ start, end }) => ({ start, end, severity: 'warn' as const }))
	});
}

/**
 * Review finding for each listing-vocabulary feature the facts do not back. Garage spaces above 0
 * count as the Garage chip: "a 2-car garage" is in the facts the agent typed.
 */
export function unsupportedFeaturePostCheck(facts: ListingFacts): PostCheck {
	const features =
		(facts.garageSpaces ?? 0) > 0 && !facts.features.includes('Garage')
			? [...facts.features, 'Garage' as const]
			: [...facts.features];
	const support = { features, nearby: [...facts.nearby], freeText: listingFreeText(facts) };
	return (text: string): Finding[] =>
		mergeFindings(
			findUnsupportedFeatures(text, support).map((hit): FindingMember => {
				const phrase = text.slice(hit.start, hit.end);
				return {
					entryId: `features.unsupported.${hit.conceptId}`,
					checker: STUDIO_CHECKERS.features,
					category: 'unsupported-feature',
					categoryLabel: UNSUPPORTED_FEATURE_CATEGORY,
					scope: 'other',
					severity: 'warn',
					explanation: unsupportedFeatureExplanation(phrase.toLowerCase()),
					alternative: '',
					source: '',
					phrase,
					start: hit.start,
					end: hit.end
				};
			}),
			text
		);
}

/** Listing: every typed numeric fact plus the numerals inside the agent's free text. */
export function listingAllowedNumbers(f: ListingFacts): number[] {
	return allowedSet(
		[f.bedrooms, f.bathrooms, f.squareFeet, f.yearBuilt, f.garageSpaces, f.price],
		listingFreeText(f)
	);
}

/** Social: the numerals in the agent's brief (and the link they pasted, if any). */
export function briefAllowedNumbers(brief: string, link?: string): number[] {
	return allowedSet([], [brief, link]);
}

/** Reel: the numerals in the agent's own beat text only. */
export function reelAllowedNumbers(beats: Record<string, string>): number[] {
	return allowedSet([], Object.values(beats));
}
