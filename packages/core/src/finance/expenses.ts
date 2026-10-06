// Expense-line model (INV-01): what each percent line is a percent of, monthly dollars per line,
// unit switching, and input validation.
//
// Bases (RESEARCH "Finance Definitions"): vacancy is a percent of gross scheduled income (GSI),
// management a percent of collected income (EGI = GSI − vacancy), every other percent line a
// percent of rent. Dollar lines are monthly cents. A blank amount counts as 0.

import { MAX_CUSTOM_LINES } from './defaults.js';
import { MAX_CENTS, divRoundHalfAway, mulBps } from './money.js';
import type { DealInputs, ExpenseKind, ExpenseLine } from './types.js';

export interface LineContext {
	rentCents: number;
	gsiCents: number;
	egiCents: number;
}

/** The amount a percent line is a percent of. */
export function lineBaseCents(kind: ExpenseKind, ctx: LineContext): number {
	if (kind === 'vacancy') return ctx.gsiCents;
	if (kind === 'management') return ctx.egiCents;
	return ctx.rentCents;
}

/** Monthly cents for one line. Blank amounts count as 0. */
export function lineMonthlyCents(line: ExpenseLine, ctx: LineContext): number {
	if (line.unit === 'pct') return mulBps(lineBaseCents(line.kind, ctx), line.bps ?? 0);
	return line.cents ?? 0;
}

/**
 * Switches a line between "% of rent" and "$ per month", keeping its monthly dollars. Percent to
 * dollars is exact. Dollars to percent rounds to the nearest basis point, so the dollars come back
 * within the 0.01% resolution of the base. A zero base or a blank amount converts to blank.
 */
export function convertExpenseUnit(
	line: ExpenseLine,
	to: 'pct' | 'usd',
	ctx: LineContext
): ExpenseLine {
	const { id, kind, name } = line;
	if (line.unit === to) return { ...line };
	if (line.unit === 'pct') {
		return {
			id,
			kind,
			name,
			unit: 'usd',
			cents: line.bps === null ? null : lineMonthlyCents(line, ctx)
		};
	}
	const base = lineBaseCents(kind, ctx);
	const bps = line.cents === null || base === 0 ? null : divRoundHalfAway(line.cents * 10000, base);
	return { id, kind, name, unit: 'pct', bps };
}

export type InputError = {
	field: string;
	error: 'negative' | 'out-of-range' | 'too-large' | 'too-many-lines' | 'missing-line';
};

const REQUIRED_KINDS: readonly ExpenseKind[] = [
	'vacancy',
	'management',
	'maintenance',
	'capex',
	'tax',
	'insurance',
	'hoa',
	'utilities'
];

const MAX_RATE_PCT = 25;
const MIN_TERM_YEARS = 1;
const MAX_TERM_YEARS = 40;

/**
 * Checks the bounds that keep the math exact: integer cents within MAX_CENTS, integer basis points
 * within 0..10000, rate 0..25%, whole-year term 1..40, at most MAX_CUSTOM_LINES custom lines and
 * every default line present. Returns [] for valid inputs.
 */
export function validateDealInputs(inputs: DealInputs): InputError[] {
	const errors: InputError[] = [];
	const cents = (field: string, v: number) => {
		if (!Number.isSafeInteger(v)) errors.push({ field, error: 'out-of-range' });
		else if (v < 0) errors.push({ field, error: 'negative' });
		else if (v > MAX_CENTS) errors.push({ field, error: 'too-large' });
	};
	const bps = (field: string, v: number) => {
		if (!Number.isSafeInteger(v)) errors.push({ field, error: 'out-of-range' });
		else if (v < 0) errors.push({ field, error: 'negative' });
		else if (v > 10000) errors.push({ field, error: 'out-of-range' });
	};

	cents('priceCents', inputs.priceCents);
	cents('repairsCents', inputs.repairsCents);
	cents('rentCents', inputs.rentCents);
	cents('otherIncomeCents', inputs.otherIncomeCents);
	if (inputs.closing.unit === 'pct') bps('closing', inputs.closing.bps);
	else cents('closing', inputs.closing.cents);

	const f = inputs.financing;
	if (f.kind === 'mortgage') {
		bps('financing.downBps', f.downBps);
		const rate = f.annualRatePct;
		if (rate !== null) {
			if (!Number.isFinite(rate) || rate > MAX_RATE_PCT) {
				errors.push({ field: 'financing.annualRatePct', error: 'out-of-range' });
			} else if (rate < 0) errors.push({ field: 'financing.annualRatePct', error: 'negative' });
		}
		if (
			!Number.isInteger(f.termYears) ||
			f.termYears < MIN_TERM_YEARS ||
			f.termYears > MAX_TERM_YEARS
		) {
			errors.push({ field: 'financing.termYears', error: 'out-of-range' });
		}
	}

	for (const line of inputs.expenses) {
		const field = `expenses.${line.id}`;
		if (line.unit === 'pct') {
			if (line.bps !== null) bps(field, line.bps);
		} else if (line.cents !== null) cents(field, line.cents);
	}
	if (inputs.expenses.filter((l) => l.kind === 'custom').length > MAX_CUSTOM_LINES) {
		errors.push({ field: 'expenses', error: 'too-many-lines' });
	}
	for (const kind of REQUIRED_KINDS) {
		if (!inputs.expenses.some((l) => l.kind === kind)) {
			errors.push({ field: `expenses.${kind}`, error: 'missing-line' });
		}
	}
	return errors;
}
