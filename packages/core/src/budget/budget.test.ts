import { describe, expect, test } from 'vitest';

import {
	PENDING_STALE_MS,
	daysInPeriod,
	formatCount,
	formatMonthDay,
	formatUsd,
	isBilled,
	periodKey,
	projectedBurn,
	resetsAt,
	summarize,
	type LedgerEntryLike
} from './index.js';

describe('billing period (UTC calendar month)', () => {
	test('periodKey splits exactly at the UTC month boundary', () => {
		expect(periodKey(Date.parse('2026-10-31T23:59:59.999Z'))).toBe('2026-10');
		expect(periodKey(Date.parse('2026-11-01T00:00:00.000Z'))).toBe('2026-11');
		const lastMsOfYear = Date.parse('2026-12-31T23:59:59.999Z');
		expect(periodKey(lastMsOfYear)).toBe('2026-12');
		expect(periodKey(lastMsOfYear + 1)).toBe('2027-01');
	});

	test('periodKey zero-pads single-digit months', () => {
		expect(periodKey(Date.parse('2027-03-04T05:06:07Z'))).toBe('2027-03');
	});

	test('periodKey rejects renewal days other than 1 in v1', () => {
		expect(() => periodKey(Date.parse('2026-10-15T00:00:00Z'), 15)).toThrow(RangeError);
		expect(() => resetsAt(Date.parse('2026-10-15T00:00:00Z'), 15)).toThrow(RangeError);
	});

	test('resetsAt is the 1st of the next UTC month, December rolls over the year', () => {
		expect(resetsAt(Date.parse('2026-10-15T12:00:00Z'))).toBe(
			Date.parse('2026-11-01T00:00:00.000Z')
		);
		expect(resetsAt(Date.parse('2026-12-31T23:59:59.999Z'))).toBe(
			Date.parse('2027-01-01T00:00:00.000Z')
		);
		expect(resetsAt(Date.parse('2026-11-01T00:00:00.000Z'))).toBe(
			Date.parse('2026-12-01T00:00:00.000Z')
		);
	});

	test('daysInPeriod handles leap and non-leap February', () => {
		expect(daysInPeriod(Date.parse('2028-02-10T00:00:00Z'))).toBe(29);
		expect(daysInPeriod(Date.parse('2027-02-10T00:00:00Z'))).toBe(28);
		expect(daysInPeriod(Date.parse('2026-10-31T23:59:59.999Z'))).toBe(31);
	});
});

describe('billing policy', () => {
	test('only HTTP 200 is billed', () => {
		expect(isBilled(200)).toBe(true);
		for (const status of [0, 400, 401, 403, 404, 429, 500, 504]) {
			expect(isBilled(status), `status ${status}`).toBe(false);
		}
	});
});

describe('summarize', () => {
	test('derives billed / noResults / failed / pending and countedTowardCap', () => {
		const now = Date.parse('2026-10-15T12:00:00Z');
		const entries: LedgerEntryLike[] = [
			{ at: now - 5000, status: 200 },
			{ at: now - 4000, status: 200 },
			{ at: now - 3000, status: 200 },
			{ at: now - 2000, status: 404 },
			{ at: now - 2000, status: 400 },
			{ at: now - 2000, status: 401 },
			{ at: now - 2000, status: 0 },
			{ at: now - 1000, status: 'pending' },
			{ at: now - 120_000, status: 'pending' }
		];
		expect(summarize(entries, now)).toEqual({
			billed: 4,
			noResults: 2,
			failed: 2,
			pending: 1,
			countedTowardCap: 5
		});
	});

	test('a pending row becomes conservatively billed exactly at PENDING_STALE_MS', () => {
		const now = 1_000_000;
		expect(PENDING_STALE_MS).toBe(120_000);
		expect(summarize([{ at: now - PENDING_STALE_MS + 1, status: 'pending' }], now)).toMatchObject({
			billed: 0,
			pending: 1,
			countedTowardCap: 1
		});
		expect(summarize([{ at: now - PENDING_STALE_MS, status: 'pending' }], now)).toMatchObject({
			billed: 1,
			pending: 0,
			countedTowardCap: 1
		});
	});

	test('an empty ledger summarizes to zeros', () => {
		expect(summarize([], 0)).toEqual({
			billed: 0,
			noResults: 0,
			failed: 0,
			pending: 0,
			countedTowardCap: 0
		});
	});
});

describe('projectedBurn', () => {
	test('extrapolates billed calls over the UTC month by day-of-month', () => {
		expect(projectedBurn(10, Date.parse('2026-10-10T12:00:00Z'))).toBe(Math.round((10 / 10) * 31));
		expect(projectedBurn(10, Date.parse('2026-10-10T12:00:00Z'))).toBe(31);
	});

	test('uses at least one elapsed day on the 1st', () => {
		expect(projectedBurn(2, Date.parse('2026-11-01T00:00:00Z'))).toBe(60);
		expect(projectedBurn(0, Date.parse('2026-11-01T00:00:00Z'))).toBe(0);
	});
});

describe('formatting (en-US, UTC)', () => {
	test('formatCount groups thousands', () => {
		expect(formatCount(1000)).toBe('1,000');
		expect(formatCount(40)).toBe('40');
	});

	test('formatUsd renders two-decimal dollars', () => {
		expect(formatUsd(0.2)).toBe('$0.20');
		expect(formatUsd(2)).toBe('$2.00');
		expect(formatUsd(190)).toBe('$190.00');
	});

	test('formatMonthDay renders the UTC date regardless of local zone', () => {
		expect(formatMonthDay(Date.parse('2026-11-01T00:00:00Z'))).toBe('Nov 1');
		expect(formatMonthDay(Date.parse('2027-01-01T00:00:00Z'))).toBe('Jan 1');
	});
});
