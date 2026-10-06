import { describe, expect, test } from 'vitest';

import { ANALYZER_VERSION, analyze } from './analyze.js';
import { defaultExpenseLines } from './defaults.js';
import { REFERENCE_CASES } from './reference-cases.js';
import type { DealInputs, ExpenseLine } from './types.js';

const caseInputs = (id: string): DealInputs => {
	const c = REFERENCE_CASES.find((r) => r.id === id);
	if (!c) throw new Error(`no case ${id}`);
	return structuredClone(c.inputs);
};

const setUsd = (lines: ExpenseLine[], id: string, cents: number | null): ExpenseLine[] =>
	lines.map((l) =>
		l.id === id ? { id: l.id, kind: l.kind, name: l.name, unit: 'usd', cents } : l
	);

describe('analyze basics', () => {
	test('version is stamped', () => {
		expect(analyze(caseInputs('A')).version).toBe(ANALYZER_VERSION);
		expect(ANALYZER_VERSION).toBe(1);
	});

	test('lines list every line, vacancy included, in input order', () => {
		const a = analyze(caseInputs('A'));
		expect(a.lines.map((l) => l.id)).toEqual([
			'vacancy',
			'management',
			'maintenance',
			'capex',
			'tax',
			'insurance',
			'hoa',
			'utilities'
		]);
		expect(a.lines[0]).toEqual({
			id: 'vacancy',
			kind: 'vacancy',
			name: 'Vacancy allowance',
			monthlyCents: 10_000
		});
		expect(a.expensesInclVacancyMonthly).toBe(a.vacancyMonthly + a.opexMonthly);
	});

	test('custom lines are percent of rent and count in OpEx', () => {
		const d = caseInputs('A');
		d.expenses.push({ id: 'c1', kind: 'custom', name: 'Pest control', unit: 'pct', bps: 100 });
		d.expenses.push({ id: 'c2', kind: 'custom', name: 'Lawn', unit: 'usd', cents: 4_000 });
		const a = analyze(d);
		expect(a.lines.at(-2)?.monthlyCents).toBe(2_000);
		expect(a.opexMonthly).toBe(65_200 + 2_000 + 4_000);
		expect(a.noiMonthly).toBe(124_800 - 6_000);
	});

	test('repairs count toward cash invested', () => {
		const d = caseInputs('A');
		d.repairsCents = 400_000;
		const a = analyze(d);
		expect(a.repairsCents).toBe(400_000);
		expect(a.cashInvestedCents).toBe(5_000_000);
		expect(a.cocPct).toBeCloseTo((220_224 * 100) / 5_000_000, 9);
	});

	test('closing as a percent of price', () => {
		const d = caseInputs('A');
		d.closing = { unit: 'pct', bps: 300 };
		expect(analyze(d).closingCents).toBe(600_000);
	});
});

describe('B all cash equals a 100% down mortgage with a blank rate', () => {
	test('identical analysis', () => {
		const cash = analyze(caseInputs('B'));
		const d = caseInputs('B');
		d.financing = { kind: 'mortgage', downBps: 10000, annualRatePct: null, termYears: 30 };
		const fullDown = analyze(d);
		expect(fullDown).toEqual(cash);
		expect(fullDown.paymentMonthly).toBe(0);
		expect(fullDown.missing).not.toContain('interest-rate');
		expect(fullDown.reasons.dscr).toBe('no-loan');
	});
});

describe('null guards and missing inputs', () => {
	test('blank rate with a loan', () => {
		const d = caseInputs('A');
		d.financing = { kind: 'mortgage', downBps: 2000, annualRatePct: null, termYears: 30 };
		const a = analyze(d);
		expect(a.loanCents).toBe(16_000_000);
		expect(a.paymentMonthly).toBeNull();
		expect(a.cashFlowMonthly).toBeNull();
		expect(a.cashFlowAnnual).toBeNull();
		expect(a.cocPct).toBeNull();
		expect(a.dscr).toBeNull();
		expect(a.reasons).toMatchObject({
			payment: 'needs-interest-rate',
			cashFlow: 'needs-interest-rate',
			coc: 'needs-interest-rate',
			dscr: 'needs-interest-rate'
		});
		expect(a.missing).toContain('interest-rate');
		expect(a.noiMonthly).toBe(124_800);
		expect(a.capRatePct).toBeCloseTo(7.488, 9);
	});

	test('blank tax and insurance are flagged and count as 0', () => {
		const d = caseInputs('A');
		d.expenses = setUsd(setUsd(d.expenses, 'tax', null), 'insurance', null);
		const a = analyze(d);
		expect(a.missing).toEqual(expect.arrayContaining(['property-tax', 'insurance']));
		expect(a.missing).not.toContain('interest-rate');
		expect(a.lines.find((l) => l.id === 'tax')?.monthlyCents).toBe(0);
		expect(a.opexMonthly).toBe(65_200 - 30_000);
	});

	test('only tax blank', () => {
		const d = caseInputs('A');
		d.expenses = setUsd(d.expenses, 'tax', null);
		expect(analyze(d).missing).toEqual(['property-tax']);
	});

	test('the default lines leave tax and insurance missing', () => {
		const d = caseInputs('A');
		d.expenses = defaultExpenseLines();
		expect(analyze(d).missing).toEqual(['property-tax', 'insurance']);
	});

	test('price 0', () => {
		const d = caseInputs('A');
		d.priceCents = 0;
		const a = analyze(d);
		expect(a.capRatePct).toBeNull();
		expect(a.reasons.capRate).toBe('no-price');
		expect(a.rentToPricePct).toBeNull();
		expect(a.reasons.rentToPrice).toBe('no-price');
		expect(a.meetsOnePct).toBe(false);
	});

	test('no cash invested', () => {
		const d = caseInputs('A');
		d.priceCents = 0;
		d.financing = { kind: 'cash' };
		d.closing = { unit: 'usd', cents: 0 };
		const a = analyze(d);
		expect(a.cashInvestedCents).toBe(0);
		expect(a.cocPct).toBeNull();
		expect(a.reasons.coc).toBe('no-cash-invested');
	});

	test('zero rent: GRM null, rent-to-price 0', () => {
		const a = analyze(caseInputs('G'));
		expect(a.grm).toBeNull();
		expect(a.reasons.grm).toBe('no-rent');
		expect(a.rentToPricePct).toBe(0);
	});

	test('1% rule one cent under the boundary fails', () => {
		const d = caseInputs('E');
		d.priceCents = 10_000_001;
		expect(analyze(d).meetsOnePct).toBe(false);
	});
});
