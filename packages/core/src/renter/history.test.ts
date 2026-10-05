import { describe, expect, it } from 'vitest';
import { historyEvents, historySummary, pricePoints, type RawHistory } from './history.js';

describe('historyEvents', () => {
	it('returns [] for null, undefined and empty history', () => {
		expect(historyEvents(null)).toEqual([]);
		expect(historyEvents(undefined)).toEqual([]);
		expect(historyEvents({})).toEqual([]);
	});

	it('turns a single entry into one listed event', () => {
		expect(historyEvents({ '2026-09-28': { price: 2150, listedDate: '2026-09-28' } })).toEqual([
			{ date: '2026-09-28', kind: 'listed', rent: 2150, change: null }
		]);
	});

	it('sorts keys ascending internally and returns newest first with signed changes', () => {
		const h: RawHistory = {
			'2026-09-20': { price: 2100 },
			'2026-08-01': { price: 2200, listedDate: '2026-08-01' },
			'2026-08-15': { price: 2200 },
			'2026-10-02': { price: 2150 }
		};
		expect(historyEvents(h)).toEqual([
			{ date: '2026-10-02', kind: 'rent-changed', rent: 2150, change: 50 },
			{ date: '2026-09-20', kind: 'rent-changed', rent: 2100, change: -100 },
			{ date: '2026-08-01', kind: 'listed', rent: 2200, change: null }
		]);
	});

	it('emits delisted at removedDate and relisted for the next entry', () => {
		const h: RawHistory = {
			'2026-06-01': { price: 1900, listedDate: '2026-06-01', removedDate: '2026-07-10' },
			'2026-08-05': { price: 1950, listedDate: '2026-08-05' }
		};
		expect(historyEvents(h)).toEqual([
			{ date: '2026-08-05', kind: 'relisted', rent: 1950, change: null },
			{ date: '2026-07-10', kind: 'delisted', rent: 1900, change: null },
			{ date: '2026-06-01', kind: 'listed', rent: 1900, change: null }
		]);
	});

	it('ignores non-date keys', () => {
		expect(historyEvents({ junk: { price: 1 }, '2026-09-28': { price: 2150 } })).toHaveLength(1);
	});
});

describe('historySummary', () => {
	it('returns null for no events', () => {
		expect(historySummary([])).toBeNull();
	});

	it('returns none when only listed', () => {
		expect(historySummary(historyEvents({ '2026-09-28': { price: 2150 } }))).toEqual({
			kind: 'none',
			listedOn: '2026-09-28'
		});
	});

	it('returns one for exactly one rent change', () => {
		const events = historyEvents({ '2026-09-01': { price: 2200 }, '2026-09-20': { price: 2100 } });
		expect(historySummary(events)).toEqual({ kind: 'one', from: 2200, to: 2100, on: '2026-09-20' });
	});

	it('returns many for two or more rent changes', () => {
		const events = historyEvents({
			'2026-08-01': { price: 2200 },
			'2026-09-20': { price: 2100 },
			'2026-10-02': { price: 2150 }
		});
		expect(historySummary(events)).toEqual({
			kind: 'many',
			first: 2200,
			firstOn: '2026-08-01',
			last: 2150,
			lastOn: '2026-10-02'
		});
	});
});

describe('pricePoints', () => {
	it('returns rents oldest-first excluding delisted entries', () => {
		const events = historyEvents({
			'2026-06-01': { price: 1900, removedDate: '2026-07-10' },
			'2026-08-05': { price: 1950 },
			'2026-09-01': { price: 2000 }
		});
		expect(pricePoints(events)).toEqual([1900, 1950, 2000]);
	});
});
