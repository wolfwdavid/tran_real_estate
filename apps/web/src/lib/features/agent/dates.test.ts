// Pin the zone BEFORE any Date is used: the helpers read the runtime's local time zone, and the
// UTC-slicing bug they exist to prevent only shows west of Greenwich. Node re-reads process.env.TZ
// on assignment, and dates.ts builds its Intl formatters per call, so the hoisted import is safe.
process.env.TZ = 'America/Los_Angeles';

import { describe, expect, test } from 'vitest';
import {
	formatActivityTime,
	formatMonDay,
	formatMonDayYear,
	formatWeekdayLong,
	localDateOf,
	pad2,
	parseLocalDate,
	relativeDays,
	todayLocal
} from './dates';

describe('local calendar dates (America/Los_Angeles)', () => {
	test('the zone is really pinned', () => {
		expect(new Date('2026-10-05T02:00:00.000Z').getTimezoneOffset()).toBe(420);
	});

	test('localDateOf uses the local day, not the UTC day', () => {
		expect(localDateOf('2026-10-05T02:00:00.000Z')).toBe('2026-10-04');
		expect(localDateOf(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
	});

	test('todayLocal reads the injected clock', () => {
		expect(todayLocal(new Date('2026-10-05T06:59:00.000Z'))).toBe('2026-10-04');
		expect(todayLocal(new Date('2026-10-05T07:00:00.000Z'))).toBe('2026-10-05');
	});

	test('parseLocalDate is local midnight and rejects junk', () => {
		const d = parseLocalDate('2026-10-04');
		expect(d.getDate()).toBe(4);
		expect(d.getHours()).toBe(0);
		expect(() => parseLocalDate('Oct 4')).toThrow(RangeError);
	});

	test('display formats', () => {
		expect(pad2(3)).toBe('03');
		expect(formatMonDay('2026-10-04')).toBe('Oct 4');
		expect(formatMonDayYear('2026-10-04')).toBe('Oct 4, 2026');
		expect(formatMonDayYear('2026-10-05T02:00:00.000Z')).toBe('Oct 4, 2026');
		expect(formatWeekdayLong('2026-10-04')).toBe('Sunday, October 4');
	});

	test('formatActivityTime: same local day vs another day', () => {
		const now = new Date('2026-10-05T02:30:00.000Z'); // Oct 4, 7:30 PM local
		expect(formatActivityTime('2026-10-04T22:42:00.000Z', now)).toBe('Today at 3:42 PM');
		// 01:00Z on Oct 2 is still Oct 1 locally.
		expect(formatActivityTime('2026-10-02T01:00:00.000Z', now)).toBe('Oct 1');
		expect(formatActivityTime('2026-10-02T18:00:00.000Z', now)).toBe('Oct 2');
	});

	test('relativeDays counts local calendar days', () => {
		const now = new Date('2026-10-05T02:30:00.000Z'); // Oct 4 local
		expect(relativeDays('2026-10-04T16:00:00.000Z', now)).toBe('today');
		expect(relativeDays('2026-10-04T06:00:00.000Z', now)).toBe('yesterday'); // Oct 3, 11 PM local
		expect(relativeDays('2026-09-29T19:00:00.000Z', now)).toBe('5 days ago');
		expect(relativeDays('2026-10-06T19:00:00.000Z', now)).toBe('today');
	});

	test('relativeDays is DST-safe across the November change', () => {
		const now = new Date(2026, 10, 3, 9, 0); // Nov 3, after DST ends Nov 1
		expect(relativeDays(new Date(2026, 9, 29, 9, 0).toISOString(), now)).toBe('5 days ago');
	});
});
