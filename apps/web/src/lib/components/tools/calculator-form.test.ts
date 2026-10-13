import { describe, expect, it } from 'vitest';
import { TOOLS, type ToolField } from '$lib/content/tools';
import {
	capRateCalc,
	cashOnCashCalc,
	dscrCalc,
	toolMoney,
	toolPercent,
	toolRatio,
	type CapRateInput,
	type CashOnCashInput,
	type DscrInput
} from '@tran/core/finance';
import {
	errorMessage,
	fillAnnouncement,
	isExample,
	markNegative,
	parseAll
} from './calculator-form.svelte';

const CAP = TOOLS['cap-rate'].fields;
const CASH = TOOLS['cash-on-cash'].fields;
const field = (fields: readonly ToolField[], id: string): ToolField => {
	const f = fields.find((x) => x.id === id);
	if (!f) throw new Error(`no field ${id}`);
	return f;
};
const PRICE = field(CAP, 'price');
const TERM = field(CASH, 'termYears');
const RATE = field(CASH, 'interestRatePct');

const examples = (fields: readonly ToolField[]) =>
	Object.fromEntries(fields.map((f) => [f.id, f.example]));

describe('errorMessage', () => {
	it('maps every validation code to the UI-SPEC copy', () => {
		expect(errorMessage(PRICE, { ok: false, code: 'required' })).toBe('Enter purchase price.');
		expect(errorMessage(PRICE, { ok: false, code: 'nan' })).toBe('Use numbers only, like 250,000.');
		expect(errorMessage(TERM, { ok: false, code: 'min', min: 1 })).toBe('Enter 1 or more.');
		expect(errorMessage(PRICE, { ok: false, code: 'max', max: 100_000_000 })).toBe(
			'Enter $100,000,000 or less.'
		);
		expect(errorMessage(RATE, { ok: false, code: 'max', max: 30 })).toBe('Enter 30 or less.');
		expect(errorMessage(PRICE, { ok: false, code: 'price-zero' })).toBe(
			'Enter a purchase price above $0.'
		);
	});

	it('formats a money minimum in dollars', () => {
		expect(errorMessage(PRICE, { ok: false, code: 'min', min: 0 })).toBe('Enter $0 or more.');
	});
});

describe('parseAll', () => {
	it('parses the cap-rate example into cents and percents', () => {
		expect(parseAll(CAP, examples(CAP))).toEqual({
			ok: true,
			values: {
				price: 25_000_000,
				monthlyRent: 200_000,
				otherMonthlyIncome: 0,
				vacancyPct: 5,
				monthlyOpex: 60_000
			}
		});
	});

	it('treats a blank optional field as 0', () => {
		const v = { ...examples(CAP), otherMonthlyIncome: '' };
		const r = parseAll(CAP, v);
		expect(r.ok && r.values.otherMonthlyIncome).toBe(0);
	});

	it('lists every blank or invalid field as missing, in field order', () => {
		const v = { ...examples(CAP), price: '', vacancyPct: 'abc' };
		expect(parseAll(CAP, v)).toEqual({ ok: false, missing: ['price', 'vacancyPct'] });
	});

	it('is not ok for an all-empty form', () => {
		const empty = Object.fromEntries(CASH.map((f) => [f.id, '']));
		const r = parseAll(CASH, empty);
		expect(r.ok).toBe(false);
	});

	it('rejects a zero purchase price', () => {
		expect(parseAll(CAP, { ...examples(CAP), price: '0' })).toEqual({
			ok: false,
			missing: ['price']
		});
	});
});

describe('isExample', () => {
	it('is true exactly when every value equals its example', () => {
		expect(isExample(CAP, examples(CAP))).toBe(true);
		expect(isExample(CAP, { ...examples(CAP), price: '250,001' })).toBe(false);
		expect(isExample(CAP, Object.fromEntries(CAP.map((f) => [f.id, ''])))).toBe(false);
	});
});

describe('fillAnnouncement', () => {
	it('replaces both placeholders and keeps the text around them', () => {
		expect(
			fillAnnouncement('Cap rate {x}%. Net operating income {y} a year.', '6.24', '$15,600')
		).toBe('Cap rate 6.24%. Net operating income $15,600 a year.');
	});

	it('does not double a percent sign already in the template', () => {
		expect(fillAnnouncement('Cap rate {x}%. NOI {y} a year.', '6.24%', '$15,600')).toBe(
			'Cap rate 6.24%. NOI $15,600 a year.'
		);
	});

	it('fills a ratio template that has no percent sign', () => {
		expect(fillAnnouncement('DSCR {x}. Net operating income {y} a year.', '1.04', '$15,600')).toBe(
			'DSCR 1.04. Net operating income $15,600 a year.'
		);
	});
});

describe('markNegative', () => {
	it('adds the word "(negative)" to a U+2212 value and leaves others alone', () => {
		expect(markNegative('\u2212$53')).toBe('\u2212$53 (negative)');
		expect(markNegative('$53')).toBe('$53');
		expect(markNegative('\u22120.50%')).toBe('\u22120.50% (negative)');
	});
});

// The UI-SPEC "Per-tool inputs and outputs" example figures, through the same path the
// components use: example strings -> parseAll -> core calculator -> tool formatters.
describe('Fill in an example figures', () => {
	const parsedExample = (fields: readonly ToolField[]) => {
		const r = parseAll(fields, examples(fields));
		if (!r.ok) throw new Error(`example invalid: ${r.missing.join(', ')}`);
		return r.values;
	};

	it('cap rate 6.24%', () => {
		const r = capRateCalc(parsedExample(CAP) as unknown as CapRateInput);
		expect(toolPercent(r.capRate)).toBe('6.24%');
		expect([r.noiYearly, r.egiYearly, r.opexYearly].map(toolMoney)).toEqual([
			'$15,600',
			'$22,800',
			'$7,200'
		]);
	});

	it('cash-on-cash 0.90%', () => {
		const r = cashOnCashCalc(parsedExample(CASH) as unknown as CashOnCashInput);
		expect(toolPercent(r.cashOnCash)).toBe('0.90%');
		expect(
			[r.cashFlowYearly, r.cashFlowMonthly, r.totalCashInvested, r.monthlyPayment, r.noiYearly].map(
				toolMoney
			)
		).toEqual(['$631', '$53', '$70,000', '$1,247', '$15,600']);
	});

	it('DSCR 1.04', () => {
		const r = dscrCalc(parsedExample(TOOLS.dscr.fields) as unknown as DscrInput);
		expect(r.applicable).toBe(true);
		expect(toolRatio(r.dscr)).toBe('1.04');
		expect(
			[r.noiYearly, r.debtServiceYearly, r.monthlyPayment, r.cashAfterDebtYearly].map(toolMoney)
		).toEqual(['$15,600', '$14,969', '$1,247', '$631']);
	});

	it('DSCR with a $0 loan is not applicable', () => {
		const v = { ...examples(TOOLS.dscr.fields), loanAmount: '0' };
		const p = parseAll(TOOLS.dscr.fields, v);
		expect(p.ok).toBe(true);
		if (p.ok) expect(dscrCalc(p.values as unknown as DscrInput).applicable).toBe(false);
	});
});
