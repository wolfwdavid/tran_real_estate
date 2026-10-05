import { describe, expect, it } from 'vitest';
import { checkFairHousing, type Finding, type FindingMember, type Severity } from '@tran/core/fair-housing';
import {
	WARN_REASON,
	blockReason,
	computeGate,
	displayText,
	exitPayload,
	findingsSentence,
	findingsTitle,
	nextAck,
	runChecks,
	segmentText,
	usageLine,
	warnSignature,
	type ExitKind,
	type PostCheck
} from './panel-controller';

const EXITS: ExitKind[] = ['copy', 'email', 'marked-sent'];

function member(sev: Severity, start: number, end: number, phrase = 'x'.repeat(end - start)): FindingMember {
	return {
		entryId: `test.${sev}`,
		checker: 'fair-housing',
		category: 'familial-status',
		categoryLabel: 'Familial status',
		scope: 'federal',
		severity: sev,
		explanation: 'Explanation.',
		alternative: '',
		source: 'Test',
		phrase,
		start,
		end
	};
}

function fh(sev: Severity, start: number, end: number, phrase?: string): Finding {
	const m = member(sev, start, end, phrase);
	return { id: `${start}-${end}`, start, end, severity: sev, phrase: m.phrase, members: [m] };
}

function pc(sev: Severity): PostCheck {
	return (text) => [
		{
			id: '0-4',
			start: 0,
			end: 4,
			severity: sev,
			phrase: text.slice(0, 4),
			members: [
				{
					...member(sev, 0, 4, text.slice(0, 4)),
					entryId: 'claims.superlative',
					checker: 'claims',
					category: 'claims',
					categoryLabel: 'Unsupported claim',
					scope: 'other'
				}
			]
		}
	];
}

describe('computeGate', () => {
	it.each(['empty', 'streaming', 'checking'] as const)('gates every exit while %s', (phase) => {
		const g = computeGate({ phase, findings: [], warnAck: false });
		expect(g.canExit).toBe(false);
		expect(g.reason).toBeNull();
		for (const k of EXITS) expect(g.exits[k]).toEqual({ gated: true, reason: null });
	});

	it('enables every exit when ready with no findings', () => {
		const g = computeGate({ phase: 'ready', findings: [], warnAck: false });
		expect(g.canExit).toBe(true);
		expect(g.blocked).toBe(false);
		expect(g.reason).toBeNull();
		expect(g.needsAck).toBe(false);
		for (const k of EXITS) expect(g.exits[k]).toEqual({ gated: false, reason: null });
	});

	it('gates all exits on block findings with the plural reason', () => {
		const g = computeGate({ phase: 'ready', findings: [fh('block', 0, 3), fh('block', 5, 8)], warnAck: true });
		expect(g.blocked).toBe(true);
		expect(g.canExit).toBe(false);
		expect(g.blockCount).toBe(2);
		expect(g.reason).toBe('Fix the 2 phrases marked Must fix to copy or email this draft.');
		for (const k of EXITS) expect(g.exits[k]).toEqual({ gated: true, reason: g.reason });
	});

	it('uses the singular reason for one block', () => {
		const g = computeGate({ phase: 'ready', findings: [fh('block', 0, 3)], warnAck: false });
		expect(g.reason).toBe('Fix the 1 phrase marked Must fix to copy or email this draft.');
		expect(blockReason(1)).toBe(g.reason);
	});

	it('gates warn findings until acknowledged', () => {
		const findings = [fh('warn', 0, 3)];
		const g = computeGate({ phase: 'ready', findings, warnAck: false });
		expect(g.needsAck).toBe(true);
		expect(g.canExit).toBe(false);
		expect(g.reason).toBe('Review the flagged phrases and check the box above to continue.');
		expect(WARN_REASON).toBe(g.reason);
		for (const k of EXITS) expect(g.exits[k].gated).toBe(true);

		const acked = computeGate({ phase: 'ready', findings, warnAck: true });
		expect(acked.canExit).toBe(true);
		expect(acked.needsAck).toBe(false);
		expect(acked.reason).toBeNull();
		for (const k of EXITS) expect(acked.exits[k]).toEqual({ gated: false, reason: null });
	});

	it('lets the block reason win over warn and hides the acknowledgement', () => {
		const g = computeGate({ phase: 'ready', findings: [fh('block', 0, 3), fh('warn', 5, 8)], warnAck: false });
		expect(g.reason).toBe('Fix the 1 phrase marked Must fix to copy or email this draft.');
		expect(g.needsAck).toBe(false);
		expect(g.warnCount).toBe(1);
	});

	it('gates all three exits on a postCheck block like a Fair Housing block', () => {
		const findings = runChecks('Best deal in town', [pc('block')]);
		expect(findings.length).toBeGreaterThanOrEqual(1);
		expect(findings[0]!.members[0]!.checker).toBe('claims');
		const g = computeGate({ phase: 'ready', findings, warnAck: false });
		expect(g.blockCount).toBe(1);
		expect(g.blocked).toBe(true);
		for (const k of EXITS) {
			expect(g.exits[k]).toEqual({
				gated: true,
				reason: 'Fix the 1 phrase marked Must fix to copy or email this draft.'
			});
		}
	});

	it('disables a single exit with its own reason without touching the others', () => {
		const g = computeGate({
			phase: 'ready',
			findings: [],
			warnAck: false,
			exitDisabled: { email: 'This contact has no email address.' }
		});
		expect(g.exits.email).toEqual({ gated: true, reason: 'This contact has no email address.' });
		expect(g.exits.copy).toEqual({ gated: false, reason: null });
		expect(g.exits['marked-sent']).toEqual({ gated: false, reason: null });
		expect(g.canExit).toBe(true);
	});

	it('never un-gates: the block reason wins over a per-exit disable', () => {
		const g = computeGate({
			phase: 'ready',
			findings: [fh('block', 0, 3)],
			warnAck: false,
			exitDisabled: { email: 'This contact has no email address.' }
		});
		expect(g.exits.email).toEqual({
			gated: true,
			reason: 'Fix the 1 phrase marked Must fix to copy or email this draft.'
		});
	});
});

describe('runChecks', () => {
	it('equals checkFairHousing when there are no postChecks', () => {
		const text = 'Two bedrooms near the park';
		expect(runChecks(text)).toEqual(checkFairHousing(text));
		expect(runChecks(text, [])).toEqual(checkFairHousing(text));
	});

	it('does not swallow a throwing postCheck', () => {
		const bad: PostCheck = () => {
			throw new Error('consumer bug');
		};
		expect(() => runChecks('text', [bad])).toThrow('consumer bug');
	});
});

describe('warn acknowledgement', () => {
	const prev = [fh('warn', 4, 21, 'safe neighborhood')];

	it('survives edits that keep the same warn phrases', () => {
		expect(nextAck(true, prev, [fh('warn', 10, 27, 'Safe neighborhood')])).toBe(true);
	});

	it('resets when the warn phrases change', () => {
		expect(nextAck(true, prev, [fh('warn', 4, 14, 'walk to church')])).toBe(false);
	});

	it('stays false when it was never checked', () => {
		expect(nextAck(false, prev, prev)).toBe(false);
	});

	it('ignores block findings in the signature', () => {
		expect(warnSignature([...prev, fh('block', 30, 37, 'no kids')])).toBe(warnSignature(prev));
	});
});

describe('findings copy', () => {
	it.each([
		[0, 0, 'No Fair Housing problem phrases found.'],
		[2, 0, '2 Fair Housing phrases to fix.'],
		[0, 1, '1 Fair Housing phrase to review.'],
		[2, 1, '2 Fair Housing phrases to fix and 1 to review.'],
		[1, 2, '1 Fair Housing phrase to fix and 2 to review.']
	])('findingsSentence(%i, %i)', (b, w, expected) => {
		expect(findingsSentence(b, w)).toBe(expected);
	});

	it.each([
		[2, 1, 'Fair Housing check: 2 to fix, 1 to review'],
		[2, 0, 'Fair Housing check: 2 to fix'],
		[0, 3, 'Fair Housing check: 3 to review'],
		[0, 0, 'No Fair Housing problem phrases found']
	])('findingsTitle(%i, %i)', (b, w, expected) => {
		expect(findingsTitle(b, w)).toBe(expected);
	});
});

describe('usageLine', () => {
	const usage = { inputTokens: 1234, outputTokens: 567 };

	it('reports no cost for sample output', () => {
		expect(usageLine({ providerLabel: 'Anthropic', status: 'done', sample: true })).toBe(
			'Sample output: no tokens used, no cost.'
		);
	});

	it('formats tokens and cost', () => {
		expect(
			usageLine({ providerLabel: 'Anthropic', usage, costUsd: 0.0123, status: 'done', sample: false })
		).toBe('1,234 tokens in · 567 tokens out · about $0.01 on your Anthropic account (estimate)');
	});

	it('says less than $0.01 below one cent', () => {
		expect(
			usageLine({ providerLabel: 'Anthropic', usage, costUsd: 0.004, status: 'done', sample: false })
		).toBe('1,234 tokens in · 567 tokens out · about less than $0.01 on your Anthropic account (estimate)');
	});

	it('never fabricates a cost when pricing is unknown', () => {
		expect(usageLine({ providerLabel: 'OpenRouter', usage, status: 'done', sample: false })).toBe(
			'1,234 tokens in · 567 tokens out'
		);
	});

	it('explains a stopped draft without usage', () => {
		expect(usageLine({ providerLabel: 'OpenAI', status: 'stopped', sample: false })).toBe(
			"OpenAI didn't report usage for this stopped draft."
		);
	});
});

describe('payloads', () => {
	it('restores tokens locally', () => {
		expect(displayText('Hi {client_first_name}', { client_first_name: 'Dana' })).toBe('Hi Dana');
		expect(displayText('Hi {client_first_name}')).toBe('Hi {client_first_name}');
		expect(displayText('Hi {client_first_name}', {})).toBe('Hi {client_first_name}');
	});

	it('appends the optional email footer', () => {
		expect(exitPayload('Body', undefined)).toBe('Body');
		expect(exitPayload('Body', { text: 'Unsubscribe: reply STOP', label: 'Footer' })).toBe(
			'Body\n\nUnsubscribe: reply STOP'
		);
		expect(exitPayload('Body', { text: '', label: 'Footer' })).toBe('Body');
	});
});

describe('segmentText', () => {
	const join = (segs: ReturnType<typeof segmentText>, text: string): string =>
		segs.map((s) => (s.kind === 'text' ? s.value : text.slice(s.finding.start, s.finding.end))).join('');

	it('splits around findings and reproduces the input', () => {
		const text = 'a no kids b';
		const f = fh('block', 2, 9, 'no kids');
		const segs = segmentText(text, [f]);
		expect(segs).toEqual([
			{ kind: 'text', value: 'a ' },
			{ kind: 'finding', finding: f },
			{ kind: 'text', value: ' b' }
		]);
		expect(join(segs, text)).toBe(text);
	});

	it('returns one text segment with no findings', () => {
		expect(segmentText('hello', [])).toEqual([{ kind: 'text', value: 'hello' }]);
	});

	it('produces no empty text segments at the edges', () => {
		const text = 'no kids and adults only';
		const a = fh('block', 0, 7, 'no kids');
		const b = fh('block', 12, 23, 'adults only');
		const segs = segmentText(text, [b, a]);
		expect(segs).toEqual([
			{ kind: 'finding', finding: a },
			{ kind: 'text', value: ' and ' },
			{ kind: 'finding', finding: b }
		]);
		expect(segs.every((s) => s.kind !== 'text' || s.value !== '')).toBe(true);
		expect(join(segs, text)).toBe(text);
	});
});
