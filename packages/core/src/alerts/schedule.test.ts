import { describe, expect, test } from 'vitest';

import {
	CLAIM_TTL_MS,
	CONFIRM_ABOVE,
	DUE_AFTER_MS,
	dueSearches,
	isDue,
	planRun,
	type DueCandidate
} from './schedule.js';

const NOW = 1_760_000_000_000;
const HOUR = 3_600_000;

const cand = (
	id: string,
	lastRunAt: number | null,
	extra: Partial<DueCandidate> = {}
): DueCandidate => ({
	id,
	lastRunAt,
	claimedAt: null,
	requestKey: `key-${id}`,
	cached: false,
	...extra
});

/** Five due searches with distinct uncached keys, already oldest-first (s1 oldest). */
const five = () => [1, 2, 3, 4, 5].map((n) => cand(`s${n}`, NOW - (30 + 6 - n) * HOUR));

describe('constants', () => {
	test('match the scheduler contract', () => {
		expect(DUE_AFTER_MS).toBe(86_400_000);
		expect(CLAIM_TTL_MS).toBe(120_000);
		expect(CONFIRM_ABOVE).toBe(3);
	});
});

describe('isDue', () => {
	test('a search that never ran is due', () => {
		expect(isDue({ lastRunAt: null, claimedAt: null }, NOW)).toBe(true);
	});

	test('ran 23h ago is not due', () => {
		expect(isDue({ lastRunAt: NOW - 23 * HOUR, claimedAt: null }, NOW)).toBe(false);
	});

	test('ran exactly 24h ago is due', () => {
		expect(isDue({ lastRunAt: NOW - 24 * HOUR, claimedAt: null }, NOW)).toBe(true);
	});

	test('claimed by another tab 60s ago is not due', () => {
		expect(isDue({ lastRunAt: null, claimedAt: NOW - 60_000 }, NOW)).toBe(false);
	});

	test('a claim exactly 2 minutes old has expired', () => {
		expect(isDue({ lastRunAt: null, claimedAt: NOW - 120_000 }, NOW)).toBe(true);
	});
});

describe('dueSearches', () => {
	test('keeps only due searches, never-run first, then oldest, ties by id', () => {
		const list = [
			cand('fresh', NOW - HOUR),
			cand('b-old', NOW - 48 * HOUR),
			cand('never-z', null),
			cand('a-old', NOW - 48 * HOUR),
			cand('older', NOW - 72 * HOUR),
			cand('never-a', null),
			cand('claimed', null, { claimedAt: NOW - 1_000 })
		];
		expect(dueSearches(list, NOW).map((s) => s.id)).toEqual([
			'never-a',
			'never-z',
			'older',
			'a-old',
			'b-old'
		]);
	});

	test('does not mutate its input', () => {
		const list = [cand('b', NOW - 48 * HOUR), cand('a', null)];
		dueSearches(list, NOW);
		expect(list.map((s) => s.id)).toEqual(['b', 'a']);
	});
});

describe('planRun', () => {
	test('5 due uncached searches with room: all run and the user is asked to confirm', () => {
		const due = five();
		const p = planRun(due, { used: 0, cap: 40, mode: 'live' });
		expect(p.run).toEqual(due);
		expect(p.wait).toEqual([]);
		expect(p.calls).toBe(5);
		expect(p.needsConfirm).toBe(true);
		expect(p.blockedByCap).toBe(false);
	});

	test('exactly 3 due searches do not need confirmation', () => {
		const p = planRun(five().slice(0, 3), { used: 0, cap: 40, mode: 'live' });
		expect(p.run).toHaveLength(3);
		expect(p.needsConfirm).toBe(false);
	});

	test('used: 38 of 40 runs the 2 oldest and leaves 3 waiting', () => {
		const due = five();
		const p = planRun(due, { used: 38, cap: 40, mode: 'live' });
		expect(p.run.map((s) => s.id)).toEqual(['s1', 's2']);
		expect(p.wait.map((s) => s.id)).toEqual(['s3', 's4', 's5']);
		expect(p.calls).toBe(2);
		expect(p.needsConfirm).toBe(true);
		expect(p.blockedByCap).toBe(false);
	});

	test('at the cap nothing runs and the plan is blocked', () => {
		const p = planRun(five(), { used: 40, cap: 40, mode: 'live' });
		expect(p.run).toEqual([]);
		expect(p.wait).toHaveLength(5);
		expect(p.calls).toBe(0);
		expect(p.needsConfirm).toBe(false);
		expect(p.blockedByCap).toBe(true);
	});

	test('two searches sharing one request key cost one call', () => {
		const due = [cand('a', null, { requestKey: 'k' }), cand('b', null, { requestKey: 'k' })];
		const p = planRun(due, { used: 0, cap: 40, mode: 'live' });
		expect(p.calls).toBe(1);
		expect(p.run.map((s) => s.id)).toEqual(['a', 'b']);
	});

	test('a shared key admitted once still fits when only one call is left', () => {
		const due = [
			cand('a', null, { requestKey: 'k' }),
			cand('b', null, { requestKey: 'k' }),
			cand('c', null)
		];
		const p = planRun(due, { used: 39, cap: 40, mode: 'live' });
		expect(p.run.map((s) => s.id)).toEqual(['a', 'b']);
		expect(p.wait.map((s) => s.id)).toEqual(['c']);
		expect(p.calls).toBe(1);
	});

	test('a cached search costs 0 and runs even at the cap', () => {
		const due = [cand('a', null), cand('b', null, { cached: true })];
		const p = planRun(due, { used: 40, cap: 40, mode: 'live' });
		expect(p.run.map((s) => s.id)).toEqual(['b']);
		expect(p.wait.map((s) => s.id)).toEqual(['a']);
		expect(p.calls).toBe(0);
		expect(p.blockedByCap).toBe(true);
	});

	test('never schedules more calls than cap − used', () => {
		for (let used = 0; used <= 42; used++) {
			const due = Array.from({ length: 12 }, (_, i) => cand(`s${i}`, null));
			const p = planRun(due, { used, cap: 40, mode: 'live' });
			expect(p.calls).toBeLessThanOrEqual(Math.max(40 - used, 0));
			expect(p.run.length + p.wait.length).toBe(12);
		}
	});

	test("mode: 'sample' runs everything on fixtures for 0 calls with no dialog", () => {
		const due = five();
		const p = planRun(due, { used: 40, cap: 40, mode: 'sample' });
		expect(p.run).toEqual(due);
		expect(p.wait).toEqual([]);
		expect(p.calls).toBe(0);
		expect(p.needsConfirm).toBe(false);
		expect(p.blockedByCap).toBe(false);
	});
});
