import { describe, expect, it } from 'vitest';
import type { Finding, FindingMember, Severity } from '@tran/core/fair-housing';
import { computeGate, nextAck, runChecks } from './panel-controller';
import {
	FAIR_HOUSING_CHECKER,
	createPostCheck,
	groupFindings,
	markMember,
	type CheckGroupCopy,
	type PostCheck,
	type PostCheckSpec
} from './post-check';

const EXITS = ['copy', 'email', 'marked-sent'] as const;

/** Flags every percentage as a number not in the analysis, at the given severity. */
function numbersSpec(severity: Severity = 'block'): PostCheckSpec {
	return {
		checker: 'numbers',
		entryId: 'numbers.not-in-analysis',
		category: 'number-not-in-analysis',
		categoryLabel: 'Number not in your analysis',
		explanation: 'This number does not match any figure from your analysis.',
		detect: (text) =>
			[...text.matchAll(/\d+%/g)].map((m) => ({
				start: m.index,
				end: m.index + m[0].length,
				severity
			}))
	};
}

const numbersStub: PostCheck = createPostCheck(numbersSpec());

const numbersCopy: CheckGroupCopy = {
	checker: 'numbers',
	label: 'Number check',
	passedTitle: 'Number check passed',
	passedNote: 'Every number in this memo matches a figure from your analysis.',
	findingsTitle: (b) => `Number check: ${b} to fix`,
	allowRemovePhrase: false,
	doneSentence: (b) =>
		b === 0 ? 'Every number matches your analysis.' : `${b} number${b === 1 ? '' : 's'} to fix.`
};

function member(checker: string, severity: Severity, start: number, end: number): FindingMember {
	return {
		entryId: `${checker}.test`,
		checker,
		category: 'c',
		categoryLabel: 'C',
		scope: checker === FAIR_HOUSING_CHECKER ? 'federal' : 'other',
		severity,
		explanation: 'e',
		alternative: '',
		source: '',
		phrase: 'x'.repeat(end - start),
		start,
		end
	};
}

function finding(...members: FindingMember[]): Finding {
	const start = Math.min(...members.map((m) => m.start));
	const end = Math.max(...members.map((m) => m.end));
	return {
		id: `${start}-${end}`,
		start,
		end,
		severity: members.some((m) => m.severity === 'block') ? 'block' : 'warn',
		phrase: 'x'.repeat(end - start),
		members
	};
}

describe('createPostCheck', () => {
	it("returns Phase 5's bare (text) => Finding[] function", () => {
		expect(typeof numbersStub).toBe('function');
		expect(numbersStub.length).toBe(1);
	});

	it('bakes every spec label into each member', () => {
		const out = numbersStub('Cash flow is 20%');
		expect(out).toHaveLength(1);
		expect(out[0]!.members[0]).toEqual({
			entryId: 'numbers.not-in-analysis',
			checker: 'numbers',
			category: 'number-not-in-analysis',
			categoryLabel: 'Number not in your analysis',
			scope: 'other',
			severity: 'block',
			explanation: 'This number does not match any figure from your analysis.',
			alternative: '',
			source: '',
			phrase: '20%',
			start: 13,
			end: 16
		});
		expect(out[0]).toMatchObject({ id: '13-16', severity: 'block', phrase: '20%' });
	});

	it('uses source and alternative when given, and drops empty ranges', () => {
		const pc = createPostCheck({
			...numbersSpec(),
			source: 'Your analysis',
			alternative: (p) => `[${p}]`,
			detect: () => [
				{ start: 0, end: 4, severity: 'warn' },
				{ start: 6, end: 6, severity: 'block' }
			]
		});
		const out = pc('Rent is high');
		expect(out).toHaveLength(1);
		expect(out[0]!.members[0]).toMatchObject({
			source: 'Your analysis',
			alternative: '[Rent]',
			severity: 'warn'
		});
	});
});

describe("gating through Phase 5's unchanged controller", () => {
	it('a post-check block gates all three exits', () => {
		const findings = runChecks('Cash flow is 20%', [numbersStub]);
		expect(findings).toHaveLength(1);
		const gate = computeGate({ phase: 'ready', findings, warnAck: false });
		expect(gate.blocked).toBe(true);
		expect(gate.canExit).toBe(false);
		expect(gate.blockCount).toBe(1);
		for (const k of EXITS) expect(gate.exits[k].gated).toBe(true);
	});

	it('Fair Housing and post-check findings add up; no post-checks = Phase 5 result', () => {
		const text = 'No kids. Cash flow is 20%.';
		const both = computeGate({
			phase: 'ready',
			findings: runChecks(text, [numbersStub]),
			warnAck: false
		});
		expect(both.blockCount).toBe(2);
		const fhOnly = runChecks(text, []);
		expect(fhOnly).toEqual(runChecks(text));
		expect(computeGate({ phase: 'ready', findings: fhOnly, warnAck: false }).blockCount).toBe(1);
	});

	it('a warn post-check needs the acknowledgement; ack resets when the phrase set changes', () => {
		const warn = createPostCheck(numbersSpec('warn'));
		const a = runChecks('Cash flow is 20%', [warn]);
		expect(computeGate({ phase: 'ready', findings: a, warnAck: false }).canExit).toBe(false);
		expect(computeGate({ phase: 'ready', findings: a, warnAck: true }).canExit).toBe(true);
		const b = runChecks('Cash flow is 25%', [warn]);
		expect(nextAck(true, a, b)).toBe(false);
		expect(nextAck(true, a, runChecks('Cash flow: 20%', [warn]))).toBe(true);
	});
});

describe('groupFindings', () => {
	it('Fair Housing group first, then each group in order, counted by ownership', () => {
		const findings = runChecks('No kids. Cash flow is 20%.', [numbersStub]);
		const groups = groupFindings(findings, [numbersCopy]);
		expect(groups.map((g) => g.checker)).toEqual(['fair-housing', 'numbers']);
		expect(groups[0]).toMatchObject({ blockCount: 1, warnCount: 0, copy: null });
		expect(groups[0]!.findings).toHaveLength(1);
		expect(groups[1]).toMatchObject({ blockCount: 1, warnCount: 0, label: 'Number check' });
		expect(groups[1]!.copy).toBe(numbersCopy);
		expect(groups[1]!.findings[0]!.phrase).toBe('20%');
	});

	it('a merged finding counts in each owning group at that group’s own severity', () => {
		const merged = finding(member('fair-housing', 'warn', 0, 5), member('numbers', 'block', 2, 5));
		const [fh, nums] = groupFindings([merged], [numbersCopy]);
		expect(fh).toMatchObject({ blockCount: 0, warnCount: 1 });
		expect(nums).toMatchObject({ blockCount: 1, warnCount: 0 });
	});

	it('every group is present even with no findings', () => {
		const groups = groupFindings([], [numbersCopy]);
		expect(groups).toHaveLength(2);
		expect(groups[1]).toMatchObject({ checker: 'numbers', blockCount: 0, warnCount: 0 });
		expect(groups[1]!.findings).toEqual([]);
	});

	it('with no groups every finding (any checker) lands in the Fair Housing group', () => {
		const f = [
			finding(member('claims', 'block', 0, 3)),
			finding(member('numbers', 'warn', 5, 8)),
			finding(member('fair-housing', 'block', 10, 12))
		];
		const groups = groupFindings(f, []);
		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({
			checker: 'fair-housing',
			blockCount: 2,
			warnCount: 1,
			copy: null
		});
		expect(groups[0]!.findings).toHaveLength(3);
	});

	it('an unlisted checker stays with Fair Housing while listed ones split out', () => {
		const f = [finding(member('claims', 'block', 0, 3)), finding(member('numbers', 'warn', 5, 8))];
		const [fh, nums] = groupFindings(f, [numbersCopy]);
		expect(fh).toMatchObject({ blockCount: 1, warnCount: 0 });
		expect(nums).toMatchObject({ blockCount: 0, warnCount: 1 });
	});
});

describe('markMember', () => {
	it('picks the highest-severity member', () => {
		const m = finding(member('fair-housing', 'warn', 0, 5), member('numbers', 'block', 2, 5));
		expect(markMember(m).checker).toBe('numbers');
	});

	it('on a severity tie prefers Fair Housing', () => {
		const m = finding(member('numbers', 'block', 0, 5), member('fair-housing', 'block', 0, 5));
		expect(markMember(m).checker).toBe('fair-housing');
	});

	it('otherwise keeps members order', () => {
		const a = member('numbers', 'warn', 0, 5);
		const b = { ...member('claims', 'warn', 0, 5) };
		expect(markMember(finding(a, b))).toBe(a);
	});
});
