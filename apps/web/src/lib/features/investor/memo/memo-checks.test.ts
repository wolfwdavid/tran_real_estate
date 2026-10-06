import { describe, expect, it } from 'vitest';
import { REFERENCE_CASES, analyze, buildMemoFacts } from '@tran/core/finance';
import { checkFairHousing } from '@tran/core/fair-housing';
import { WARN_REASON, blockReason, computeGate, runChecks } from '$lib/ai/ui/panel-controller';
import { createMemoPostChecks, MEMO_CHECK_GROUPS, memoGateReasons } from './memo-checks';

const A = REFERENCE_CASES.find((c) => c.id === 'A')!;
const facts = buildMemoFacts({
	dealName: 'Case A',
	address: '5090 Gildenreach Blvd, Harlow Springs, OK 74201',
	inputs: A.inputs,
	analysis: analyze(A.inputs)
});
const allowed = facts.allowed;
const [numbers, advice] = createMemoPostChecks(allowed);

const NUMBER_EXPLANATION =
	"This number doesn't match any figure in your analysis. Memos may only use numbers the analyzer calculated or that you entered. Change it to a figure from your results, or remove the sentence.";

describe('createMemoPostChecks', () => {
	it('returns two Phase 5 bare PostCheck functions: numbers then advice', () => {
		const checks = createMemoPostChecks(allowed);
		expect(checks).toHaveLength(2);
		for (const c of checks) expect(typeof c).toBe('function');
	});

	it('numbers: flags a figure not in the analysis as Must fix, with no suggested fix', () => {
		const text = 'Cash flow is $184 and growth is 20%.';
		const f = numbers!(text);
		expect(f).toHaveLength(1);
		expect(f[0]!.severity).toBe('block');
		expect(text.slice(f[0]!.start, f[0]!.end)).toBe('20%');
		const m = f[0]!.members[0]!;
		expect(m.checker).toBe('numbers');
		expect(m.categoryLabel).toBe('Number not in your analysis');
		expect(m.explanation).toBe(NUMBER_EXPLANATION);
		expect(m.alternative).toBe('');
		expect(m.source).toBe('');
	});

	it('numbers: a spelled-out quantity is a warn finding; figures from FACTS pass', () => {
		const f = numbers!('Growth of twelve percent.');
		expect(f).toHaveLength(1);
		expect(f[0]!.severity).toBe('warn');
		expect(numbers!('Monthly cash flow is $184 on a $200,000 price.')).toEqual([]);
	});

	it('numbers: notes figures are allowed when the allowed set includes them', () => {
		const withNotes = buildMemoFacts({
			dealName: 'Case A',
			address: 'x',
			inputs: A.inputs,
			analysis: analyze(A.inputs),
			notes: 'The roof is 17 years old.'
		});
		const [n] = createMemoPostChecks(withNotes.allowed);
		expect(n!('The roof is 17 years old.')).toEqual([]);
		expect(numbers!('The roof is 17 years old.')).toHaveLength(1);
	});

	it('advice: a promise is Must fix, a judgement is Review', () => {
		const block = advice!('Guaranteed cash flow.');
		expect(block).toHaveLength(1);
		expect(block[0]!.severity).toBe('block');
		expect(block[0]!.members[0]!.checker).toBe('advice');
		expect(block[0]!.members[0]!.categoryLabel).toBe('Reads as advice or a promise');
		const warn = advice!('This is a great investment.');
		expect(warn).toHaveLength(1);
		expect(warn[0]!.severity).toBe('warn');
	});

	it('plugs into Phase 5 runChecks/computeGate: numbers + Fair Housing gate every exit', () => {
		const text =
			'Monthly cash flow is $184. Expect 20% growth next year. It is perfect for young professionals.';
		const findings = runChecks(text, createMemoPostChecks(allowed));
		const checkers = findings.flatMap((f) => f.members.map((m) => m.checker));
		expect(checkers).toContain('numbers');
		expect(checkers).toContain('fair-housing');
		expect(findings.filter((f) => f.severity === 'block').length).toBeGreaterThanOrEqual(2);
		const gate = computeGate({ phase: 'ready', findings, warnAck: false });
		expect(gate.blocked).toBe(true);
		expect(gate.canExit).toBe(false);
		for (const k of ['copy', 'email', 'marked-sent'] as const) {
			expect(gate.exits[k].gated).toBe(true);
		}
	});
});

describe('MEMO_CHECK_GROUPS', () => {
	it('numbers then advice, with the UI-SPEC copy', () => {
		expect(MEMO_CHECK_GROUPS.map((g) => g.checker)).toEqual(['numbers', 'advice']);
		const [n, a] = MEMO_CHECK_GROUPS;
		expect(n!.label).toBe('Number check');
		expect(n!.passedTitle).toBe('Number check passed');
		expect(n!.passedNote).toBe('Every number in this memo matches a figure from your analysis.');
		expect(n!.findingsTitle(1, 0)).toBe('Number check: 1 to fix');
		expect(n!.findingsTitle(3, 0)).toBe('Number check: 3 to fix');
		expect(n!.allowRemovePhrase).toBe(false);
		expect(n!.gatingReason!(1)).toBe(
			'Fix the 1 number marked Must fix to copy, email, or print this memo.'
		);
		expect(n!.gatingReason!(2)).toBe(
			'Fix the 2 numbers marked Must fix to copy, email, or print this memo.'
		);
		expect(n!.doneSentence(0, 0)).toBe('Every number matches your analysis.');
		expect(n!.doneSentence(1, 0)).toBe('1 number to fix.');
		expect(n!.doneSentence(2, 0)).toBe('2 numbers to fix.');

		expect(a!.label).toBe('Advice language');
		expect(a!.allowRemovePhrase).toBe(true);
		expect(a!.passedTitle).toBe('Advice language check passed');
		expect(a!.passedNote).toBe('No promises or buy-or-sell advice found.');
		expect(a!.findingsTitle(1, 0)).toBe('Advice language: 1 to fix');
		expect(a!.findingsTitle(0, 2)).toBe('Advice language: 2 to fix');
	});
});

describe('memoGateReasons', () => {
	const checks = createMemoPostChecks(allowed);
	const gateFor = (text: string, warnAck = false) => {
		const findings = runChecks(text, checks);
		const g = computeGate({ phase: 'ready', findings, warnAck });
		return { findings, blocked: g.blocked, canExit: g.canExit };
	};

	it('numbers block only', () => {
		const g = gateFor('Monthly cash flow is $184. Expect 20% growth.');
		expect(memoGateReasons(g.findings, g.blocked, g.canExit)).toEqual([
			'Fix the 1 number marked Must fix to copy, email, or print this memo.'
		]);
	});

	it('Fair Housing block + numbers block', () => {
		const text = 'Expect 20% growth. It is perfect for young professionals.';
		const g = gateFor(text);
		const fhBlocks = checkFairHousing(text).filter((f) => f.severity === 'block').length;
		expect(fhBlocks).toBeGreaterThan(0);
		expect(memoGateReasons(g.findings, g.blocked, g.canExit)).toEqual([
			blockReason(fhBlocks),
			'Fix the 1 number marked Must fix to copy, email, or print this memo.'
		]);
	});

	it('warn only, not acknowledged -> the Phase 5 warn reason; acknowledged -> none', () => {
		const g = gateFor('This is a great investment.');
		expect(g.blocked).toBe(false);
		expect(memoGateReasons(g.findings, g.blocked, g.canExit)).toEqual([WARN_REASON]);
		const ack = gateFor('This is a great investment.', true);
		expect(ack.canExit).toBe(true);
		expect(memoGateReasons(ack.findings, ack.blocked, ack.canExit)).toEqual([]);
	});

	it('clean text or no draft -> no reasons', () => {
		const g = gateFor('Monthly cash flow is $184.');
		expect(memoGateReasons(g.findings, g.blocked, g.canExit)).toEqual([]);
		expect(memoGateReasons([], false, false)).toEqual([]);
	});
});
