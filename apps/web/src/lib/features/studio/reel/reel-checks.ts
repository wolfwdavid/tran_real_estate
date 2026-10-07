// Reel post-checks (STU-03). Phase 5 bare PostCheck functions the reel tool passes to
// GenerationPanel's `postChecks` alongside numberPostCheck('reel', ...) and numberWordsPostCheck():
// - resultsBeatPostCheck: with "Your results" empty, the RESULTS beat must keep the exact
//   placeholder and carry no digits. Block.
// - quotePostCheck: speech attributed to someone else ('"..." said', "my clients say"). Review.
// Matching lives in @tran/core/studio (checkResultsBeat, findAttributedQuotes); this module only
// adapts hits to Findings with the UI-SPEC copy.
import { RESULTS_PLACEHOLDER, checkResultsBeat, findAttributedQuotes } from '@tran/core/studio';
import { createPostCheck, type PostCheck } from '$lib/ai/ui/post-check';

export type { PostCheck };

/** FindingMember.checker ids (group keys for the panel's checkGroups). */
export const REEL_CHECKERS = {
	resultsBeat: 'results-beat',
	quotes: 'quotes'
} as const;

export const RESULTS_BEAT_CATEGORY = "Result you didn't provide";
export const RESULTS_BEAT_EXPLANATION = `You left Your results blank, so this beat must keep the placeholder ${RESULTS_PLACEHOLDER} and no numbers.`;

export const QUOTE_CATEGORY = 'Quote to confirm';
export const QUOTE_EXPLANATION =
	"This reads like someone else's words. Use a client's words only if they're real and you have their permission.";

/**
 * Block finding for the RESULTS beat when the agent left results empty: one finding per digit run
 * in that beat, or, when there are no digits but the placeholder is missing, one finding over the
 * whole beat. With typed results (resultsEmpty false) this never fires; numberPostCheck covers them.
 */
export function resultsBeatPostCheck(resultsEmpty: boolean): PostCheck {
	return createPostCheck({
		checker: REEL_CHECKERS.resultsBeat,
		entryId: 'reel.results-beat',
		category: 'result-not-provided',
		categoryLabel: RESULTS_BEAT_CATEGORY,
		explanation: RESULTS_BEAT_EXPLANATION,
		detect: (text) => {
			const violations = checkResultsBeat(text, resultsEmpty);
			const digits = violations.filter((v) => v.reason === 'digits');
			// Digits are the precise hit; the whole-beat range would swallow them in one merged mark.
			const hits = digits.length > 0 ? digits : violations;
			return hits.map(({ start, end }) => ({ start, end, severity: 'block' as const }));
		}
	});
}

/** Review finding for each quote or reported speech attributed to someone else. */
export function quotePostCheck(): PostCheck {
	return createPostCheck({
		checker: REEL_CHECKERS.quotes,
		entryId: 'reel.attributed-quote',
		category: 'attributed-quote',
		categoryLabel: QUOTE_CATEGORY,
		explanation: QUOTE_EXPLANATION,
		detect: (text) =>
			findAttributedQuotes(text).map(({ start, end }) => ({
				start,
				end,
				severity: 'warn' as const
			}))
	});
}
