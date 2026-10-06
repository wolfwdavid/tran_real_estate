// Consumer post-checks (Phase 7 numbers, Phase 9 claims) built as Phase 5's bare PostCheck
// functions, plus presentational group copy for the findings UI. Gating is NOT here: a post-check
// is passed through GenerationPanel's existing `postChecks` prop and gates every exit through
// Phase 5's unchanged runChecks/computeGate (panel-controller.ts).
import {
	mergeFindings,
	type Finding,
	type FindingMember,
	type Severity
} from '@tran/core/fair-housing';
import type { PostCheck } from './panel-controller';

export type { PostCheck };

export const FAIR_HOUSING_CHECKER = 'fair-housing';

/** Factory input. Used only to BUILD a PostCheck; it is never passed to GenerationPanel. */
export interface PostCheckSpec {
	/** FindingMember.checker, e.g. 'numbers'; also the group key. */
	checker: string;
	/** e.g. 'numbers.not-in-analysis'. */
	entryId: string;
	/** Free-form, e.g. 'number-not-in-analysis'. */
	category: string;
	/** 'Number not in your analysis' (baked into every member). */
	categoryLabel: string;
	/** Popover explanation (baked into every member). */
	explanation: string;
	/** '' by default: the popover omits the "Based on" row. */
	source?: string;
	/** '' by default: no suggested wording. */
	alternative?: (phrase: string) => string;
	/** Pure and synchronous. Empty ranges are dropped. */
	detect: (text: string) => { start: number; end: number; severity: Severity }[];
}

/** Returns Phase 5's PostCheck: (text) => mergeFindings(members, text), members fully populated. */
export function createPostCheck(spec: PostCheckSpec): PostCheck {
	return (text: string): Finding[] =>
		mergeFindings(
			spec
				.detect(text)
				.filter((h) => h.end > h.start)
				.map((h): FindingMember => {
					const phrase = text.slice(h.start, h.end);
					return {
						entryId: spec.entryId,
						checker: spec.checker,
						category: spec.category,
						categoryLabel: spec.categoryLabel,
						scope: 'other',
						severity: h.severity,
						explanation: spec.explanation,
						alternative: spec.alternative?.(phrase) ?? '',
						source: spec.source ?? '',
						phrase,
						start: h.start,
						end: h.end
					};
				}),
			text
		);
}

/** Presentational copy for one post-check group (UI only; carries no check logic). */
export interface CheckGroupCopy {
	/** Matches FindingMember.checker. */
	checker: string;
	/** 'Number check' -> hidden prefixes `${label}, must fix: ` / `${label}, review: `. */
	label: string;
	/** 'Number check passed'. */
	passedTitle: string;
	/** 'Every number in this memo matches a figure from your analysis.' */
	passedNote?: string;
	/** 'Number check: 1 to fix'. */
	findingsTitle: (blockCount: number, warnCount: number) => string;
	/** false for numbers (UI-SPEC): no "Remove phrase" action. */
	allowRemovePhrase: boolean;
	/** 'Every number matches your analysis.' | '2 numbers to fix.' */
	doneSentence: (blockCount: number, warnCount: number) => string;
	/** Host-rendered (e.g. memo print link). The panel's exit reason stays Phase 5's computeGate reason. */
	gatingReason?: (blockCount: number) => string;
}

export interface FindingGroup {
	checker: string;
	label: string;
	findings: Finding[];
	blockCount: number;
	warnCount: number;
	/** null = Fair Housing. */
	copy: CheckGroupCopy | null;
}

const RANK: Record<Severity, number> = { block: 0, warn: 1 };

/** The CheckGroupCopy owning a member, or null when it belongs to the Fair Housing group. */
export function groupCopyFor(
	member: FindingMember,
	groups: readonly CheckGroupCopy[]
): CheckGroupCopy | null {
	if (member.checker === FAIR_HOUSING_CHECKER) return null;
	return groups.find((g) => g.checker === member.checker) ?? null;
}

/**
 * Fair Housing group first (members with checker 'fair-housing' AND any checker not listed in
 * groups), then one entry per groups[i] in order, always present even with 0 findings. A merged
 * Finding counts in every group owning >= 1 of its members, at that group's highest severity.
 */
export function groupFindings(
	findings: readonly Finding[],
	groups: readonly CheckGroupCopy[]
): FindingGroup[] {
	const owners: (CheckGroupCopy | null)[] = [
		null,
		...groups.filter((g) => g.checker !== FAIR_HOUSING_CHECKER)
	];
	return owners.map((copy) => {
		const own: Finding[] = [];
		let blockCount = 0;
		let warnCount = 0;
		for (const f of findings) {
			const mine = f.members.filter((m) => groupCopyFor(m, groups) === copy);
			if (mine.length === 0) continue;
			own.push(f);
			if (mine.some((m) => m.severity === 'block')) blockCount++;
			else warnCount++;
		}
		return {
			checker: copy?.checker ?? FAIR_HOUSING_CHECKER,
			label: copy?.label ?? 'Fair Housing check',
			findings: own,
			blockCount,
			warnCount,
			copy
		};
	});
}

/** The member driving a mark's hidden prefix: highest severity; ties prefer Fair Housing, then order. */
export function markMember(finding: Finding): FindingMember {
	let best = finding.members[0]!;
	for (const m of finding.members) {
		const d = RANK[m.severity] - RANK[best.severity];
		if (
			d < 0 ||
			(d === 0 && m.checker === FAIR_HOUSING_CHECKER && best.checker !== FAIR_HOUSING_CHECKER)
		) {
			best = m;
		}
	}
	return best;
}
