import { describe, expect, test } from 'vitest';

import {
	BUY_BOX_EXPENSE_BPS,
	DEFAULT_CLOSING,
	DEFAULT_DOWN_BPS,
	DEFAULT_EXPENSE_LINES,
	DEFAULT_TERM_YEARS,
	MAX_CUSTOM_LINES,
	defaultExpenseLines
} from './defaults.js';
import { CONVENTIONS, METRIC_DEFINITIONS } from './definitions.js';
import {
	convertExpenseUnit,
	lineBaseCents,
	lineMonthlyCents,
	validateDealInputs,
	type LineContext
} from './expenses.js';
import { MAX_CENTS } from './money.js';
import type { DealInputs, ExpenseLine } from './types.js';

const ctx: LineContext = { rentCents: 200_000, gsiCents: 200_000, egiCents: 190_000 };

function validInputs(): DealInputs {
	return {
		priceCents: 20_000_000,
		closing: { ...DEFAULT_CLOSING },
		repairsCents: 0,
		financing: {
			kind: 'mortgage',
			downBps: DEFAULT_DOWN_BPS,
			annualRatePct: 7,
			termYears: DEFAULT_TERM_YEARS
		},
		rentCents: 200_000,
		otherIncomeCents: 0,
		expenses: defaultExpenseLines()
	};
}

describe('defaults', () => {
	test('eight default lines in order with names, units and amounts', () => {
		expect(DEFAULT_EXPENSE_LINES).toEqual([
			{ id: 'vacancy', kind: 'vacancy', name: 'Vacancy allowance', unit: 'pct', bps: 500 },
			{ id: 'management', kind: 'management', name: 'Property management', unit: 'pct', bps: 800 },
			{ id: 'maintenance', kind: 'maintenance', name: 'Maintenance', unit: 'pct', bps: 500 },
			{ id: 'capex', kind: 'capex', name: 'Capital reserves', unit: 'pct', bps: 500 },
			{ id: 'tax', kind: 'tax', name: 'Property tax', unit: 'usd', cents: null },
			{ id: 'insurance', kind: 'insurance', name: 'Insurance', unit: 'usd', cents: null },
			{ id: 'hoa', kind: 'hoa', name: 'HOA dues', unit: 'usd', cents: null },
			{ id: 'utilities', kind: 'utilities', name: 'Owner-paid utilities', unit: 'usd', cents: null }
		]);
	});

	test('scalar defaults', () => {
		expect(DEFAULT_CLOSING).toEqual({ unit: 'pct', bps: 300 });
		expect(DEFAULT_DOWN_BPS).toBe(2500);
		expect(DEFAULT_TERM_YEARS).toBe(30);
		expect(BUY_BOX_EXPENSE_BPS).toBe(4000);
		expect(MAX_CUSTOM_LINES).toBe(12);
	});

	test('the default array and its lines are frozen', () => {
		expect(Object.isFrozen(DEFAULT_EXPENSE_LINES)).toBe(true);
		for (const line of DEFAULT_EXPENSE_LINES) expect(Object.isFrozen(line)).toBe(true);
		expect(Object.isFrozen(DEFAULT_CLOSING)).toBe(true);
	});

	test('defaultExpenseLines() returns fresh mutable copies', () => {
		const a = defaultExpenseLines();
		expect(a).toEqual(DEFAULT_EXPENSE_LINES);
		const first = a[0];
		if (first.unit !== 'pct') throw new Error('expected pct');
		first.bps = 9999;
		a.push({ id: 'x', kind: 'custom', name: 'Other', unit: 'usd', cents: 1 });
		expect(DEFAULT_EXPENSE_LINES).toHaveLength(8);
		expect((DEFAULT_EXPENSE_LINES[0] as { bps: number }).bps).toBe(500);
		expect(defaultExpenseLines()[0]).not.toBe(a[0]);
	});
});

describe('lineBaseCents', () => {
	const c: LineContext = { rentCents: 1, gsiCents: 2, egiCents: 3 };
	test.each([
		['vacancy', 2],
		['management', 3],
		['maintenance', 1],
		['capex', 1],
		['custom', 1],
		['tax', 1],
		['insurance', 1],
		['hoa', 1],
		['utilities', 1]
	] as const)('%s -> %i', (kind, base) => {
		expect(lineBaseCents(kind, c)).toBe(base);
	});
});

describe('lineMonthlyCents', () => {
	test('management 8% of collected income', () => {
		expect(
			lineMonthlyCents(
				{ id: 'm', kind: 'management', name: 'Property management', unit: 'pct', bps: 800 },
				ctx
			)
		).toBe(15_200);
	});
	test('blank amounts count as 0', () => {
		expect(
			lineMonthlyCents(
				{ id: 't', kind: 'tax', name: 'Property tax', unit: 'usd', cents: null },
				ctx
			)
		).toBe(0);
		expect(
			lineMonthlyCents(
				{ id: 'c', kind: 'capex', name: 'Capital reserves', unit: 'pct', bps: null },
				ctx
			)
		).toBe(0);
	});
	test('usd lines are taken as-is', () => {
		expect(
			lineMonthlyCents({ id: 'h', kind: 'hoa', name: 'HOA dues', unit: 'usd', cents: 25_000 }, ctx)
		).toBe(25_000);
	});
});

describe('convertExpenseUnit', () => {
	const mgmt: ExpenseLine = {
		id: 'management',
		kind: 'management',
		name: 'Property management',
		unit: 'pct',
		bps: 800
	};
	test('pct -> usd uses the line base', () => {
		expect(convertExpenseUnit(mgmt, 'usd', ctx)).toEqual({
			id: 'management',
			kind: 'management',
			name: 'Property management',
			unit: 'usd',
			cents: 15_200
		});
	});
	test('usd -> pct', () => {
		const maint: ExpenseLine = {
			id: 'maintenance',
			kind: 'maintenance',
			name: 'Maintenance',
			unit: 'usd',
			cents: 10_000
		};
		expect(convertExpenseUnit(maint, 'pct', ctx)).toMatchObject({ unit: 'pct', bps: 500 });
	});
	test('usd -> pct with a zero base is blank', () => {
		const maint: ExpenseLine = {
			id: 'maintenance',
			kind: 'maintenance',
			name: 'Maintenance',
			unit: 'usd',
			cents: 10_000
		};
		const zero: LineContext = { rentCents: 0, gsiCents: 0, egiCents: 0 };
		expect(convertExpenseUnit(maint, 'pct', zero)).toMatchObject({ unit: 'pct', bps: null });
	});
	test('null amounts stay null both ways', () => {
		expect(
			convertExpenseUnit(
				{ id: 't', kind: 'tax', name: 'Property tax', unit: 'usd', cents: null },
				'pct',
				ctx
			)
		).toMatchObject({ unit: 'pct', bps: null });
		expect(convertExpenseUnit({ ...mgmt, bps: null }, 'usd', ctx)).toMatchObject({
			unit: 'usd',
			cents: null
		});
	});
	test('same unit returns an equal copy', () => {
		const out = convertExpenseUnit(mgmt, 'pct', ctx);
		expect(out).toEqual(mgmt);
		expect(out).not.toBe(mgmt);
	});
	test('round trips keep the monthly dollars within 1 cent', () => {
		const contexts: LineContext[] = [
			ctx,
			{ rentCents: 177_777, gsiCents: 187_777, egiCents: 181_524 },
			{ rentCents: 1_234_567, gsiCents: 1_234_567, egiCents: 1_100_000 }
		];
		for (const c of contexts) {
			for (const kind of ['vacancy', 'management', 'maintenance', 'custom'] as const) {
				for (const bps of [0, 1, 333, 500, 777, 1250, 2000]) {
					const line: ExpenseLine = { id: kind, kind, name: kind, unit: 'pct', bps };
					const before = lineMonthlyCents(line, c);
					const asUsd = convertExpenseUnit(line, 'usd', c);
					expect(lineMonthlyCents(asUsd, c)).toBe(before);
					const back = convertExpenseUnit(asUsd, 'pct', c);
					expect(Math.abs(lineMonthlyCents(back, c) - before)).toBeLessThanOrEqual(1);
				}
			}
		}
		const usd: ExpenseLine = {
			id: 'u',
			kind: 'maintenance',
			name: 'M',
			unit: 'usd',
			cents: 10_000
		};
		const there = convertExpenseUnit(usd, 'pct', ctx);
		expect(lineMonthlyCents(convertExpenseUnit(there, 'usd', ctx), ctx)).toBe(10_000);
	});
});

describe('validateDealInputs', () => {
	test('valid default inputs have no errors', () => {
		expect(validateDealInputs(validInputs())).toEqual([]);
	});
	test('all-cash inputs are valid', () => {
		expect(validateDealInputs({ ...validInputs(), financing: { kind: 'cash' } })).toEqual([]);
	});

	const errorsFor = (mutate: (d: DealInputs) => void) => {
		const d = validInputs();
		mutate(d);
		return validateDealInputs(d);
	};
	const mortgage = (d: DealInputs) => {
		if (d.financing.kind !== 'mortgage') throw new Error('expected mortgage');
		return d.financing;
	};

	test('down payment above 100%', () => {
		expect(errorsFor((d) => (mortgage(d).downBps = 10001))).toContainEqual({
			field: 'financing.downBps',
			error: 'out-of-range'
		});
	});
	test('rate above 25%', () => {
		expect(errorsFor((d) => (mortgage(d).annualRatePct = 25.5))).toContainEqual({
			field: 'financing.annualRatePct',
			error: 'out-of-range'
		});
	});
	test('blank rate is allowed', () => {
		expect(errorsFor((d) => (mortgage(d).annualRatePct = null))).toEqual([]);
	});
	test.each([0, 41])('term %i years', (years) => {
		expect(errorsFor((d) => (mortgage(d).termYears = years))).toContainEqual({
			field: 'financing.termYears',
			error: 'out-of-range'
		});
	});
	test('negative rent', () => {
		expect(errorsFor((d) => (d.rentCents = -1))).toContainEqual({
			field: 'rentCents',
			error: 'negative'
		});
	});
	test('price above the cap', () => {
		expect(errorsFor((d) => (d.priceCents = MAX_CENTS + 1))).toContainEqual({
			field: 'priceCents',
			error: 'too-large'
		});
	});
	test('percent line above 100%', () => {
		expect(
			errorsFor((d) => {
				d.expenses[2] = { ...d.expenses[2], unit: 'pct', bps: 10001 } as ExpenseLine;
			})
		).toContainEqual({ field: 'expenses.maintenance', error: 'out-of-range' });
	});
	test('closing percent above 100%', () => {
		expect(errorsFor((d) => (d.closing = { unit: 'pct', bps: 10001 }))).toContainEqual({
			field: 'closing',
			error: 'out-of-range'
		});
	});
	test('13 custom lines', () => {
		expect(
			errorsFor((d) => {
				for (let i = 0; i < 13; i++)
					d.expenses.push({ id: `c${i}`, kind: 'custom', name: 'Other', unit: 'usd', cents: 100 });
			})
		).toContainEqual({ field: 'expenses', error: 'too-many-lines' });
	});
	test('12 custom lines are fine', () => {
		expect(
			errorsFor((d) => {
				for (let i = 0; i < 12; i++)
					d.expenses.push({ id: `c${i}`, kind: 'custom', name: 'Other', unit: 'usd', cents: 100 });
			})
		).toEqual([]);
	});
	test('a missing default kind', () => {
		expect(
			errorsFor((d) => (d.expenses = d.expenses.filter((l) => l.kind !== 'tax')))
		).toContainEqual({ field: 'expenses.tax', error: 'missing-line' });
	});
	test('non-integer cents are out of range', () => {
		expect(errorsFor((d) => (d.rentCents = 1.5))).toContainEqual({
			field: 'rentCents',
			error: 'out-of-range'
		});
	});
});

describe('definitions', () => {
	test('verbatim UI-SPEC wording', () => {
		expect(METRIC_DEFINITIONS).toEqual({
			cashFlow: {
				label: 'Monthly cash flow',
				resultsLabel: 'Monthly cash flow',
				definition: "What's left each month after operating expenses and the loan payment."
			},
			coc: {
				label: 'Cash-on-cash return',
				resultsLabel: 'Cash-on-cash return',
				definition:
					'A year of cash flow divided by the cash you put in: down payment, closing costs, and repairs.'
			},
			capRate: {
				label: 'Cap rate',
				resultsLabel: 'Cap rate',
				definition: 'A year of NOI divided by the purchase price. It leaves out financing.'
			},
			noi: {
				label: 'Net operating income (NOI)',
				resultsLabel: 'Net operating income (NOI), annual',
				definition:
					'A year of rent and other income, minus vacancy and operating expenses, before the loan payment.'
			},
			dscr: {
				label: 'Debt service coverage ratio (DSCR)',
				resultsLabel: 'Debt service coverage ratio (DSCR)',
				definition:
					"NOI divided by a year of loan payments. Below 1.00 means the income doesn't cover the loan."
			},
			grm: {
				label: 'Gross rent multiplier (GRM)',
				resultsLabel: 'Gross rent multiplier (GRM)',
				definition:
					'Purchase price divided by a year of rent. A lower number means fewer years of rent to equal the price.'
			},
			onePct: {
				label: '1% rule',
				resultsLabel: '1% rule',
				definition:
					'Monthly rent as a percent of the purchase price. The rule of thumb checks whether it reaches 1%.'
			}
		});
	});
	test('conventions cover the five decisions', () => {
		expect(Object.keys(CONVENTIONS).sort()).toEqual(
			['capexInOpex', 'dscrFlavor', 'managementBase', 'rounding', 'vacancyBase'].sort()
		);
		for (const s of Object.values(CONVENTIONS)) expect(s.length).toBeGreaterThan(20);
	});
});
