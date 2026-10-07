// Pure decision logic behind GenerationPanel: exit gating, warn acknowledgement, findings and
// usage copy, exit payloads and highlight segments. No DOM, no I/O, so every rule is unit-tested
// before any markup exists. Strings match 05-UI-SPEC.md verbatim.

import { formatUsd, type LlmUsage } from '@tran/core/ai';
import { checkFairHousing, mergeFindings, type Finding } from '@tran/core/fair-housing';
import { restorePii } from '@tran/core/privacy';

export type ExitKind = 'copy' | 'email' | 'marked-sent';
/** Consumer validator (Phase 7). Runs after the Fair Housing check; its findings gate exits too. */
export type PostCheck = (text: string) => Finding[];
/** Per-exit disable; the value is the visible reason (Phase 8: "This contact has no email address."). */
export type ExitDisabled = Partial<Record<ExitKind, string>>;
export type PanelPhase = 'empty' | 'streaming' | 'checking' | 'ready';
export type ExitGate = { gated: boolean; reason: string | null };
export type GateState = {
	/** ready && 0 block && (0 warn || acknowledged); ignores per-exit disables. */
	canExit: boolean;
	blocked: boolean;
	blockCount: number;
	warnCount: number;
	/** 0 block && >= 1 warn && !acknowledged (the checkbox is hidden while any block remains). */
	needsAck: boolean;
	/** Global gating reason (block or warn), null otherwise. */
	reason: string | null;
	exits: Record<ExitKind, ExitGate>;
};

const EXIT_KINDS: readonly ExitKind[] = ['copy', 'email', 'marked-sent'];

export const WARN_REASON = 'Review the flagged phrases and check the box above to continue.';

export function blockReason(n: number): string {
	return n === 1
		? 'Fix the 1 phrase marked Must fix to copy or email this draft.'
		: `Fix the ${n} phrases marked Must fix to copy or email this draft.`;
}

/**
 * Fair Housing first, then each consumer postCheck, merged into one non-overlapping finding list.
 * A throwing postCheck is a consumer bug and is deliberately not caught.
 */
export function runChecks(text: string, postChecks: readonly PostCheck[] = []): Finding[] {
	const members = [
		...checkFairHousing(text).flatMap((f) => f.members),
		...postChecks.flatMap((check) => check(text).flatMap((f) => f.members))
	];
	return mergeFindings(members, text);
}

export function computeGate(i: {
	phase: PanelPhase;
	findings: readonly Finding[];
	warnAck: boolean;
	exitDisabled?: ExitDisabled;
}): GateState {
	const blockCount = i.findings.filter((f) => f.severity === 'block').length;
	const warnCount = i.findings.filter((f) => f.severity === 'warn').length;
	const ready = i.phase === 'ready';
	const warnGated = warnCount > 0 && !i.warnAck;
	const globalGated = !ready || blockCount > 0 || warnGated;
	const reason = !ready
		? null
		: blockCount > 0
			? blockReason(blockCount)
			: warnGated
				? WARN_REASON
				: null;

	const exits = {} as Record<ExitKind, ExitGate>;
	for (const k of EXIT_KINDS) {
		const own = i.exitDisabled?.[k];
		exits[k] = globalGated
			? { gated: true, reason }
			: own
				? { gated: true, reason: own }
				: { gated: false, reason: null };
	}

	return {
		canExit: !globalGated,
		blocked: blockCount > 0,
		blockCount,
		warnCount,
		needsAck: ready && blockCount === 0 && warnGated,
		reason,
		exits
	};
}

/** Sorted, de-duplicated, case-folded warn phrases: offsets do not matter. */
export function warnSignature(findings: readonly Finding[]): string {
	const phrases = new Set(
		findings.filter((f) => f.severity === 'warn').map((f) => f.phrase.toLocaleLowerCase('en-US'))
	);
	return [...phrases].sort().join('\u0000');
}

/** The acknowledgement survives an edit only while the set of warn phrases is unchanged. */
export function nextAck(
	prevAck: boolean,
	prev: readonly Finding[],
	next: readonly Finding[]
): boolean {
	return prevAck && warnSignature(prev) === warnSignature(next);
}

const phrases = (n: number): string => (n === 1 ? 'phrase' : 'phrases');

export function findingsSentence(blockCount: number, warnCount: number): string {
	if (blockCount === 0 && warnCount === 0) return 'No Fair Housing problem phrases found.';
	if (blockCount > 0 && warnCount > 0) {
		return `${blockCount} Fair Housing ${phrases(blockCount)} to fix and ${warnCount} to review.`;
	}
	if (blockCount > 0) return `${blockCount} Fair Housing ${phrases(blockCount)} to fix.`;
	return `${warnCount} Fair Housing ${phrases(warnCount)} to review.`;
}

export function findingsTitle(blockCount: number, warnCount: number): string {
	if (blockCount === 0 && warnCount === 0) return 'No Fair Housing problem phrases found';
	const parts: string[] = [];
	if (blockCount > 0) parts.push(`${blockCount} to fix`);
	if (warnCount > 0) parts.push(`${warnCount} to review`);
	return `Fair Housing check: ${parts.join(', ')}`;
}

const INT = new Intl.NumberFormat('en-US');

export function usageLine(o: {
	providerLabel: string;
	usage?: LlmUsage;
	costUsd?: number;
	status: 'done' | 'stopped' | 'error';
	sample: boolean;
}): string {
	if (o.sample) return 'Sample output: no tokens used, no cost.';
	const inTok = o.usage?.inputTokens;
	const outTok = o.usage?.outputTokens;
	if (inTok === undefined && outTok === undefined) {
		// UI-SPEC only defines copy for a stopped draft; otherwise the line is omitted.
		return o.status === 'stopped'
			? `${o.providerLabel} didn't report usage for this stopped draft.`
			: '';
	}
	const tokens = `${INT.format(inTok ?? 0)} tokens in · ${INT.format(outTok ?? 0)} tokens out`;
	// Unknown pricing: never fabricate a cost.
	if (o.costUsd === undefined || !Number.isFinite(o.costUsd)) return tokens;
	return `${tokens} · about ${formatUsd(o.costUsd)} on your ${o.providerLabel} account (estimate)`;
}

/** Restores role tokens to real values locally (Phase 8 `tokens` prop). */
export function displayText(raw: string, tokens?: Readonly<Record<string, string>>): string {
	return tokens && Object.keys(tokens).length > 0 ? restorePii(raw, tokens) : raw;
}

/** Shapes the exit payload from the draft and the footer text (Phase 9 studio tools). */
export type FormatForExit = (draft: string, footerText: string) => string;

/**
 * Text handed to an exit: the draft plus an optional email footer (Phase 8 `emailFooter`).
 * With `formatForExit` (Phase 9), the formatter alone shapes the payload from the draft and
 * `emailFooter?.text ?? ''`; without it the Phase 5/8 behavior is unchanged.
 */
export function exitPayload(
	text: string,
	emailFooter?: { text: string; label: string },
	formatForExit?: FormatForExit
): string {
	if (formatForExit) return formatForExit(text, emailFooter?.text ?? '');
	return emailFooter?.text ? `${text}\n\n${emailFooter.text}` : text;
}

export type Segment = { kind: 'text'; value: string } | { kind: 'finding'; finding: Finding };

/** Splits text around findings (non-overlapping after mergeFindings) for <mark> rendering. */
export function segmentText(text: string, findings: readonly Finding[]): Segment[] {
	const sorted = [...findings].sort((a, b) => a.start - b.start);
	const out: Segment[] = [];
	let cursor = 0;
	for (const finding of sorted) {
		if (finding.start < cursor) continue;
		if (finding.start > cursor)
			out.push({ kind: 'text', value: text.slice(cursor, finding.start) });
		out.push({ kind: 'finding', finding });
		cursor = finding.end;
	}
	if (cursor < text.length || out.length === 0) {
		out.push({ kind: 'text', value: text.slice(cursor) });
	}
	return out;
}
