import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { analyze } from './analyze.js';
import { capRateCalc, cashOnCashCalc, dscrCalc } from './calculators.js';
import * as financeIndex from './index.js';

// UI-SPEC "Per-tool inputs and outputs" examples are the oracle. Money is integer cents.
const CAP_EXAMPLE = {
	price: 25_000_000,
	monthlyRent: 200_000,
	otherMonthlyIncome: 0,
	vacancyPct: 5,
	monthlyOpex: 60_000
};

const COC_EXAMPLE = {
	price: 25_000_000,
	downPaymentPct: 25,
	closingCosts: 750_000,
	interestRatePct: 7,
	termYears: 30,
	monthlyRent: 200_000,
	vacancyPct: 5,
	monthlyOpex: 60_000
};

const DSCR_EXAMPLE = {
	monthlyRent: 200_000,
	vacancyPct: 5,
	monthlyOpex: 60_000,
	loanAmount: 18_750_000,
	interestRatePct: 7,
	termYears: 30
};

describe('capRateCalc', () => {
	test('UI-SPEC example: 6.24%, NOI $15,600, EGI $22,800, opex $7,200', () => {
		const r = capRateCalc(CAP_EXAMPLE);
		expect(r.noiYearly).toBe(1560000);
		expect(r.egiYearly).toBe(2280000);
		expect(r.opexYearly).toBe(720000);
		expect(r.capRate).not.toBeNull();
		expect(Math.abs((r.capRate as number) - 0.0624)).toBeLessThan(1e-12);
		expect(r).toStrictEqual({
			capRate: r.capRate,
			noiYearly: 1_560_000,
			egiYearly: 2_280_000,
			opexYearly: 720_000
		});
	});

	test('price 0 gives a null cap rate, never NaN or a throw', () => {
		const r = capRateCalc({ ...CAP_EXAMPLE, price: 0 });
		expect(r.capRate).toBeNull();
		expect(r.noiYearly).toBe(1560000);
	});

	test('other income is added before vacancy', () => {
		const r = capRateCalc({ ...CAP_EXAMPLE, otherMonthlyIncome: 10_000, vacancyPct: 0 });
		expect(r.egiYearly).toBe(2_520_000);
	});

	test('NOI matches Phase 7 analyze() for the same deal (single monthly opex line)', () => {
		const a = analyze({
			priceCents: CAP_EXAMPLE.price,
			closing: { unit: 'usd', cents: 0 },
			repairsCents: 0,
			financing: { kind: 'cash' },
			rentCents: CAP_EXAMPLE.monthlyRent,
			otherIncomeCents: CAP_EXAMPLE.otherMonthlyIncome,
			expenses: [
				{ id: 'v', kind: 'vacancy', name: 'Vacancy', unit: 'pct', bps: 500 },
				{ id: 'o', kind: 'custom', name: 'Operating expenses', unit: 'usd', cents: 60_000 }
			]
		});
		expect(capRateCalc(CAP_EXAMPLE).noiYearly).toBe(a.noiAnnual);
	});
});

describe('cashOnCashCalc', () => {
	test('UI-SPEC example: 0.90%, $631/yr, $53/mo, $70,000 invested, payment 124744', () => {
		const r = cashOnCashCalc(COC_EXAMPLE);
		expect(r.loanAmount).toBe(18750000);
		expect(r.monthlyPayment).toBe(124744);
		expect(r.totalCashInvested).toBe(7000000);
		expect(r.noiYearly).toBe(1560000);
		expect(r.cashFlowYearly).toBe(63072);
		expect(r.cashFlowMonthly).toBe(5256);
		expect(Math.abs((r.cashOnCash as number) - 63072 / 7000000)).toBeLessThan(1e-12);
	});

	test('100% down: no payment, cash flow equals NOI', () => {
		const r = cashOnCashCalc({ ...COC_EXAMPLE, downPaymentPct: 100 });
		expect(r.loanAmount).toBe(0);
		expect(r.monthlyPayment).toBe(0);
		expect(r.cashFlowYearly).toBe(r.noiYearly);
	});

	test('zero total cash invested gives a null cash-on-cash', () => {
		const r = cashOnCashCalc({ ...COC_EXAMPLE, downPaymentPct: 0, closingCosts: 0 });
		expect(r.totalCashInvested).toBe(0);
		expect(r.cashOnCash).toBeNull();
	});

	test('negative cash flow is not clamped', () => {
		const r = cashOnCashCalc({ ...COC_EXAMPLE, monthlyRent: 120_000 });
		expect(r.cashFlowYearly).toBeLessThan(0);
		expect(r.cashOnCash as number).toBeLessThan(0);
		expect(r.cashFlowMonthly).toBeLessThan(0);
	});
});

describe('dscrCalc', () => {
	test('UI-SPEC example: 1.04, debt service 1496928/yr, payment 124744, income left 63072', () => {
		const r = dscrCalc(DSCR_EXAMPLE);
		expect(r.applicable).toBe(true);
		expect(r.monthlyPayment).toBe(124744);
		expect(r.debtServiceYearly).toBe(1496928);
		expect(r.noiYearly).toBe(1560000);
		expect(r.cashAfterDebtYearly).toBe(63072);
		expect(Math.abs((r.dscr as number) - 1560000 / 1496928)).toBeLessThan(1e-12);
	});

	test('a $0 loan is not applicable: dscr null, never a number', () => {
		const r = dscrCalc({ ...DSCR_EXAMPLE, loanAmount: 0 });
		expect(r.applicable).toBe(false);
		expect(r.dscr).toBeNull();
		expect(r.debtServiceYearly).toBe(0);
		expect(r.monthlyPayment).toBe(0);
		expect(r.noiYearly).toBe(1560000);
	});
});

describe('reuse of Phase 7 primitives', () => {
	test('calculators.ts imports monthlyPayment and has no local amortization formula', () => {
		const src = readFileSync(new URL('./calculators.ts', import.meta.url), 'utf8');
		expect(src).toMatch(/import\s*\{[^}]*\bmonthlyPayment\b[^}]*\}\s*from\s*'\.\/amortization\.js'/);
		expect(src).not.toContain('Math.pow');
	});

	test('the finance index exports the calculators', () => {
		expect(financeIndex.capRateCalc).toBe(capRateCalc);
		expect(financeIndex.cashOnCashCalc).toBe(cashOnCashCalc);
		expect(financeIndex.dscrCalc).toBe(dscrCalc);
	});
});
