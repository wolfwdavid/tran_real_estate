// Deals list / compare helpers (07-16, INV-03).
import { describe, expect, test } from 'vitest';
import { analyze, REFERENCE_CASES, type DealAnalysis } from '@tran/core/finance';
import type { DealRecord } from './schema';
import {
	compareBarStatus,
	compareHref,
	droppedNote,
	isSortKey,
	parseCompareIds,
	SORT_OPTIONS,
	sortDeals,
	toggleSelection,
	type DealRow
} from './deals-view';

const base = analyze(REFERENCE_CASES[0].inputs);

function row(
	id: string,
	name: string,
	updatedAt: string,
	over: Partial<DealAnalysis> = {}
): DealRow {
	const record = {
		id,
		name,
		updatedAt,
		inputs: REFERENCE_CASES[0].inputs
	} as unknown as DealRecord;
	return { record, analysis: { ...base, ...over } };
}

const ids = (rows: DealRow[]) => rows.map((r) => r.record.id);

describe('SORT_OPTIONS', () => {
	test('five options in UI-SPEC order and wording', () => {
		expect(SORT_OPTIONS.map((o) => o.label)).toEqual([
			'Last saved (newest first)',
			'Monthly cash flow (highest first)',
			'Cap rate (highest first)',
			'Cash-on-cash return (highest first)',
			'Name (A to Z)'
		]);
		expect(isSortKey('capRate')).toBe(true);
		expect(isSortKey('best')).toBe(false);
	});
});

describe('sortDeals', () => {
	const deals = [
		row('a', 'beta', '2026-10-01T00:00:00.000Z', {
			cashFlowMonthly: 100,
			capRatePct: 5,
			cocPct: null
		}),
		row('b', 'Alpha', '2026-10-03T00:00:00.000Z', {
			cashFlowMonthly: null,
			capRatePct: 7,
			cocPct: 2
		}),
		row('c', 'gamma', '2026-10-02T00:00:00.000Z', {
			cashFlowMonthly: 300,
			capRatePct: null,
			cocPct: 9
		}),
		row('d', 'alpha 2', '2026-10-02T00:00:00.000Z', {
			cashFlowMonthly: -50,
			capRatePct: 6,
			cocPct: 2
		})
	];

	test('cashFlow: highest first, null last', () => {
		expect(ids(sortDeals(deals, 'cashFlow'))).toEqual(['c', 'a', 'd', 'b']);
	});
	test('capRate and coc: highest first, null last, stable on ties', () => {
		expect(ids(sortDeals(deals, 'capRate'))).toEqual(['b', 'd', 'a', 'c']);
		expect(ids(sortDeals(deals, 'coc'))).toEqual(['c', 'b', 'd', 'a']);
	});
	test('name: A to Z, case-insensitive', () => {
		expect(ids(sortDeals(deals, 'name'))).toEqual(['b', 'd', 'a', 'c']);
	});
	test('saved: newest first, stable on equal timestamps', () => {
		expect(ids(sortDeals(deals, 'saved'))).toEqual(['b', 'c', 'd', 'a']);
	});
	test('returns a copy', () => {
		const before = ids(deals);
		sortDeals(deals, 'name');
		expect(ids(deals)).toEqual(before);
	});
});

describe('toggleSelection', () => {
	test('adds up to 3, refuses a 4th', () => {
		expect(toggleSelection([], 'a')).toEqual({ selected: ['a'], blocked: false });
		expect(toggleSelection(['a', 'b'], 'c')).toEqual({ selected: ['a', 'b', 'c'], blocked: false });
		expect(toggleSelection(['a', 'b', 'c'], 'd')).toEqual({
			selected: ['a', 'b', 'c'],
			blocked: true
		});
	});
	test('toggling a selected id removes it, even at the cap', () => {
		expect(toggleSelection(['a', 'b', 'c'], 'b')).toEqual({ selected: ['a', 'c'], blocked: false });
	});
});

describe('compareBarStatus', () => {
	test('copy per count', () => {
		expect(compareBarStatus(0)).toBe('Select 2 or 3 deals to compare.');
		expect(compareBarStatus(1)).toBe('Select 2 or 3 deals to compare.');
		expect(compareBarStatus(2)).toBe('2 selected.');
		expect(compareBarStatus(3)).toBe(
			'3 selected, the most you can compare. Clear one to choose another.'
		);
	});
});

describe('parseCompareIds / compareHref / droppedNote', () => {
	test('dedupes and keeps at most 3 in order', () => {
		expect(parseCompareIds('?ids=a,b,a,c,d')).toEqual(['a', 'b', 'c']);
		expect(parseCompareIds('?ids= a , ,b')).toEqual(['a', 'b']);
		expect(parseCompareIds('')).toEqual([]);
		expect(parseCompareIds('?other=1')).toEqual([]);
	});
	test('compareHref round-trips through parseCompareIds', () => {
		const href = compareHref(['x1', 'y2']);
		expect(href).toMatch(/\/investor\/compare\/\?ids=x1,y2$/);
		expect(parseCompareIds(href.slice(href.indexOf('?')))).toEqual(['x1', 'y2']);
	});
	test('dropped note singular and plural', () => {
		expect(droppedNote(1)).toBe("1 deal in the link isn't in this browser, so it isn't shown.");
		expect(droppedNote(2)).toBe(
			"2 deals in the link aren't in this browser, so they aren't shown."
		);
	});
});
