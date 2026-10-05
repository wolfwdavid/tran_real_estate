import { describe, expect, it } from 'vitest';
import { listingStatus } from './listing-status.js';

const NOW = new Date('2026-10-15T12:00:00Z');

describe('listingStatus', () => {
	it('is recent when an active listing was seen within 7 days', () => {
		expect(listingStatus({ status: 'Active', lastSeenDate: '2026-10-10' }, NOW)).toEqual({
			kind: 'recent',
			lastSeen: '2026-10-10'
		});
	});

	it('treats exactly 7 days as recent and 8 days as stale', () => {
		expect(listingStatus({ status: 'Active', lastSeenDate: '2026-10-08' }, NOW).kind).toBe('recent');
		expect(listingStatus({ status: 'Active', lastSeenDate: '2026-10-07' }, NOW)).toEqual({
			kind: 'stale',
			lastSeen: '2026-10-07'
		});
	});

	it('accepts full ISO timestamps', () => {
		expect(
			listingStatus({ status: 'Active', lastSeenDate: '2026-10-10T08:00:00.000Z' }, NOW)
		).toEqual({ kind: 'recent', lastSeen: '2026-10-10' });
	});

	it('is gone when inactive or removed', () => {
		expect(listingStatus({ status: 'Inactive', lastSeenDate: '2026-10-14' }, NOW)).toEqual({
			kind: 'gone'
		});
		expect(
			listingStatus({ status: 'Active', lastSeenDate: '2026-10-14', removedDate: '2026-10-14' }, NOW)
		).toEqual({ kind: 'gone' });
	});

	it('is stale with a null lastSeen when the date is missing', () => {
		expect(listingStatus({ status: 'Active', lastSeenDate: null }, NOW)).toEqual({
			kind: 'stale',
			lastSeen: null
		});
	});

	it('honors a custom recency window', () => {
		expect(listingStatus({ status: 'Active', lastSeenDate: '2026-10-10' }, NOW, 3).kind).toBe(
			'stale'
		);
	});
});
