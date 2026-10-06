// Print model (07-19, INV-06): every table and sentence on /print/memo/ comes from these tested
// functions, built from the saved deal and the pure analyzer.
import { describe, expect, test } from 'vitest';
import { analyze, METRIC_DEFINITIONS, REFERENCE_CASES, type DealInputs } from '@tran/core/finance';
import type { DealRecord, DealSources } from '../deals/schema';
import {
	inputTables,
	keyFigures,
	PRINT_DISCLAIMER,
	PRINT_DISCLAIMER_FULL,
	PRINT_SAMPLE_SENTENCE,
	printTitle,
	provenanceSentence
} from './print-model';

const A = REFERENCE_CASES.find((c) => c.id === 'A')!;
const OCT_1 = Date.UTC(2026, 9, 1);
const SEP_28 = Date.UTC(2026, 8, 28);

function dealFrom(inputs: DealInputs = A.inputs, sources: DealSources = {}): DealRecord {
	return {
		id: 'deal-a',
		ownerId: 'local',
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		schemaVersion: 1,
		analyzerVersion: 1,
		name: 'Sample deal',
		address: '12 Example St',
		propertyType: 'single-family',
		bedrooms: 3,
		bathrooms: 2,
		squareFeet: 1400,
		inputs,
		sources
	};
}

describe('constants', () => {
	test('short disclaimer, closing block and sample sentence are the UI-SPEC strings', () => {
		expect(PRINT_DISCLAIMER).toBe('Not investment, legal, or tax advice.');
		expect(PRINT_DISCLAIMER_FULL).toBe(
			'This memo was prepared with Tran Real Estate Tools, a software tool. It is not investment, legal, or tax advice, and Tran is not a real estate brokerage. The figures are arithmetic on the inputs listed above. Rent and value estimates are automated estimates from RentCast, not professional valuations, and they can be wrong. The memo text was drafted with AI from those figures and reviewed by the person who printed it. Verify every figure before you rely on it.'
		);
		expect(PRINT_SAMPLE_SENTENCE).toBe(
			'Sample data: the property, the estimates, and the figures in this printout are made up.'
		);
	});
});

describe('keyFigures', () => {
	test('reference case A: cash flow first, then the results-panel order', () => {
		const rows = keyFigures(analyze(A.inputs));
		expect(rows.map((r) => [r.metric, r.figure])).toEqual([
			['Monthly cash flow', '$184'],
			['Cash-on-cash return', '4.8%'],
			['Cap rate', '7.5%'],
			['Net operating income (NOI), annual', '$14,976'],
			['Debt service coverage ratio (DSCR)', '1.17'],
			['Gross rent multiplier (GRM)', '8.3'],
			['1% rule', '1.00%']
		]);
		expect(rows[0].meaning).toBe(METRIC_DEFINITIONS.cashFlow.definition);
		expect(rows[6].meaning).toBe(METRIC_DEFINITIONS.onePct.definition);
	});

	test('null metrics show an em dash and the reason words', () => {
		const cash: DealInputs = { ...A.inputs, financing: { kind: 'cash' } };
		const dscr = keyFigures(analyze(cash)).find((r) => r.metric.startsWith('Debt service'))!;
		expect(dscr.figure).toBe('— No loan');
		const noRate: DealInputs = {
			...A.inputs,
			financing: { kind: 'mortgage', downBps: 2000, annualRatePct: null, termYears: 30 }
		};
		expect(keyFigures(analyze(noRate))[0].figure).toBe('— Needs interest rate');
	});
});

describe('inputTables', () => {
	test('mortgage purchase rows with amounts and sources', () => {
		const deal = dealFrom(A.inputs, { price: { source: 'listing', fetchedAt: SEP_28 } });
		const t = inputTables(deal, analyze(deal.inputs));
		expect(t.purchase).toEqual([
			{ item: 'Purchase price', amount: '$200,000', source: 'From listing' },
			{ item: 'Closing costs', amount: '$6,000', source: 'You' },
			{ item: 'Repairs', amount: '$0', source: 'You' },
			{ item: 'Payment method', amount: 'Mortgage', source: 'You' },
			{ item: 'Down payment', amount: '20% ($40,000)', source: 'You' },
			{ item: 'Interest rate', amount: '7%', source: 'You' },
			{ item: 'Loan term', amount: '30 years', source: 'You' },
			{ item: 'Loan amount', amount: '$160,000', source: 'Calculated' },
			{ item: 'Monthly loan payment', amount: '$1,064', source: 'Calculated' }
		]);
	});

	test('all cash omits the loan rows', () => {
		const deal = dealFrom({ ...A.inputs, financing: { kind: 'cash' } });
		const t = inputTables(deal, analyze(deal.inputs));
		expect(t.purchase.map((r) => r.item)).toEqual([
			'Purchase price',
			'Closing costs',
			'Repairs',
			'Payment method'
		]);
		expect(t.purchase[3].amount).toBe('All cash');
	});

	test('income rows carry the rent source word', () => {
		for (const [source, word] of [
			['rentcast', 'RentCast estimate'],
			['sample', 'Sample data'],
			['listing', 'From listing'],
			['edited', 'You']
		] as const) {
			const deal = dealFrom(A.inputs, { rent: { source } });
			const t = inputTables(deal, analyze(deal.inputs));
			expect(t.income).toEqual([
				{ item: 'Monthly rent', amount: '$2,000', source: word },
				{ item: 'Other monthly income', amount: '$0', source: 'You' }
			]);
		}
		const none = inputTables(dealFrom(), analyze(A.inputs));
		expect(none.income[0].source).toBe('You');
	});

	test('expense rows: entered as a percent of rent or dollars per month, plus the total', () => {
		const t = inputTables(dealFrom(), analyze(A.inputs));
		expect(t.expenses[0]).toEqual({
			name: 'Vacancy allowance',
			enteredAs: '5% of rent',
			monthly: '$100',
			source: 'You'
		});
		expect(t.expenses.find((e) => e.name === 'Property management')).toMatchObject({
			enteredAs: '8% of collected rent',
			monthly: '$152'
		});
		expect(t.expenses.find((e) => e.name === 'Property tax')).toMatchObject({
			enteredAs: '$ per month',
			monthly: '$200'
		});
		expect(t.expensesTotal).toBe('$752');
	});
});

describe('provenanceSentence', () => {
	test('RentCast rent estimate with its as-of date and comparables', () => {
		const deal = dealFrom(A.inputs, { rent: { source: 'rentcast', fetchedAt: OCT_1, comps: 8 } });
		const s = provenanceSentence(deal, null);
		expect(s).toContain('Rent estimate from RentCast as of Oct 1, 2026, based on 8 comparables.');
		expect(s).toContain('All other figures were entered by the person who prepared this memo.');
	});

	test('RentCast value estimate and listing details', () => {
		const value = provenanceSentence(
			dealFrom(A.inputs, { price: { source: 'rentcast', fetchedAt: OCT_1, comps: 1 } }),
			null
		);
		expect(value).toContain(
			'Value estimate from RentCast as of Oct 1, 2026, based on 1 comparable.'
		);
		const listing = provenanceSentence(
			dealFrom(A.inputs, { price: { source: 'listing', fetchedAt: SEP_28 } }),
			null
		);
		expect(listing).toBe(
			'Listing details from a RentCast for-sale listing seen Sep 28, 2026. All other figures were entered by the person who prepared this memo.'
		);
	});

	test('sample estimates have no as-of date', () => {
		const s = provenanceSentence(
			dealFrom(A.inputs, { rent: { source: 'sample', fetchedAt: OCT_1, comps: 6 } }),
			null
		);
		expect(s).toContain('Rent estimate from sample data, based on 6 comparables.');
		expect(s).not.toContain('Oct 1');
	});

	test('fully manual deal', () => {
		expect(provenanceSentence(dealFrom(), null)).toBe(
			'All figures were entered by the person who prepared this memo.'
		);
		expect(provenanceSentence(dealFrom(A.inputs, { rent: { source: 'edited' } }), null)).toBe(
			'All figures were entered by the person who prepared this memo.'
		);
	});

	test('memo sentence: provider and model, or sample output', () => {
		expect(
			provenanceSentence(dealFrom(), {
				provider: 'Anthropic',
				model: 'claude-sonnet-5',
				sample: false
			})
		).toBe(
			'All figures were entered by the person who prepared this memo. Memo text drafted with Anthropic claude-sonnet-5.'
		);
		expect(provenanceSentence(dealFrom(), { provider: 'sample', model: '', sample: true })).toBe(
			'All figures were entered by the person who prepared this memo. Memo text is sample output written in advance.'
		);
	});
});

describe('printTitle', () => {
	test('Investment memo - {name} - YYYY-MM-DD', () => {
		expect(printTitle('Sample deal', new Date(Date.UTC(2026, 9, 4)))).toBe(
			'Investment memo - Sample deal - 2026-10-04'
		);
	});
});
