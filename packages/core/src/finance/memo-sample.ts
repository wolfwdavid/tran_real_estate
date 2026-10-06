// Deterministic sample memo for the keyless demo (INV-06, RESEARCH Pitfall 2). It is built only by
// interpolating FACTS values (looked up by label), the deal name and address, and fixed words, so it
// always passes its own numeric post-check. It restates figures; it never describes the area or the
// people in it, never says who the property suits, and never recommends buying or selling.
//
// Fixed words here must contain no digits other than the "1% rule" name, which the numeral
// extractor ignores.

import { METRIC_DEFINITIONS } from './definitions.js';
import type { MemoFacts } from './memo-facts.js';

const M = METRIC_DEFINITIONS;
const CLOSING = 'These figures are arithmetic on the inputs above, not a forecast.';

/** Labels the template writes itself; every other FACTS line goes into the expense list. */
const FIXED_LABELS = new Set([
	'Property type',
	'Bedrooms',
	'Bathrooms',
	'Square feet',
	'Purchase price',
	'Purchase price source',
	'Closing costs',
	'Repairs before renting',
	'Payment method',
	'Down payment',
	'Interest rate',
	'Loan term',
	'Loan amount',
	'Monthly loan payment (principal and interest)',
	'Monthly rent',
	'Monthly rent source',
	'Other monthly income',
	'Operating expenses before vacancy',
	M.noi.resultsLabel,
	M.cashFlow.resultsLabel,
	M.coc.resultsLabel,
	M.capRate.resultsLabel,
	M.dscr.resultsLabel,
	M.grm.resultsLabel,
	M.onePct.resultsLabel,
	'Total cash needed'
]);

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

export function sampleMemo(facts: MemoFacts): string {
	const get = (label: string): string | undefined =>
		facts.lines.find((l) => l.label === label)?.value;
	const v = (label: string): string => get(label) ?? 'not available';
	const head = facts.factsText.split('\n', 2);
	const dealName = head[0]?.replace(/^Deal: /, '') ?? '';
	const address = head[1]?.replace(/^Address: /, '') ?? '';

	const paragraphs: string[] = [];

	// 1. What this is.
	const details = [
		get('Property type') && `property type: ${lower(v('Property type'))}`,
		get('Bedrooms') && `bedrooms: ${v('Bedrooms')}`,
		get('Bathrooms') && `bathrooms: ${v('Bathrooms')}`,
		get('Square feet') && `square feet: ${v('Square feet')}`
	].filter(Boolean);
	paragraphs.push(
		`This summary covers ${dealName}, ${address}. It restates the figures from the deal analyzer in plain words.` +
			(details.length ? ` Property details entered: ${details.join('; ')}.` : '')
	);

	// 2. Purchase and financing.
	let purchase = `The purchase price is ${v('Purchase price')}`;
	if (get('Purchase price source')) purchase += ` (${v('Purchase price source')})`;
	purchase += `, with closing costs of ${v('Closing costs')} and repairs before renting of ${v('Repairs before renting')}.`;
	if (v('Payment method') === 'All cash') {
		purchase += ' The purchase is paid in all cash, so there is no loan.';
	} else {
		purchase +=
			` The purchase uses a mortgage. The down payment is ${v('Down payment')}, the interest rate is ${v('Interest rate')} and the loan term is ${v('Loan term')}.` +
			` The loan amount is ${v('Loan amount')} and the monthly loan payment (principal and interest) is ${v('Monthly loan payment (principal and interest)')}.`;
	}
	paragraphs.push(purchase);

	// 3. Income and expenses.
	let income = `Monthly rent is ${v('Monthly rent')}.`;
	if (get('Monthly rent source')) {
		income += ` This rent is estimated: ${v('Monthly rent source')}.`;
	}
	income += ` Other monthly income is ${v('Other monthly income')}.`;
	const expenses = facts.lines
		.filter((l) => !FIXED_LABELS.has(l.label))
		.map((l) => `${l.label}, ${l.value}`);
	if (expenses.length) income += ` The expense lines are: ${expenses.join('; ')}.`;
	income += ` Operating expenses before vacancy come to ${v('Operating expenses before vacancy')}.`;
	paragraphs.push(income);

	// 4. Results.
	paragraphs.push(
		`Annual ${lower(M.noi.label)} is ${v(M.noi.resultsLabel)}. ${M.cashFlow.resultsLabel} is ${v(M.cashFlow.resultsLabel)}.` +
			` ${M.coc.resultsLabel} is ${v(M.coc.resultsLabel)}, and the cap rate is ${v(M.capRate.resultsLabel)}.` +
			` ${M.dscr.resultsLabel} is ${v(M.dscr.resultsLabel)}, and the ${lower(M.grm.resultsLabel)} is ${v(M.grm.resultsLabel)}.` +
			` On the ${M.onePct.resultsLabel}, ${v(M.onePct.resultsLabel)}.` +
			` Total cash needed is ${v('Total cash needed')}. ${CLOSING}`
	);

	// 5. The user's own notes, verbatim.
	if (facts.notes) paragraphs.push(`Your notes: ${facts.notes}`);

	return paragraphs.join('\n\n');
}
