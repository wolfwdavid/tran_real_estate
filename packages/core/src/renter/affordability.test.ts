import { describe, expect, it } from 'vitest';
import {
	affordability,
	floor25,
	landlordIncome,
	moveInCash,
	parseMoneyInput,
	rentFeedback,
	round25,
	sliderMax
} from './affordability';

describe('parseMoneyInput', () => {
	it('parses plain and formatted amounts', () => {
		expect(parseMoneyInput('60,000')).toBe(60000);
		expect(parseMoneyInput('$1,200.50')).toBe(1200.5);
		expect(parseMoneyInput(' 72000 ')).toBe(72000);
		expect(parseMoneyInput('0')).toBe(0);
		expect(parseMoneyInput('.5')).toBe(0.5);
	});

	it('empty input is null (no value yet)', () => {
		expect(parseMoneyInput('')).toBeNull();
		expect(parseMoneyInput('   ')).toBeNull();
	});

	it('non-numeric input is an invalid error, never NaN', () => {
		expect(parseMoneyInput('abc')).toEqual({ error: 'invalid' });
		expect(parseMoneyInput('1.2.3')).toEqual({ error: 'invalid' });
		expect(parseMoneyInput('12abc')).toEqual({ error: 'invalid' });
		expect(parseMoneyInput('$')).toEqual({ error: 'invalid' });
		expect(parseMoneyInput('1e5')).toEqual({ error: 'invalid' });
	});

	it('negative input is a negative error', () => {
		expect(parseMoneyInput('-5')).toEqual({ error: 'negative' });
		expect(parseMoneyInput('-$1,000')).toEqual({ error: 'negative' });
	});
});

describe('round25 / floor25', () => {
	it('round25 rounds to the nearest 25, ties up', () => {
		expect(round25(1512)).toBe(1500);
		expect(round25(1513)).toBe(1525);
		expect(round25(1512.5)).toBe(1525);
	});

	it('floor25 floors to 25', () => {
		expect(floor25(2524)).toBe(2500);
		expect(floor25(2525)).toBe(2525);
	});
});

describe('affordability', () => {
	const base = { income: 72000, period: 'year' as const, debts: 0, savings: 0 };

	it('yearly income with no debts', () => {
		expect(affordability(base)).toEqual({
			monthlyIncome: 6000,
			pct25: 1500,
			pct30: 1800,
			debtCheck: 2400,
			low: 1500,
			high: 1800,
			onlyTop: false,
			debtsNote: false,
			savingsCoverRentUpTo: 0
		});
	});

	it('debts 400 lower the debt check but 30% stays the top', () => {
		const r = affordability({ ...base, debts: 400 })!;
		expect(r.debtCheck).toBe(2000);
		expect(r.high).toBe(1800);
		expect(r.onlyTop).toBe(false);
		expect(r.debtsNote).toBe(false);
	});

	it('debts 1200 push the top below the bottom: onlyTop and debtsNote', () => {
		const r = affordability({ ...base, debts: 1200 })!;
		expect(r.debtCheck).toBe(1200);
		expect(r.high).toBe(1200);
		expect(r.low).toBe(1500);
		expect(r.onlyTop).toBe(true);
		expect(r.debtsNote).toBe(true);
	});

	it('debts 3000 floor the debt check at 0', () => {
		const r = affordability({ ...base, debts: 3000 })!;
		expect(r.debtCheck).toBe(0);
		expect(r.high).toBe(0);
		expect(r.onlyTop).toBe(true);
	});

	it('debt check exactly equal to 25% is not the debts note', () => {
		// 0.40 * 6000 - 900 = 1500 = pct25
		const r = affordability({ ...base, debts: 900 })!;
		expect(r.debtCheck).toBe(1500);
		expect(r.debtsNote).toBe(false);
		expect(r.onlyTop).toBe(false);
	});

	it('no income yet returns null', () => {
		expect(affordability({ ...base, income: 0 })).toBeNull();
		expect(affordability({ ...base, income: null })).toBeNull();
		expect(affordability({ ...base, income: Number.NaN })).toBeNull();
		expect(affordability({ ...base, income: -100 })).toBeNull();
	});

	it('monthly period uses income as-is', () => {
		expect(affordability({ ...base, income: 6000, period: 'month' })!.monthlyIncome).toBe(6000);
	});

	it('savings cover move-in cash for rent up to savings / 2, floored to 25', () => {
		expect(affordability({ ...base, savings: 5000 })!.savingsCoverRentUpTo).toBe(2500);
		expect(affordability({ ...base, savings: 5040 })!.savingsCoverRentUpTo).toBe(2500);
	});
});

describe('rentFeedback', () => {
	it('within the guideline', () => {
		expect(rentFeedback(1650, 6000, 400)).toEqual({ kind: 'within', rentPct: 28, totalPct: 34 });
	});

	it('above 30%', () => {
		expect(rentFeedback(2000, 6000, 400)).toEqual({ kind: 'above30', rentPct: 33, totalPct: 40 });
	});

	it('above the 40% debt check', () => {
		expect(rentFeedback(2100, 6000, 400)).toEqual({
			kind: 'aboveDebt',
			rentPct: 35,
			totalPct: 42
		});
	});

	it('exactly 30% is within', () => {
		expect(rentFeedback(1800, 6000, 0).kind).toBe('within');
	});

	it('exactly 40% total is not aboveDebt', () => {
		expect(rentFeedback(1800, 6000, 600).kind).toBe('within');
		expect(rentFeedback(2000, 6000, 400).kind).toBe('above30');
	});

	it('compares unrounded ratios (30.4% rounds to 30 but is above 30%)', () => {
		const r = rentFeedback(1824, 6000, 0);
		expect(r.rentPct).toBe(30);
		expect(r.kind).toBe('above30');
	});
});

describe('landlord and move-in lines', () => {
	it('landlord 40x line', () => {
		expect(landlordIncome(1800)).toBe(72000);
	});

	it('move-in cash is two months', () => {
		expect(moveInCash(1800)).toBe(3600);
	});
});

describe('sliderMax', () => {
	it('is at least 10,000', () => {
		expect(sliderMax(1800)).toBe(10000);
		expect(sliderMax(0)).toBe(10000);
	});

	it('is twice the top when that exceeds 10,000', () => {
		expect(sliderMax(6000)).toBe(12000);
	});

	it('rounds up to the next 500', () => {
		expect(sliderMax(5100)).toBe(10500);
		expect(sliderMax(5001)).toBe(10500);
	});
});
