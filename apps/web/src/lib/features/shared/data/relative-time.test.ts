import { describe, expect, test } from 'vitest';
import {
	CHIP_SAMPLE,
	REFRESH_DONE,
	REFRESH_LABEL,
	REFRESHING,
	checkedText,
	chipText,
	detailText,
	formatCost,
	newSinceText
} from './copy/provenance';
import { formatRelative, toIso } from './relative-time';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const t = Date.UTC(2026, 9, 5, 12, 0, 0);

describe('formatRelative', () => {
	test('under one minute is "just now"', () => {
		expect(formatRelative(t, t)).toBe('just now');
		expect(formatRelative(t, t + 30_000)).toBe('just now');
		expect(formatRelative(t, t + 59_999)).toBe('just now');
	});

	test('minutes, hours and days use the strict distance', () => {
		expect(formatRelative(t, t + MIN)).toBe('1 minute ago');
		expect(formatRelative(t, t + 5 * MIN)).toBe('5 minutes ago');
		expect(formatRelative(t, t + 2 * HOUR)).toBe('2 hours ago');
		expect(formatRelative(t, t + 3 * DAY)).toBe('3 days ago');
		expect(formatRelative(t, t + 6 * DAY + 23 * HOUR)).toMatch(/^\d+ days ago$/);
	});

	test('a future fetchedAt (clock skew) reads "just now"', () => {
		expect(formatRelative(t + 5 * MIN, t)).toBe('just now');
	});

	test('seven days or older shows the date, with the year only when it differs', () => {
		const now = Date.parse('2026-10-15T12:00:00Z');
		expect(formatRelative(Date.parse('2026-09-28T12:00:00Z'), now, { timeZone: 'UTC' })).toBe(
			'Sep 28'
		);
		expect(formatRelative(Date.parse('2025-09-28T12:00:00Z'), now, { timeZone: 'UTC' })).toBe(
			'Sep 28, 2025'
		);
		expect(formatRelative(now - 7 * DAY, now, { timeZone: 'UTC' })).toBe('Oct 8');
	});

	test('toIso renders the epoch as an ISO string', () => {
		expect(toIso(t)).toBe('2026-10-05T12:00:00.000Z');
	});
});

describe('provenance copy', () => {
	test('constants are verbatim', () => {
		expect(CHIP_SAMPLE).toBe('Sample data');
		expect(REFRESH_LABEL).toBe('Refresh');
		expect(REFRESHING).toBe('Refreshing…');
		expect(REFRESH_DONE).toBe('Refreshed from RentCast. 1 call used.');
	});

	test('formatCost covers every reason', () => {
		expect(formatCost({ calls: 1, reason: 'network' })).toBe('(1 call)');
		expect(formatCost({ calls: 3, reason: 'network' })).toBe('(3 calls)');
		expect(formatCost({ calls: 1000, reason: 'network' })).toBe('(1,000 calls)');
		expect(formatCost({ calls: 0, reason: 'cached' })).toBe('(0 calls · cached)');
		expect(formatCost({ calls: 0, reason: 'sample' })).toBe('(0 calls · sample data)');
		expect(formatCost('free')).toBe('(0 calls)');
	});

	test('chipText per variant', () => {
		expect(chipText({ source: 'sample', fetchedAt: t, stale: false }, 'just now')).toBe(
			'Sample data'
		);
		expect(chipText({ source: 'rentcast', fetchedAt: t, stale: false }, '2 hours ago')).toBe(
			'RentCast · as of 2 hours ago'
		);
		expect(chipText({ source: 'rentcast', fetchedAt: t, stale: true }, '3 days ago')).toBe(
			'RentCast · as of 3 days ago · may be out of date'
		);
	});

	test('newSinceText', () => {
		expect(newSinceText(0)).toBe('No new listings');
		expect(newSinceText(1)).toBe('1 new since your last visit');
		expect(newSinceText(4)).toBe('4 new since your last visit');
		expect(newSinceText(1000)).toBe('1,000 new since your last visit');
	});

	test('detailText omits zero parts and singularises price changes', () => {
		expect(detailText({ new: 2, priceChanged: 1, gone: 0 })).toBe('2 new, 1 price change');
		expect(detailText({ new: 0, priceChanged: 3, gone: 2 })).toBe(
			'3 price changes, 2 no longer listed'
		);
		expect(detailText({ new: 0, priceChanged: 0, gone: 0 })).toBe('');
	});

	test('checkedText names the source', () => {
		expect(checkedText('2 hours ago', 'rentcast')).toBe('Checked 2 hours ago from RentCast');
		expect(checkedText('just now', 'sample')).toBe('Checked just now (sample data)');
	});
});
