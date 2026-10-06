// Side-by-side deal comparison (INV-03). Pure arithmetic: each row carries the metric's direction
// (higher or lower is the extreme worth marking), and the markers read "Highest" / "Lowest" only.
// They describe numbers, never recommend a deal (07-UI-SPEC Honesty rule 1).
//
// Mark rule: every value tied at the extreme is marked; nothing is marked when fewer than two values
// are available or when every available value is equal; an unavailable (null) value is never marked.

import { NOT_AVAILABLE, pct, ratio, usd } from '../format/index.js';
import type { DealAnalysis, DealInputs } from './types.js';

export type CompareRowKey =
	| 'price'
	| 'rent'
	| 'cashNeeded'
	| 'cashFlow'
	| 'coc'
	| 'capRate'
	| 'noiAnnual'
	| 'dscr'
	| 'grm'
	| 'rentToPrice';

export type CompareDirection = 'max' | 'min';

export interface CompareRowDef {
	key: CompareRowKey;
	label: string;
	direction: CompareDirection | null;
}

/** Rows in UI-SPEC order. `null` direction = shown for context, never marked. */
export const COMPARE_ROWS: readonly CompareRowDef[] = Object.freeze([
	{ key: 'price', label: 'Purchase price', direction: null },
	{ key: 'rent', label: 'Monthly rent', direction: null },
	{ key: 'cashNeeded', label: 'Total cash needed', direction: 'min' },
	{ key: 'cashFlow', label: 'Monthly cash flow', direction: 'max' },
	{ key: 'coc', label: 'Cash-on-cash return', direction: 'max' },
	{ key: 'capRate', label: 'Cap rate', direction: 'max' },
	{ key: 'noiAnnual', label: 'Net operating income (annual)', direction: 'max' },
	{ key: 'dscr', label: 'DSCR', direction: 'max' },
	{ key: 'grm', label: 'GRM', direction: 'min' },
	{ key: 'rentToPrice', label: '1% rule (rent-to-price)', direction: 'max' }
] as const satisfies readonly CompareRowDef[]);

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 3;

/** Two ratios computed different ways (e.g. GRM 8.333…) count as equal within this tolerance. */
const TIE_EPSILON = 1e-12;

const same = (a: number, b: number): boolean =>
	Math.abs(a - b) <= TIE_EPSILON * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Indices of the values at the extreme for `direction`, ties included. Returns [] when fewer than
 * two values are available or all available values are equal. Null indices are never returned.
 */
export function bestInRow(
	values: readonly (number | null)[],
	direction: CompareDirection
): number[] {
	const present: number[] = [];
	values.forEach((v, i) => {
		if (v !== null && Number.isFinite(v)) present.push(i);
	});
	if (present.length < 2) return [];
	let extreme = values[present[0]] as number;
	for (const i of present) {
		const v = values[i] as number;
		if (direction === 'max' ? v > extreme : v < extreme) extreme = v;
	}
	const marked = present.filter((i) => same(values[i] as number, extreme));
	return marked.length === present.length ? [] : marked;
}

export interface CompareRow extends CompareRowDef {
	values: (number | null)[];
	display: string[];
	marked: number[];
	marker: 'Highest' | 'Lowest' | null;
}

export interface CompareDeal {
	inputs: DealInputs;
	analysis: DealAnalysis;
}

function valueFor(key: CompareRowKey, d: CompareDeal): number | null {
	switch (key) {
		case 'price':
			return d.inputs.priceCents;
		case 'rent':
			return d.inputs.rentCents;
		case 'cashNeeded':
			return d.analysis.cashInvestedCents;
		case 'cashFlow':
			return d.analysis.cashFlowMonthly;
		case 'coc':
			return d.analysis.cocPct;
		case 'capRate':
			return d.analysis.capRatePct;
		case 'noiAnnual':
			return d.analysis.noiAnnual;
		case 'dscr':
			return d.analysis.dscr;
		case 'grm':
			return d.analysis.grm;
		case 'rentToPrice':
			return d.analysis.rentToPricePct;
	}
}

function formatFor(key: CompareRowKey, v: number | null): string {
	if (v === null) return NOT_AVAILABLE;
	switch (key) {
		case 'price':
		case 'rent':
		case 'cashNeeded':
		case 'cashFlow':
		case 'noiAnnual':
			return usd(v);
		case 'coc':
		case 'capRate':
			return pct(v, 1);
		case 'rentToPrice':
			return pct(v, 2);
		case 'dscr':
			return ratio(v, 2);
		case 'grm':
			return ratio(v, 1);
	}
}

/** The compare table for 2..3 deals, in COMPARE_ROWS order. Throws RangeError outside 2..3. */
export function buildComparison(deals: readonly CompareDeal[]): CompareRow[] {
	if (deals.length < MIN_COMPARE || deals.length > MAX_COMPARE) {
		throw new RangeError(
			`Compare needs ${MIN_COMPARE} to ${MAX_COMPARE} deals, got ${deals.length}`
		);
	}
	return COMPARE_ROWS.map((def) => {
		const values = deals.map((d) => valueFor(def.key, d));
		const marked = def.direction === null ? [] : bestInRow(values, def.direction);
		const marker = def.direction === null ? null : def.direction === 'max' ? 'Highest' : 'Lowest';
		return {
			...def,
			values,
			display: values.map((v) => formatFor(def.key, v)),
			marked,
			marker
		};
	});
}
