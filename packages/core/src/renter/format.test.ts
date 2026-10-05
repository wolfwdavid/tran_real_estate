import { describe, expect, it } from 'vitest';
import {
	formatDistance,
	formatMonthDay,
	formatMonthDayYear,
	formatMonthYear,
	formatPercent,
	formatRent,
	formatSqft,
	relativeListed
} from './format.js';

const NOW = new Date('2026-10-15T12:00:00Z');

describe('renter formatters', () => {
	it('formats rent as whole dollars', () => {
		expect(formatRent(2150)).toBe('$2,150');
		expect(formatRent(2150.6)).toBe('$2,151');
		expect(formatRent(null)).toBeNull();
		expect(formatRent(Number.NaN)).toBeNull();
	});

	it('formats dates in UTC', () => {
		expect(formatMonthDay('2026-10-02')).toBe('Oct 2');
		expect(formatMonthDayYear('2026-09-28')).toBe('Sep 28, 2026');
		expect(formatMonthYear('2026-10-01')).toBe('Oct 2026');
		expect(formatMonthDay('2026-10-02T23:30:00.000Z')).toBe('Oct 2');
		expect(formatMonthDay('not-a-date')).toBeNull();
		expect(formatMonthDay(null)).toBeNull();
	});

	it('describes listing age relative to now', () => {
		expect(relativeListed('2026-10-15', NOW)).toBe('today');
		expect(relativeListed('2026-10-14', NOW)).toBe('yesterday');
		expect(relativeListed('2026-10-12', NOW)).toBe('3 days ago');
		expect(relativeListed('2026-09-01', NOW)).toBe('on Sep 1, 2026');
		expect(relativeListed(null, NOW)).toBeNull();
	});

	it('formats square feet, distance and percent', () => {
		expect(formatSqft(850)).toBe('850');
		expect(formatSqft(1200)).toBe('1,200');
		expect(formatSqft(null)).toBeNull();
		expect(formatDistance(0.43)).toBe('0.4 mi');
		expect(formatPercent(6.4)).toBe('6%');
	});
});
