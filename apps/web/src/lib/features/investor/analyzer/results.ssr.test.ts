// SSR tests for ResultsPanel (07-12, INV-01): exact copy, metric order, definitions inside each
// <dd>, honest "—" reasons, U+2212 negatives without error color, and Show the math.
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import {
	analyze,
	METRIC_DEFINITIONS,
	REFERENCE_CASES,
	type DealInputs,
	type ExpenseLine
} from '@tran/core/finance';
import ResultsPanel from './ResultsPanel.svelte';
import { defaultForm, type ParsedForm } from './form-model';

const clean = (body: string) =>
	body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.replace(/&#39;|&apos;/g, "'");
const text = (h: string) =>
	h
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const ref = (id: string) => REFERENCE_CASES.find((c) => c.id === id)!;

function html(inputs: DealInputs | null, masked: ParsedForm['masked'] = {}) {
	const analysis = inputs ? analyze(inputs) : null;
	return clean(
		render(ResultsPanel, { props: { analysis, inputs, masked, form: defaultForm() } }).body
	);
}

/** Text of the metric block marked data-metric="{key}". */
function metric(h: string, key: string): string {
	const start = h.indexOf(`data-metric="${key}"`);
	expect(start, `metric ${key}`).toBeGreaterThan(-1);
	const tagStart = h.lastIndexOf('<', start);
	const tagName = /^<(\w+)/.exec(h.slice(tagStart))![1];
	let depth = 0;
	const re = new RegExp(`<(/?)${tagName}\\b[^>]*>`, 'g');
	re.lastIndex = tagStart;
	for (let m = re.exec(h); m; m = re.exec(h)) {
		depth += m[1] ? -1 : 1;
		if (depth === 0) return text(h.slice(tagStart, m.index));
	}
	throw new Error('unbalanced');
}

const withLines = (i: DealInputs, f: (l: ExpenseLine) => ExpenseLine): DealInputs => ({
	...i,
	expenses: i.expenses.map(f)
});

describe('ResultsPanel not ready', () => {
	const h = html(null);
	test('heading, sub-line, empty state and sample button; no metrics', () => {
		expect(h).toMatch(/<section[^>]*id="results"[^>]*aria-labelledby="results-heading"/);
		expect(h).toMatch(/<h2[^>]*id="results-heading"[^>]*tabindex="-1"[^>]*>\s*Results\s*<\/h2>/);
		expect(h).toContain('Updates as you type.');
		expect(h).toContain(
			'Enter a purchase price and monthly rent to see cash flow, cap rate, and the rest. Manual entry uses no API calls.'
		);
		expect(h).toMatch(/<button[^>]*>\s*Try a sample deal\s*<\/button>/);
		expect(h).not.toContain('<dl');
	});
	test('not a live region', () => {
		expect(h).not.toMatch(/aria-live|role="status"|role="alert"/);
	});
});

describe('ResultsPanel ready (case A)', () => {
	const h = html(ref('A').inputs);
	const t = text(h);

	test('headline Monthly cash flow $184 in Figure 40/600 tabular', () => {
		expect(metric(h, 'cashFlow')).toBe('$184');
		expect(h).toMatch(
			/class="[^"]*text-display[^"]*font-semibold[^"]*tabular-nums[^"]*"[^>]*data-metric="cashFlow"/
		);
		expect(t).toContain(`Monthly cash flow $184 ${METRIC_DEFINITIONS.cashFlow.definition}`);
	});

	test('metric list in order with values and the definition inside each <dd>', () => {
		const expected: [string, string, string][] = [
			['coc', 'Cash-on-cash return', '4.8%'],
			['capRate', 'Cap rate', '7.5%'],
			['noi', 'Net operating income (NOI), annual', '$14,976'],
			['dscr', 'Debt service coverage ratio (DSCR)', '1.17'],
			['grm', 'Gross rent multiplier (GRM)', '8.3'],
			['onePct', '1% rule', '1.00%']
		];
		let last = -1;
		for (const [key, label, value] of expected) {
			const at = h.indexOf(`data-metric="${key}"`);
			expect(at).toBeGreaterThan(last);
			last = at;
			const def = METRIC_DEFINITIONS[key as keyof typeof METRIC_DEFINITIONS].definition;
			expect(metric(h, key)).toContain(`${label} ${value}`);
			expect(metric(h, key)).toContain(def);
		}
		const dds = [...h.matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => text(m[1]));
		for (const [key] of expected) {
			const def = METRIC_DEFINITIONS[key as keyof typeof METRIC_DEFINITIONS].definition;
			expect(dds.some((d) => d.includes(def))).toBe(true);
		}
		expect(h).toMatch(/<dt\b/);
	});

	test('1% rule pill: Meets the 1% rule with CircleCheck', () => {
		const one = h.slice(h.indexOf('data-metric="onePct"'));
		expect(one).toMatch(/lucide-circle-check[\s\S]*?Meets the 1% rule/);
		expect(t).not.toContain('Below 1%');
	});

	test('disclaimer', () => {
		expect(h).toContain(
			"These figures are arithmetic on the numbers you entered. They're not investment, legal, or tax advice. Check every number before you rely on it."
		);
	});

	test('no missing-inputs note when tax, insurance and rate are entered', () => {
		expect(h).not.toContain('data-missing-inputs');
	});

	test('Show the math: both groups with every row in order and minus signs on subtractions', () => {
		expect(h).toMatch(/<details[\s\S]*<summary[^>]*>\s*Show the math\s*<\/summary>/);
		const math = text(h.slice(h.indexOf('<details')));
		const each = [
			'Rent $2,000',
			'Other income $0',
			'Vacancy allowance −$100',
			'Effective income $1,900',
			'Operating expenses before vacancy −$652',
			'Net operating income $1,248',
			'Loan payment (principal and interest) −$1,064',
			'Cash flow $184'
		];
		const close = [
			'Down payment $40,000',
			'Closing costs $6,000',
			'Repairs $0',
			'Total cash needed $46,000',
			'Loan amount $160,000'
		];
		expect(math.indexOf('Each month')).toBeLessThan(math.indexOf('Cash to close'));
		let last = -1;
		for (const row of [...each, ...close]) {
			const at = math.indexOf(row);
			expect(at, row).toBeGreaterThan(last);
			last = at;
		}
	});
});

describe('ResultsPanel edge cases', () => {
	test('case D: −$1,150 headline (U+2212), no destructive color; Below 1% with CircleMinus', () => {
		const h = html(ref('D').inputs);
		expect(metric(h, 'cashFlow')).toBe('−$1,150');
		expect(h).not.toMatch(/destructive|text-red/);
		const one = h.slice(h.indexOf('data-metric="onePct"'));
		expect(one).toMatch(/lucide-circle-minus[\s\S]*?Below 1%/);
		expect(text(h)).not.toContain('Meets the 1% rule');
	});

	test('all cash (case B): DSCR — with hidden Not available and reason No loan', () => {
		const h = html(ref('B').inputs);
		const block = h.slice(h.indexOf('data-metric="dscr"'), h.indexOf('data-metric="grm"'));
		expect(block).toContain(
			'<span aria-hidden="true">—</span><span class="sr-only">Not available</span>'
		);
		expect(text(block)).toContain('No loan');
	});

	test('rate blank: missing-inputs note + link; cash-on-cash Needs interest rate', () => {
		const a = ref('A').inputs;
		const inputs: DealInputs = {
			...a,
			financing: { kind: 'mortgage', downBps: 2000, annualRatePct: null, termYears: 30 }
		};
		const h = html(inputs);
		expect(h).toContain(
			'Interest rate is blank, so cash flow, cash-on-cash return, and DSCR are waiting on it.'
		);
		expect(h).toMatch(/<a href="#rate"[^>]*>Enter interest rate<\/a>/);
		expect(metric(h, 'coc')).toContain('— Not available Needs interest rate');
		expect(metric(h, 'cashFlow')).toContain('Needs interest rate');
	});

	test('tax and insurance blank: note with both links', () => {
		const inputs = withLines(ref('A').inputs, (l) =>
			l.kind === 'tax' || l.kind === 'insurance' ? { ...l, unit: 'usd', cents: null } : l
		);
		const h = html(inputs);
		expect(h).toContain('Property tax and insurance are blank, so expenses may be understated.');
		expect(h).toMatch(/<a href="#expense-tax-amount"[^>]*>Enter property tax<\/a>/);
		expect(h).toMatch(/<a href="#expense-insurance-amount"[^>]*>Enter insurance<\/a>/);
	});

	test('only tax blank: singular note and one link', () => {
		const inputs = withLines(ref('A').inputs, (l) =>
			l.kind === 'tax' ? { ...l, unit: 'usd', cents: null } : l
		);
		const h = html(inputs);
		expect(h).toContain('Property tax is blank, so expenses may be understated.');
		expect(h).not.toContain('Enter insurance');
	});

	test('masked metric (down payment invalid): cash-on-cash Needs down payment', () => {
		const h = html(ref('A').inputs, { coc: 'downPct', cashFlow: 'downPct', dscr: 'downPct' });
		expect(metric(h, 'coc')).toContain('Needs down payment');
		expect(metric(h, 'cashFlow')).toContain('Needs down payment');
		expect(metric(h, 'capRate')).toContain('7.5%');
	});

	test('never uses error color for numbers', () => {
		const src = readFileSync(new URL('./ResultsPanel.svelte', import.meta.url), 'utf8');
		expect(src).not.toContain('text-destructive');
	});
});
