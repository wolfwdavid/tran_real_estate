// Saved-deals list and compare helpers (INV-03, 07-UI-SPEC "Deals list" / "Compare"). Pure: sort
// orders, the in-memory compare selection (capped at MAX_COMPARE), the compare bar status line,
// and the ?ids= link format. Selection is never persisted; it lives in memory and the compare URL.
import { resolve } from '$app/paths';
import { MAX_COMPARE, MIN_COMPARE, type DealAnalysis } from '@tran/core/finance';
import type { DealRecord } from './schema';

export type SortKey = 'saved' | 'cashFlow' | 'capRate' | 'coc' | 'name';

export const SORT_OPTIONS: readonly { key: SortKey; label: string }[] = Object.freeze([
	{ key: 'saved', label: 'Last saved (newest first)' },
	{ key: 'cashFlow', label: 'Monthly cash flow (highest first)' },
	{ key: 'capRate', label: 'Cap rate (highest first)' },
	{ key: 'coc', label: 'Cash-on-cash return (highest first)' },
	{ key: 'name', label: 'Name (A to Z)' }
]);

export function isSortKey(v: string): v is SortKey {
	return SORT_OPTIONS.some((o) => o.key === v);
}

export interface DealRow {
	record: DealRecord;
	analysis: DealAnalysis;
}

const METRIC: Record<'cashFlow' | 'capRate' | 'coc', (a: DealAnalysis) => number | null> = {
	cashFlow: (a) => a.cashFlowMonthly,
	capRate: (a) => a.capRatePct,
	coc: (a) => a.cocPct
};

const usable = (v: number | null): v is number => v !== null && Number.isFinite(v);

/** A sorted copy. Metric sorts are highest first with unavailable values last; ties keep order. */
export function sortDeals<T extends DealRow>(deals: readonly T[], key: SortKey): T[] {
	const out = [...deals];
	if (key === 'saved') {
		return out.sort((a, b) =>
			a.record.updatedAt === b.record.updatedAt
				? 0
				: a.record.updatedAt < b.record.updatedAt
					? 1
					: -1
		);
	}
	if (key === 'name') {
		return out.sort((a, b) =>
			a.record.name.localeCompare(b.record.name, 'en-US', { sensitivity: 'base', numeric: true })
		);
	}
	const get = METRIC[key];
	return out.sort((a, b) => {
		const x = get(a.analysis);
		const y = get(b.analysis);
		if (!usable(x)) return usable(y) ? 1 : 0;
		if (!usable(y)) return -1;
		return y - x;
	});
}

/** Toggle one deal in the selection. Adding beyond MAX_COMPARE is refused (`blocked: true`). */
export function toggleSelection(
	selected: readonly string[],
	id: string
): { selected: string[]; blocked: boolean } {
	if (selected.includes(id)) return { selected: selected.filter((s) => s !== id), blocked: false };
	if (selected.length >= MAX_COMPARE) return { selected: [...selected], blocked: true };
	return { selected: [...selected, id], blocked: false };
}

export const COMPARE_CAP_REASON = 'You can compare up to 3 deals. Clear one to choose another.';
export const COMPARE_MIN_REASON = 'Select at least 2 deals to compare.';

export function compareBarStatus(n: number): string {
	if (n < MIN_COMPARE) return 'Select 2 or 3 deals to compare.';
	if (n >= MAX_COMPARE) return '3 selected, the most you can compare. Clear one to choose another.';
	return `${n} selected.`;
}

/** '?ids=a,b,a,c,d' -> ['a','b','c']: trimmed, de-duplicated, at most MAX_COMPARE, in order. */
export function parseCompareIds(search: string): string[] {
	const raw = new URLSearchParams(search).get('ids') ?? '';
	const out: string[] = [];
	for (const part of raw.split(',')) {
		const id = part.trim();
		if (id && !out.includes(id)) out.push(id);
		if (out.length === MAX_COMPARE) break;
	}
	return out;
}

export function compareHref(ids: readonly string[]): string {
	return `${resolve('/investor/compare/')}?ids=${ids.map(encodeURIComponent).join(',')}`;
}

export function droppedNote(n: number): string {
	return n === 1
		? "1 deal in the link isn't in this browser, so it isn't shown."
		: `${n} deals in the link aren't in this browser, so they aren't shown.`;
}
