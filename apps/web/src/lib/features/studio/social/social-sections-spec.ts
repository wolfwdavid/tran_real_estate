// Social post pack section specs (09-UI-SPEC "PlatformCard anatomy", STU-02): the three
// SectionSpecs the social studio hands to GenerationPanel `sections` mode, in the fixed order
// Instagram, Facebook, LinkedIn.
//
// Disclosure-last by construction: `assemble` is core assemblePost(key, body, tags, disclosure),
// which appends the agent's ad-inline disclosure after the body and the capped hashtag block.
// The disclosure is shown read-only on each card (emailFooter), never sent to the AI and never
// Fair Housing-checked. The checks on each card are Fair Housing (the panel's own) plus the
// studio number check against the brief and the number-words check.
import {
	HASHTAG_CAPS,
	PLATFORMS,
	PLATFORM_LABELS,
	assemblePost,
	parseSocialPack,
	splitTrailingHashtags,
	type Platform
} from '@tran/core/studio';
import type { SectionSpec } from '$lib/ai/ui/PlatformCard.svelte';
import type { CheckGroupCopy } from '$lib/ai/ui/post-check';
import {
	STUDIO_CHECKERS,
	briefAllowedNumbers,
	numberPostCheck,
	numberWordsPostCheck
} from '../post-checks';

export const SOCIAL_FOOTER_LABEL = 'Added to the end of this post';

/** Constraint line under each card's h3 (09-UI-SPEC copy, verbatim). */
export const SOCIAL_CONSTRAINT_LINES: Readonly<Record<Platform, string>> = Object.freeze({
	instagram: 'Caption up to 2,200 characters. Up to 5 hashtags, in their own block.',
	facebook: 'Conversational. Up to 2 hashtags.',
	linkedin: 'Professional. Up to 3 hashtags at the end.'
});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Findings groups after Fair Housing on each card (presentational; gating stays Phase 5's). */
export const SOCIAL_CHECK_GROUPS: CheckGroupCopy[] = [
	{
		checker: STUDIO_CHECKERS.numbers,
		label: 'Number check',
		passedTitle: 'Number check passed',
		passedNote: 'Every number matches your brief.',
		findingsTitle: (b, w) => `Number check: ${b + w} to fix`,
		allowRemovePhrase: false,
		doneSentence: (b, w) =>
			b + w === 0
				? 'Every number matches your brief.'
				: `${plural(b + w, 'number', 'numbers')} to fix.`
	},
	{
		checker: STUDIO_CHECKERS.numberWords,
		label: 'Numbers as words',
		passedTitle: 'Numbers are written as digits',
		findingsTitle: (b, w) => `Numbers as words: ${b + w} to review`,
		allowRemovePhrase: false,
		doneSentence: (b, w) =>
			b + w === 0 ? '' : `${plural(b + w, 'number word', 'number words')} to review.`
	}
];

/** One platform's section text: the body, then its hashtag line after a blank line. */
function sectionText(body: string, tags: readonly string[]): string {
	return tags.length > 0 ? `${body}\n\n${tags.join(' ')}` : body;
}

function sectionSpec(key: Platform, disclosure: string, brief: string, link: string): SectionSpec {
	return {
		key,
		label: PLATFORM_LABELS[key],
		constraintLine: SOCIAL_CONSTRAINT_LINES[key],
		emailFooter: { text: disclosure, label: SOCIAL_FOOTER_LABEL },
		extract(fullText, streaming) {
			const pack = parseSocialPack(fullText, { streaming });
			const s = pack[key];
			if (s.ok) {
				return {
					state: streaming && pack.active === key ? 'streaming' : 'ok',
					text: sectionText(s.body, s.tags)
				};
			}
			if (streaming) return { state: pack.active === key ? 'streaming' : 'empty', text: '' };
			return { state: fullText === '' ? 'empty' : 'error', text: '' };
		},
		assemble(text) {
			// Re-parsed every time, so an agent's edit is measured and capped the same way.
			const split = splitTrailingHashtags(text);
			const a = assemblePost(key, split.body, split.tags, disclosure);
			return { ...a, tagsOverCap: Math.max(0, split.tags.length - HASHTAG_CAPS[key]) };
		},
		postChecks: [
			numberPostCheck('social', briefAllowedNumbers(brief, link)),
			numberWordsPostCheck()
		]
	};
}

/**
 * The three section specs, in the fixed order instagram, facebook, linkedin.
 * `profileDisclosure` is the ad-inline disclosure text appended to every post; `brief` and `link`
 * are the only sources of allowed numbers.
 */
export function buildSocialSections(
	profileDisclosure: string,
	brief: string,
	link: string
): SectionSpec[] {
	return PLATFORMS.map((key) => sectionSpec(key, profileDisclosure, brief, link));
}
