// Memo FACTS (INV-06, RESEARCH Pattern 5). The deal memo model receives ONLY this text: pre-formatted
// analyzer strings plus the user's notes. It narrates, never computes. The allowed-number set for
// the numeric post-check is extracted from exactly this text (plus the notes' own numerals), so a
// memo can only state figures the analyzer produced.
//
// Every value below comes from @tran/core/format (or is a fixed word), never a raw float: the
// post-check parser round-trips exactly those strings. Labels for metric lines come from
// METRIC_DEFINITIONS so the memo, results panel and printout use one wording.

import { longDate, pct, pctTrim, rateLabel, ratio, usd, usdRange } from '../format/index.js';
import { allowedFromText, type AllowedNumber } from '../numbers/index.js';
import { METRIC_DEFINITIONS } from './definitions.js';
import type { DealAnalysis, DealInputs, ExpenseLine, NullReason } from './types.js';

export interface FieldSourceFact {
	source: 'rentcast' | 'sample' | 'listing' | 'you';
	asOf?: number;
	rangeLowCents?: number;
	rangeHighCents?: number;
	comps?: number;
}

export interface MemoFactsInput {
	dealName: string;
	address: string;
	propertyType?: string | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	squareFeet?: number | null;
	inputs: DealInputs;
	analysis: DealAnalysis;
	sources?: { rent?: FieldSourceFact; price?: FieldSourceFact };
	/** At most 1,000 characters (enforced by the UI). */
	notes?: string;
}

export interface MemoFacts {
	factsText: string;
	lines: { label: string; value: string }[];
	notes: string;
	allowed: AllowedNumber[];
}

const NULL_WORDS: Record<NullReason, string> = {
	'no-loan': 'not applicable (no loan)',
	'no-cash-invested': 'not applicable (no cash invested)',
	'needs-interest-rate': 'not available (needs an interest rate)',
	'no-rent': 'not applicable (no rent)',
	'no-price': 'not applicable (no price)'
};
const NOT_ENTERED = 'not entered';

/** Property counts (bedrooms, bathrooms, square feet): grouped, at most one decimal. */
const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** One line of free text: collapses whitespace so a name can never add a FACTS line. */
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

function orWords<T>(
	value: T | null,
	reason: NullReason | undefined,
	fmt: (v: T) => string
): string {
	return value === null ? NULL_WORDS[reason ?? 'no-price'] : fmt(value);
}

function sourceValue(s: FieldSourceFact): string | null {
	if (s.source === 'you') return null;
	if (s.source === 'listing') return 'from the for-sale listing';
	const parts = [s.source === 'rentcast' ? 'RentCast estimate' : 'sample data estimate'];
	// Sample data is a synthetic fixture: an "as of" date would be meaningless.
	if (s.source === 'rentcast' && s.asOf !== undefined && Number.isFinite(s.asOf))
		parts[0] += ` as of ${longDate(s.asOf)}`;
	if (s.rangeLowCents !== undefined && s.rangeHighCents !== undefined) {
		parts.push(`range ${usdRange(s.rangeLowCents, s.rangeHighCents)}`);
	}
	if (s.comps !== undefined && Number.isInteger(s.comps) && s.comps > 0) {
		parts.push(`based on ${COUNT.format(s.comps)} comparable${s.comps === 1 ? '' : 's'}`);
	}
	return parts.join(', ');
}

function expenseValue(line: ExpenseLine, monthlyCents: number, hasOtherIncome: boolean): string {
	if (line.unit === 'usd')
		return line.cents === null ? NOT_ENTERED : `${usd(monthlyCents)} a month`;
	if (line.bps === null) return NOT_ENTERED;
	const base =
		line.kind === 'vacancy'
			? hasOtherIncome
				? 'of rent and other income'
				: 'of rent'
			: line.kind === 'management'
				? 'of collected rent'
				: 'of rent';
	return `${pctTrim(line.bps)} ${base} (${usd(monthlyCents)} a month)`;
}

export function buildMemoFacts(input: MemoFactsInput): MemoFacts {
	const { inputs, analysis: a } = input;
	const lines: { label: string; value: string }[] = [];
	const add = (label: string, value: string) => lines.push({ label, value });
	const M = METRIC_DEFINITIONS;

	if (input.propertyType) add('Property type', oneLine(input.propertyType));
	if (input.bedrooms != null) add('Bedrooms', COUNT.format(input.bedrooms));
	if (input.bathrooms != null) add('Bathrooms', COUNT.format(input.bathrooms));
	if (input.squareFeet != null) add('Square feet', COUNT.format(input.squareFeet));

	// Purchase.
	add('Purchase price', usd(inputs.priceCents));
	const priceSource = input.sources?.price && sourceValue(input.sources.price);
	if (priceSource) add('Purchase price source', priceSource);
	add(
		'Closing costs',
		inputs.closing.unit === 'pct'
			? `${pctTrim(inputs.closing.bps)} (${usd(a.closingCents)})`
			: usd(a.closingCents)
	);
	add('Repairs before renting', usd(a.repairsCents));

	// Financing.
	const f = inputs.financing;
	if (f.kind === 'cash') {
		add('Payment method', 'All cash');
	} else {
		add('Payment method', 'Mortgage');
		add('Down payment', `${pctTrim(f.downBps)} (${usd(a.downPaymentCents)})`);
		add('Interest rate', f.annualRatePct === null ? NOT_ENTERED : rateLabel(f.annualRatePct));
		add('Loan term', `${COUNT.format(f.termYears)} year${f.termYears === 1 ? '' : 's'}`);
		add('Loan amount', usd(a.loanCents));
		add(
			'Monthly loan payment (principal and interest)',
			orWords(a.paymentMonthly, a.reasons.payment, usd)
		);
	}

	// Income.
	add('Monthly rent', usd(inputs.rentCents));
	const rentSource = input.sources?.rent && sourceValue(input.sources.rent);
	if (rentSource) add('Monthly rent source', rentSource);
	add('Other monthly income', usd(inputs.otherIncomeCents));

	// Expenses, one line each, in input order.
	const hasOther = inputs.otherIncomeCents > 0;
	inputs.expenses.forEach((line, i) => {
		const monthly = a.lines[i]?.monthlyCents ?? 0;
		add(oneLine(line.name) || 'Other expense', expenseValue(line, monthly, hasOther));
	});
	add('Operating expenses before vacancy', `${usd(a.opexMonthly)} a month`);

	// Results.
	add(M.noi.resultsLabel, usd(a.noiAnnual));
	add(M.cashFlow.resultsLabel, orWords(a.cashFlowMonthly, a.reasons.cashFlow, usd));
	add(
		M.coc.resultsLabel,
		orWords(a.cocPct, a.reasons.coc, (v) => pct(v, 1))
	);
	add(
		M.capRate.resultsLabel,
		orWords(a.capRatePct, a.reasons.capRate, (v) => pct(v, 1))
	);
	add(
		M.dscr.resultsLabel,
		orWords(a.dscr, a.reasons.dscr, (v) => ratio(v, 2))
	);
	add(
		M.grm.resultsLabel,
		orWords(a.grm, a.reasons.grm, (v) => ratio(v, 1))
	);
	add(
		M.onePct.resultsLabel,
		orWords(
			a.rentToPricePct,
			a.reasons.rentToPrice,
			(v) =>
				`rent is ${pct(v, 2)} of the purchase price (${a.meetsOnePct ? 'meets' : 'does not meet'} the 1% rule)`
		)
	);
	add('Total cash needed', usd(a.cashInvestedCents));

	const factsText =
		`Deal: ${oneLine(input.dealName)}\nAddress: ${oneLine(input.address)}\n` +
		lines.map((l) => `${l.label}: ${l.value}`).join('\n');
	const notes = (input.notes ?? '').trim();
	const allowed = [
		...allowedFromText(factsText, 'analysis'),
		...allowedFromText(notes, 'your notes')
	];
	return { factsText, lines, notes, allowed };
}
