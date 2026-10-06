// Researcher defaults under CONTEXT discretion (UI-SPEC Planner Note 7). Tran never invents a dollar
// figure for tax or insurance.
//
// Every value here is a starting assumption the user can edit. Percent lines are basis points.

import type { ClosingCosts, ExpenseLine } from './types.js';

const line = (l: ExpenseLine): ExpenseLine => Object.freeze(l);

export const DEFAULT_EXPENSE_LINES: readonly ExpenseLine[] = Object.freeze([
	line({ id: 'vacancy', kind: 'vacancy', name: 'Vacancy allowance', unit: 'pct', bps: 500 }),
	line({
		id: 'management',
		kind: 'management',
		name: 'Property management',
		unit: 'pct',
		bps: 800
	}),
	line({ id: 'maintenance', kind: 'maintenance', name: 'Maintenance', unit: 'pct', bps: 500 }),
	line({ id: 'capex', kind: 'capex', name: 'Capital reserves', unit: 'pct', bps: 500 }),
	line({ id: 'tax', kind: 'tax', name: 'Property tax', unit: 'usd', cents: null }),
	line({ id: 'insurance', kind: 'insurance', name: 'Insurance', unit: 'usd', cents: null }),
	line({ id: 'hoa', kind: 'hoa', name: 'HOA dues', unit: 'usd', cents: null }),
	line({
		id: 'utilities',
		kind: 'utilities',
		name: 'Owner-paid utilities',
		unit: 'usd',
		cents: null
	})
]);

/** Fresh, mutable copies of the default lines. */
export function defaultExpenseLines(): ExpenseLine[] {
	return DEFAULT_EXPENSE_LINES.map((l) => ({ ...l }));
}

/** Closing costs default to 3% of the purchase price. */
export const DEFAULT_CLOSING: ClosingCosts = Object.freeze({ unit: 'pct', bps: 300 } as const);

/** Down payment 25%. */
export const DEFAULT_DOWN_BPS = 2500;
/** Loan term 30 years. */
export const DEFAULT_TERM_YEARS = 30;
/** Buy-box quick metrics assume operating expenses of 40% of rent. */
export const BUY_BOX_EXPENSE_BPS = 4000;
/** At most 12 user-added expense lines. */
export const MAX_CUSTOM_LINES = 12;
