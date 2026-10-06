// Memo post-checks (INV-06). Two Phase 5 bare PostCheck functions, built with the 07-04 factory:
// numbers (every numeral must match a figure in the FACTS text or the notes) and advice language
// (no promises, no buy-or-sell advice). They go into GenerationPanel's `postChecks` prop, so they
// gate Copy, Open in email app and Mark as sent through Phase 5's unchanged controller. The page's
// print link reads the same findings through memoGateReasons.
//
// Number findings never carry a suggested replacement: a replacement number would itself be
// invented (UI-SPEC).
import type { Finding } from '@tran/core/fair-housing';
import { checkAdviceLanguage } from '@tran/core/finance';
import { checkNumbers, type AllowedNumber } from '@tran/core/numbers';
import { WARN_REASON, blockReason, type PostCheck } from '$lib/ai/ui/panel-controller';
import { createPostCheck, groupFindings, type CheckGroupCopy } from '$lib/ai/ui/post-check';

export const NUMBER_CATEGORY_LABEL = 'Number not in your analysis';
export const NUMBER_EXPLANATION =
	"This number doesn't match any figure in your analysis. Memos may only use numbers the analyzer calculated or that you entered. Change it to a figure from your results, or remove the sentence.";
export const ADVICE_CATEGORY_LABEL = 'Reads as advice or a promise';
export const ADVICE_EXPLANATION =
	"Memos describe the figures. They don't promise results or tell anyone to buy or sell. Rewrite this phrase as a plain description of the numbers.";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function createMemoPostChecks(allowed: readonly (number | AllowedNumber)[]): PostCheck[] {
	return [
		createPostCheck({
			checker: 'numbers',
			entryId: 'numbers.not-in-analysis',
			category: 'number-not-in-analysis',
			categoryLabel: NUMBER_CATEGORY_LABEL,
			explanation: NUMBER_EXPLANATION,
			detect: (t) =>
				checkNumbers(t, allowed, { category: 'number-not-in-analysis' }).map(
					({ start, end, severity }) => ({ start, end, severity })
				)
		}),
		createPostCheck({
			checker: 'advice',
			entryId: 'advice.language',
			category: 'advice-language',
			categoryLabel: ADVICE_CATEGORY_LABEL,
			explanation: ADVICE_EXPLANATION,
			detect: (t) =>
				checkAdviceLanguage(t).map(({ start, end, severity }) => ({ start, end, severity }))
		})
	];
}

/** Presentational copy for GenerationPanel's `checkGroups` (no check logic). */
export const MEMO_CHECK_GROUPS: CheckGroupCopy[] = [
	{
		checker: 'numbers',
		label: 'Number check',
		passedTitle: 'Number check passed',
		passedNote: 'Every number in this memo matches a figure from your analysis.',
		findingsTitle: (b, w) => `Number check: ${b + w} to fix`,
		allowRemovePhrase: false,
		doneSentence: (b, w) =>
			b + w === 0
				? 'Every number matches your analysis.'
				: `${plural(b + w, 'number', 'numbers')} to fix.`,
		gatingReason: (n) =>
			`Fix the ${plural(n, 'number', 'numbers')} marked Must fix to copy, email, or print this memo.`
	},
	{
		checker: 'advice',
		label: 'Advice language',
		passedTitle: 'Advice language check passed',
		passedNote: 'No promises or buy-or-sell advice found.',
		findingsTitle: (b, w) => `Advice language: ${b + w} to fix`,
		allowRemovePhrase: true,
		doneSentence: (b, w) =>
			b + w === 0
				? 'No advice language found.'
				: `${plural(b + w, 'advice phrase', 'advice phrases')} to fix.`,
		gatingReason: (n) =>
			`Rewrite the ${plural(n, 'advice phrase', 'advice phrases')} marked Must fix to copy, email, or print this memo.`
	}
];

/**
 * The visible reasons the print link is gated, in group order (Fair Housing first). Empty when the
 * panel allows exits, and while there is no finished draft (Phase 5 shows no reason then either).
 */
export function memoGateReasons(
	findings: readonly Finding[],
	blocked: boolean,
	canExit: boolean
): string[] {
	if (canExit) return [];
	const groups = groupFindings(findings, MEMO_CHECK_GROUPS);
	if (blocked) {
		const out: string[] = [];
		for (const g of groups) {
			if (g.blockCount === 0) continue;
			out.push(g.copy?.gatingReason?.(g.blockCount) ?? blockReason(g.blockCount));
		}
		return out;
	}
	return findings.some((f) => f.severity === 'warn') ? [WARN_REASON] : [];
}
