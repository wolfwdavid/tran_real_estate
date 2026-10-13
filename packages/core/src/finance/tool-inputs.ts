// Input parsing, validation and display formatting for the SEO calculator pages (GTM-03).
//
// Parsing is forgiving about how people type numbers ("$250,000", " 5% ") and strict about
// everything else: anything that is not plain digits with at most one decimal point is NaN.
// Validation maps each failure to a typed code; the page turns the code into UI-SPEC copy:
//   required   -> "Enter {field name, lowercase}."
//   nan        -> "Use numbers only, like 250,000."
//   min / max  -> "Enter {min} or more." / "Enter {max} or less."
//   price-zero -> "Enter a purchase price above $0."
// Display strings delegate to the Phase 7 formatters in `@tran/core/format`, so the tool pages
// and the investor portal print numbers identically (whole dollars, U+2212 minus, two decimals).

import { pct, ratio, usd } from '../format/index.js';
import { roundHalfAway, type Cents } from './money.js';

export type FieldKind = 'money' | 'percent' | 'rate' | 'years';

/** UI-SPEC validation ranges. Money limits are in dollars. */
export const FIELD_LIMITS: Record<FieldKind, { min: number; max: number; integer?: boolean }> = {
	money: { min: 0, max: 100_000_000 },
	percent: { min: 0, max: 100 },
	rate: { min: 0, max: 30 },
	years: { min: 1, max: 40, integer: true }
};

export type FieldErrorCode = 'required' | 'nan' | 'min' | 'max' | 'price-zero';
export type FieldError = { ok: false; code: FieldErrorCode; min?: number; max?: number };
export type FieldResult = { ok: true; value: number } | FieldError;

export interface FieldSpec {
	kind: FieldKind;
	required?: boolean;
	/** Zero is rejected with 'price-zero' (purchase price on cap rate and cash-on-cash). */
	positive?: boolean;
}

const PLAIN = /^-?\d+(\.\d+)?$/;

/**
 * "250,000" -> 250000, "$250,000" -> 250000, " 5% " -> 5. Blank -> null. Anything else that is
 * not digits with one optional decimal point (after dropping one leading "$", one trailing "%",
 * and commas) -> NaN. A leading "-" parses; money fields then reject it by range.
 */
export function parseToolNumber(raw: string): number | null {
	let t = raw.trim();
	if (t === '') return null;
	if (t.startsWith('$')) t = t.slice(1);
	if (t.endsWith('%')) t = t.slice(0, -1);
	t = t.replaceAll(',', '');
	return PLAIN.test(t) ? Number(t) : Number.NaN;
}

export function validateToolField(raw: string, spec: FieldSpec): FieldResult {
	const n = parseToolNumber(raw);
	if (n === null) return spec.required ? { ok: false, code: 'required' } : { ok: true, value: 0 };
	if (Number.isNaN(n)) return { ok: false, code: 'nan' };
	const limits = FIELD_LIMITS[spec.kind];
	if (limits.integer && !Number.isInteger(n)) return { ok: false, code: 'nan' };
	if (n < limits.min) return { ok: false, code: 'min', min: limits.min };
	if (n > limits.max) return { ok: false, code: 'max', max: limits.max };
	if (spec.positive && n === 0) return { ok: false, code: 'price-zero' };
	return { ok: true, value: spec.kind === 'money' ? roundHalfAway(n * 100) : n + 0 };
}

const MONEY_INPUT = {
	whole: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
	cents: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
} as const;

/** Cents back into an input value: 25000000 -> "250,000"; 124744 -> "1,247.44". */
export function formatMoneyInput(cents: Cents): string {
	const f = cents % 100 === 0 ? MONEY_INPUT.whole : MONEY_INPUT.cents;
	return f.format(cents / 100);
}

/** Whole dollars, minus sign 0x2212 for negatives: 1560000 -> "$15,600"; -12000 -> MINUS + "$120". */
export function toolMoney(cents: Cents): string {
	return usd(cents);
}

/** A fraction as a two-decimal percent: 0.0624 -> "6.24%". null stays null. */
export function toolPercent(r: number | null): string | null {
	return r === null ? null : pct(r * 100, 2);
}

/** A unitless two-decimal ratio (DSCR): 1.04213 -> "1.04". null stays null. */
export function toolRatio(r: number | null): string | null {
	return r === null ? null : ratio(r, 2);
}
