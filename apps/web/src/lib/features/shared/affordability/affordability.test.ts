// SSR structure tests for the shared affordability calculator (06-12, RENT-08). Components render to
// a string with svelte/server; effects never run here. The source checks pin the zero-I/O contract
// that lets Phase 10 mount the calculator on a marketing page.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { affordability } from '@tran/core/renter/affordability';
import AffordabilityCalculator from './AffordabilityCalculator.svelte';
import AffordabilityForm from './AffordabilityForm.svelte';
import AffordabilityResult from './AffordabilityResult.svelte';
import GoodToKnow from './GoodToKnow.svelte';

const DIR = dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(DIR)
	.filter((f) => /\.(svelte|ts)$/.test(f) && !f.includes('.test.'))
	.map((f) => ({ file: f, text: readFileSync(join(DIR, f), 'utf8') }));

const outputs: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown> = {}): string {
	const out = render(component, { props }).body;
	outputs.push(out);
	return out;
}

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const text = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();

const RESULT_72K = affordability({ income: 72000, period: 'year', debts: 400, savings: 3000 });

describe('AffordabilityCalculator', () => {
	test('with no income it shows the empty result and the three fields', () => {
		const t = text(html(AffordabilityCalculator));
		expect(t).toContain('Enter your income to see a rent range.');
		expect(t).toContain('Income before taxes');
		expect(t).toContain('Monthly debt payments');
		expect(t).toContain('Savings for moving');
		expect(t).toContain('Good to know');
		expect(t).not.toContain('Rent that fits');
	});

	test('two-column layout from 1024px with a sticky result column', () => {
		const h = html(AffordabilityCalculator);
		expect(h).toContain('lg:grid-cols-2');
		expect(h).toContain('lg:sticky');
		expect(h).toContain('lg:top-4');
	});
});

describe('AffordabilityForm', () => {
	test('money fields are text inputs with a decimal keypad and a hidden $ prefix', () => {
		const h = html(AffordabilityForm);
		expect(h.match(/inputmode="decimal"/g)).toHaveLength(3);
		expect(h.match(/type="text"/g)).toHaveLength(3);
		expect(h.match(/<span aria-hidden="true"[^>]*>\$<\/span>/g)).toHaveLength(3);
		expect(h).toContain('tabular-nums');
	});

	test('period chips share one name and default to a year', () => {
		const h = html(AffordabilityForm);
		expect(h.match(/name="afford-period"/g)).toHaveLength(2);
		expect(h).toMatch(/value="year"[^>]*checked/);
		expect(h).not.toMatch(/value="month"[^>]*checked/);
		expect(h).toContain('role="radiogroup" aria-labelledby="afford-income-label"');
		const t = text(h);
		expect(t).toContain('a year');
		expect(t).toContain('a month');
	});

	test('helpers are the contract copy and describe their fields', () => {
		const h = html(AffordabilityForm);
		const t = text(h);
		expect(t).toContain('Car, student loan, and credit card minimums. Leave 0 if none.');
		expect(t).toContain("Cash you could put toward a deposit and first month's rent.");
		expect(h).toContain('aria-describedby="afford-debts-help"');
		expect(h).toContain('aria-describedby="afford-savings-help"');
	});

	test('a blank income shows no error before blur', () => {
		const h = html(AffordabilityForm, { income: '' });
		expect(h).not.toContain('aria-invalid');
		expect(text(h)).not.toContain('Enter your income before taxes');
	});

	test('invalid income and negative amounts show the contract errors with aria-invalid', () => {
		const bad = html(AffordabilityForm, { income: '$' });
		expect(text(bad)).toContain('Enter your income before taxes, like 60,000.');
		expect(bad).toContain('aria-invalid="true"');
		expect(bad).toContain('aria-describedby="afford-income-error"');

		const neg = html(AffordabilityForm, { income: '60000', debts: '-5', savings: 'abc' });
		const t = text(neg);
		expect(t.match(/Use a number of 0 or more\./g)).toHaveLength(2);
		expect(neg).toContain('aria-describedby="afford-debts-help afford-debts-error"');
		expect(neg).toContain('aria-describedby="afford-savings-help afford-savings-error"');
	});
});

describe('AffordabilityResult', () => {
	test('null result is the empty surface panel', () => {
		const h = html(AffordabilityResult, { result: null, debts: 0, savings: 0 });
		expect(text(h)).toBe('Enter your income to see a rent range.');
		expect(h).toContain('bg-surface');
		expect(h).toContain('rounded-lg');
		expect(h).toContain('p-6');
	});

	test('72,000 a year with 400 debts gives the contract range and breakdown', () => {
		const h = html(AffordabilityResult, { result: RESULT_72K, debts: 400, savings: 3000 });
		const t = text(h);
		expect(h).toContain('<section aria-labelledby="afford-result"');
		expect(h).toMatch(/<h2 id="afford-result"[^>]*>\s*Rent that fits: \$1,500 to \$1,800 a month/);
		expect(t).toContain('25% of your income $1,500');
		expect(t).toContain('30% of your income (a common guideline) $1,800');
		expect(t).toContain('Rent + debts at 40% of income $2,000');
		expect(t).toContain('Savings cover move-in costs up to $1,500');
		expect(h).toContain('<dl');
	});

	test('the slider starts at the top of the range with a dollar valuetext and the within line', () => {
		const h = html(AffordabilityResult, { result: RESULT_72K, debts: 400, savings: 3000 });
		const t = text(h);
		expect(t).toContain('Try a rent amount');
		expect(h).toContain('aria-valuetext="$1,800 a month"');
		expect(h).toContain('aria-labelledby="afford-try-label"');
		expect(h).toContain('role="slider"');
		expect(h).toContain('aria-valuemax="10000"');
		expect(t).toContain('At $1,800, rent is 30% of your income, within the 30% guideline.');
		expect(t).toContain(
			'Many landlords look for income of about 40 times the monthly rent: $72,000 a year at this rent.'
		);
		expect(t).toContain(
			'Moving in at this rent takes about $3,600 for the first month and a one-month deposit. Your savings cover $3,000.'
		);
	});

	test('a tried rent above 30% and above the debt check gives the matching lines', () => {
		const above30 = text(
			html(AffordabilityResult, { result: RESULT_72K, debts: 0, savings: 0, tried: 1900 })
		);
		expect(above30).toContain('At $1,900, rent is 32% of your income, above the 30% guideline.');
		expect(above30).not.toContain('Your savings cover');

		const aboveDebt = text(
			html(AffordabilityResult, { result: RESULT_72K, debts: 400, savings: 0, tried: 2100 })
		);
		expect(aboveDebt).toContain(
			'At $2,100, rent plus debts would be 42% of your income, above the 40% check.'
		);
	});

	test('the CTA links to the search page with max prefilled', () => {
		const h = html(AffordabilityResult, { result: RESULT_72K, debts: 400, savings: 0 });
		expect(h).toMatch(/href="[^"]*\/renter\/\?max=1800"/);
		expect(text(h)).toContain('Search rentals up to $1,800');
	});

	test('heavy debts show only the top with the debts note', () => {
		const r = affordability({ income: 4000, period: 'month', debts: 800, savings: 0 });
		expect(r?.onlyTop).toBe(true);
		const t = text(html(AffordabilityResult, { result: r, debts: 800, savings: 0 }));
		expect(t).toContain('Rent that fits: up to $800 a month');
		expect(t).toContain(
			'Your monthly debts take up most of the 40% check, so the range tops out at $800.'
		);
	});

	test('debts that wipe out the debt check hide the search CTA', () => {
		const r = affordability({ income: 3000, period: 'month', debts: 1500, savings: 0 });
		const t = text(html(AffordabilityResult, { result: r, debts: 1500, savings: 0 }));
		expect(t).toContain('Rent that fits: up to $0 a month');
		expect(t).not.toContain('Search rentals');
	});
});

describe('GoodToKnow', () => {
	test('is the secondary callout with the three contract bullets', () => {
		const h = html(GoodToKnow);
		const t = text(h);
		expect(h).toContain('bg-secondary-surface');
		expect(h).toContain('border-l-4 border-secondary');
		expect(h).toMatch(/<h3[^>]*>\s*Good to know/);
		expect(t).toContain(
			'This is a general guideline based on common rules of thumb, not financial advice.'
		);
		expect(t).toContain(
			"Utilities, transport, childcare, and insurance aren't included, and they can change what's comfortable for you."
		);
		expect(t).toContain(
			'Landlords set their own income and credit requirements. Ask the listing contact what they look for.'
		);
		expect(t).toContain('not financial advice');
	});
});

describe('zero I/O and honest copy', () => {
	test('the component sources exist', () => {
		expect(SOURCES.map((s) => s.file)).toEqual(
			expect.arrayContaining([
				'AffordabilityCalculator.svelte',
				'AffordabilityForm.svelte',
				'AffordabilityResult.svelte',
				'GoodToKnow.svelte'
			])
		);
	});

	test.each([
		'$lib/storage',
		'$lib/data',
		'$lib/ai',
		'localStorage',
		'sessionStorage',
		'PersistedState',
		'replaceState',
		'goto(',
		'fetch('
	])('no source file uses %s', (needle) => {
		for (const { file, text: src } of SOURCES) {
			expect(src.includes(needle), `${file} contains ${needle}`).toBe(false);
		}
	});

	test.each(['you can afford', 'you qualify', 'recommended', 'you should'])(
		'neither the sources nor the rendered output say "%s"',
		(phrase) => {
			for (const { file, text: src } of SOURCES) {
				expect(src.toLowerCase().includes(phrase), `${file}`).toBe(false);
			}
			for (const out of outputs) expect(text(out).toLowerCase()).not.toContain(phrase);
		}
	);
});
