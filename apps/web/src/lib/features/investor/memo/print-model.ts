// Memo printout model (07-19, INV-06). Every table row and sentence on /print/memo/ is built here
// from the saved deal and the pure analyzer, with the core formatters only (the same strings the
// memo's number check allows), and metric wording from METRIC_DEFINITIONS.
import {
	METRIC_DEFINITIONS,
	type DealAnalysis,
	type ExpenseLine,
	type MetricKey,
	type NullReason
} from '@tran/core/finance';
import { longDate, NOT_AVAILABLE, pct, pctTrim, rateLabel, ratio, usd } from '@tran/core/format';
import type { DealRecord, FieldSource } from '../deals/schema';

export const PRINT_DISCLAIMER = 'Not investment, legal, or tax advice.';
export const PRINT_DISCLAIMER_FULL =
	'This memo was prepared with Tran Real Estate Tools, a software tool. It is not investment, legal, or tax advice, and Tran is not a real estate brokerage. The figures are arithmetic on the inputs listed above. Rent and value estimates are automated estimates from RentCast, not professional valuations, and they can be wrong. The memo text was drafted with AI from those figures and reviewed by the person who printed it. Verify every figure before you rely on it.';
export const PRINT_SAMPLE_SENTENCE =
	'Sample data: the property, the estimates, and the figures in this printout are made up.';
export const PRINT_NO_MEMO_NOTE =
	'This printout has no memo, only the analysis. To include one, draft a memo first.';

export interface KeyFigure {
	metric: string;
	figure: string;
	meaning: string;
}
export interface Row {
	item: string;
	amount: string;
	source: string;
}
export interface ExpenseRow {
	name: string;
	enteredAs: string;
	monthly: string;
	source: string;
}

/** Same words as the analyzer results panel. */
const REASON: Record<NullReason, string> = {
	'no-loan': 'No loan',
	'no-cash-invested': 'No cash invested',
	'needs-interest-rate': 'Needs interest rate',
	'no-rent': 'Needs monthly rent',
	'no-price': 'Needs purchase price'
};
const NOT_ENTERED = 'Not entered';
const YOU = 'You';
const CALCULATED = 'Calculated';
const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const orReason = <T>(v: T | null, r: NullReason | undefined, fmt: (v: T) => string): string =>
	v === null ? `${NOT_AVAILABLE} ${REASON[r ?? 'no-price']}` : fmt(v);

/** Key figures, cash flow first, then the results-panel order. */
export function keyFigures(a: DealAnalysis): KeyFigure[] {
	const row = (key: MetricKey, figure: string): KeyFigure => ({
		metric: METRIC_DEFINITIONS[key].resultsLabel,
		figure,
		meaning: METRIC_DEFINITIONS[key].definition
	});
	return [
		row('cashFlow', orReason(a.cashFlowMonthly, a.reasons.cashFlow, usd)),
		row(
			'coc',
			orReason(a.cocPct, a.reasons.coc, (v) => pct(v, 1))
		),
		row(
			'capRate',
			orReason(a.capRatePct, a.reasons.capRate, (v) => pct(v, 1))
		),
		row('noi', usd(a.noiAnnual)),
		row(
			'dscr',
			orReason(a.dscr, a.reasons.dscr, (v) => ratio(v, 2))
		),
		row(
			'grm',
			orReason(a.grm, a.reasons.grm, (v) => ratio(v, 1))
		),
		row(
			'onePct',
			orReason(a.rentToPricePct, a.reasons.rentToPrice, (v) => pct(v, 2))
		)
	];
}

/** "RentCast estimate" · "Sample data" · "From listing" · "You". */
export function sourceWord(s: FieldSource | undefined): string {
	switch (s?.source) {
		case 'rentcast':
			return 'RentCast estimate';
		case 'sample':
			return 'Sample data';
		case 'listing':
			return 'From listing';
		default:
			return YOU;
	}
}

function enteredAs(line: ExpenseLine, hasOtherIncome: boolean): string {
	if (line.unit === 'usd') return line.cents === null ? NOT_ENTERED : '$ per month';
	if (line.bps === null) return NOT_ENTERED;
	const base =
		line.kind === 'vacancy'
			? hasOtherIncome
				? 'of rent and other income'
				: 'of rent'
			: line.kind === 'management'
				? 'of collected rent'
				: 'of rent';
	return `${pctTrim(line.bps)} ${base}`;
}

const blank = (line: ExpenseLine) => (line.unit === 'usd' ? line.cents : line.bps) === null;

export function inputTables(
	deal: DealRecord,
	a: DealAnalysis
): { purchase: Row[]; income: Row[]; expenses: ExpenseRow[]; expensesTotal: string } {
	const { inputs } = deal;
	const purchase: Row[] = [
		{
			item: 'Purchase price',
			amount: usd(inputs.priceCents),
			source: sourceWord(deal.sources.price)
		},
		{
			item: 'Closing costs',
			amount:
				inputs.closing.unit === 'pct'
					? `${pctTrim(inputs.closing.bps)} (${usd(a.closingCents)})`
					: usd(a.closingCents),
			source: YOU
		},
		{ item: 'Repairs', amount: usd(a.repairsCents), source: YOU }
	];
	const f = inputs.financing;
	if (f.kind === 'cash') {
		purchase.push({ item: 'Payment method', amount: 'All cash', source: YOU });
	} else {
		purchase.push(
			{ item: 'Payment method', amount: 'Mortgage', source: YOU },
			{
				item: 'Down payment',
				amount: `${pctTrim(f.downBps)} (${usd(a.downPaymentCents)})`,
				source: YOU
			},
			{
				item: 'Interest rate',
				amount: f.annualRatePct === null ? NOT_ENTERED : rateLabel(f.annualRatePct),
				source: YOU
			},
			{
				item: 'Loan term',
				amount: `${COUNT.format(f.termYears)} year${f.termYears === 1 ? '' : 's'}`,
				source: YOU
			},
			{ item: 'Loan amount', amount: usd(a.loanCents), source: CALCULATED },
			{
				item: 'Monthly loan payment',
				amount: orReason(a.paymentMonthly, a.reasons.payment, usd),
				source: CALCULATED
			}
		);
	}
	const income: Row[] = [
		{ item: 'Monthly rent', amount: usd(inputs.rentCents), source: sourceWord(deal.sources.rent) },
		{ item: 'Other monthly income', amount: usd(inputs.otherIncomeCents), source: YOU }
	];
	const hasOther = inputs.otherIncomeCents > 0;
	const expenses: ExpenseRow[] = inputs.expenses.map((line, i) => ({
		name: line.name.replace(/\s+/g, ' ').trim() || 'Other expense',
		enteredAs: enteredAs(line, hasOther),
		monthly: blank(line) ? NOT_ENTERED : usd(a.lines[i]?.monthlyCents ?? 0),
		source: YOU
	}));
	return { purchase, income, expenses, expensesTotal: usd(a.expensesInclVacancyMonthly) };
}

function estimateSentence(kind: 'Rent' | 'Value', s: FieldSource): string | null {
	if (s.source !== 'rentcast' && s.source !== 'sample') return null;
	let out = `${kind} estimate from ${s.source === 'rentcast' ? 'RentCast' : 'sample data'}`;
	// Sample data is a synthetic fixture: an "as of" date would be meaningless.
	if (s.source === 'rentcast' && s.fetchedAt !== undefined)
		out += ` as of ${longDate(s.fetchedAt)}`;
	if (s.comps !== undefined && Number.isInteger(s.comps) && s.comps > 0)
		out += `, based on ${COUNT.format(s.comps)} comparable${s.comps === 1 ? '' : 's'}`;
	return `${out}.`;
}

/**
 * The "Data sources" sentence: where each fetched figure came from and when (the data's own
 * dates), then who entered the rest, then how the memo text was written.
 */
export function provenanceSentence(
	deal: DealRecord,
	memo: { provider: string; model: string; sample: boolean } | null
): string {
	const parts: string[] = [];
	const { rent, price } = deal.sources;
	const rentLine = rent && estimateSentence('Rent', rent);
	if (rentLine) parts.push(rentLine);
	const valueLine = price && estimateSentence('Value', price);
	if (valueLine) parts.push(valueLine);
	const listing =
		price?.source === 'listing'
			? price
			: Object.values(deal.sources).find((s) => s?.source === 'listing');
	if (listing) {
		parts.push(
			listing.fetchedAt !== undefined
				? `Listing details from a RentCast for-sale listing seen ${longDate(listing.fetchedAt)}.`
				: 'Listing details from a RentCast for-sale listing.'
		);
	}
	parts.push(
		parts.length > 0
			? 'All other figures were entered by the person who prepared this memo.'
			: 'All figures were entered by the person who prepared this memo.'
	);
	if (memo) {
		parts.push(
			memo.sample
				? 'Memo text is sample output written in advance.'
				: `Memo text drafted with ${memo.provider} ${memo.model}.`
		);
	}
	return parts.join(' ');
}

/** True when any figure in the deal comes from the keyless sample data. */
export function dealIsSample(deal: DealRecord): boolean {
	return Object.values(deal.sources).some((s) => s?.source === 'sample');
}

/** "Investment memo - {deal name} - YYYY-MM-DD" (UTC calendar date, like every printed date). */
export function printTitle(dealName: string, at: Date): string {
	const name = dealName.replace(/\s+/g, ' ').trim() || 'Untitled deal';
	return `Investment memo - ${name} - ${at.toISOString().slice(0, 10)}`;
}
