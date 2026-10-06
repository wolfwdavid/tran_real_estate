// SSR structural tests for the analyzer inputs (07-10). svelte/server renders each component to a
// string in the node project; behaviour that needs a DOM (focus, blur) is covered by the page plan.
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import MoneyInput from './MoneyInput.svelte';
import PercentInput from './PercentInput.svelte';
import NumberInput from './NumberInput.svelte';
import UnitToggle from './UnitToggle.svelte';
import type { ExpenseLineForm } from './form-model';

const clean = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (C: any, props: Record<string, unknown>) => clean(render(C, { props }).body);
const tag = (h: string, name: string) => new RegExp(`<${name}\\b[^>]*>`).exec(h)?.[0] ?? '';
const attr = (t: string, a: string) => new RegExp(`\\s${a}="([^"]*)"`).exec(t)?.[1];

describe('MoneyInput', () => {
	const base = { id: 'price', label: 'Purchase price', value: '' };

	test('visible label with hidden unit, text input with decimal keyboard', () => {
		const h = html(MoneyInput, base);
		const label = tag(h, 'label');
		expect(attr(label, 'for')).toBe('price');
		expect(h).toMatch(
			/<label[^>]*>Purchase price<span class="sr-only">, in dollars<\/span><\/label>/
		);
		const input = tag(h, 'input');
		expect(attr(input, 'id')).toBe('price');
		expect(attr(input, 'type')).toBe('text');
		expect(attr(input, 'inputmode')).toBe('decimal');
		expect(attr(input, 'autocomplete')).toBe('off');
		expect(input).toContain('tabular-nums');
		expect(input).toContain('h-12');
		expect(attr(input, 'aria-invalid')).toBeUndefined();
	});

	test('"$" adornment is aria-hidden', () => {
		const h = html(MoneyInput, base);
		expect(h).toMatch(/<span aria-hidden="true"[^>]*>\$<\/span>/);
	});

	test('error: aria-invalid, describedby error id, CircleAlert icon and copy', () => {
		const h = html(MoneyInput, { ...base, error: 'Use 0 or more.', helper: 'Optional.' });
		const input = tag(h, 'input');
		expect(attr(input, 'aria-invalid')).toBe('true');
		const ids = attr(input, 'aria-describedby')!.split(' ');
		expect(ids).toEqual(['price-help', 'price-error']);
		expect(h).toMatch(/<p id="price-error"[^>]*>[\s\S]*<svg[\s\S]*Use 0 or more\.<\/p>/);
		expect(input).toContain('border-destructive');
	});

	test('chip snippet sits in the label row and is referenced by aria-describedby', () => {
		const chip = createRawSnippet(() => ({ render: () => '<span>From RentCast</span>' }));
		const h = html(MoneyInput, { ...base, chip });
		expect(h).toMatch(/<span id="price-chip"[^>]*><span>From RentCast<\/span><\/span>/);
		expect(attr(tag(h, 'input'), 'aria-describedby')).toBe('price-chip');
	});

	test('validation is blur-only: no input handler validates', async () => {
		const { readFileSync } = await import('node:fs');
		for (const f of ['MoneyInput', 'PercentInput', 'NumberInput', 'NumericField']) {
			const src = readFileSync(new URL(`./${f}.svelte`, import.meta.url), 'utf8');
			expect(src).not.toMatch(/oninput/);
		}
		const field = readFileSync(new URL('./NumericField.svelte', import.meta.url), 'utf8');
		expect(field).toMatch(/onblur/);
		expect(field).toMatch(/formatOnBlur/);
		expect(field).toMatch(/onvalidate/);
	});
});

describe('PercentInput', () => {
	test('trailing "%" adornment aria-hidden and hidden ", in percent"', () => {
		const h = html(PercentInput, { id: 'down', label: 'Down payment', value: '25' });
		expect(h).toContain('<span class="sr-only">, in percent</span>');
		expect(h).toMatch(/<span aria-hidden="true"[^>]*>%<\/span>/);
		expect(attr(tag(h, 'input'), 'inputmode')).toBe('decimal');
		expect(attr(tag(h, 'input'), 'value')).toBe('25');
		expect(h).not.toMatch(/>\$<\/span>/);
	});
});

describe('NumberInput', () => {
	test('suffix "years" is aria-hidden; integer -> numeric keyboard', () => {
		const h = html(NumberInput, {
			id: 'term',
			label: 'Loan term',
			value: '30',
			suffix: 'years',
			integer: true
		});
		expect(h).toMatch(/<span aria-hidden="true"[^>]*>years<\/span>/);
		expect(h).toContain('<span class="sr-only">, in years</span>');
		expect(attr(tag(h, 'input'), 'inputmode')).toBe('numeric');
	});

	test('decimals allowed -> decimal keyboard, no adornment', () => {
		const h = html(NumberInput, { id: 'baths', label: 'Bathrooms', value: '' });
		expect(attr(tag(h, 'input'), 'inputmode')).toBe('decimal');
		expect(h).not.toContain('aria-hidden="true"');
	});
});

describe('UnitToggle', () => {
	const props = {
		name: 'management-unit',
		legend: 'Property management entered as',
		options: [
			{ value: 'pct', label: '% of rent' },
			{ value: 'usd', label: '$ per month' }
		],
		value: 'pct'
	};

	const segments = (h: string) =>
		[...h.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)].map((m) => ({
			cls: attr(m[0].slice(0, m[0].indexOf('>') + 1), 'class') ?? '',
			inner: m[2]
		}));

	test('fieldset with a visually hidden legend and two native radios', () => {
		const h = html(UnitToggle, props);
		expect(h).toMatch(/<fieldset\b/);
		expect(h).toMatch(/<legend class="sr-only">Property management entered as<\/legend>/);
		const radios = [...h.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
		expect(radios).toHaveLength(2);
		for (const r of radios) {
			expect(attr(r, 'type')).toBe('radio');
			expect(attr(r, 'name')).toBe('management-unit');
		}
		expect(radios[0]).toMatch(/\schecked/);
		expect(radios[1]).not.toMatch(/\schecked/);
	});

	test('selected segment carries the Check icon and semibold; unselected has neither', () => {
		const [sel, other] = segments(html(UnitToggle, props));
		expect(sel.inner).toMatch(/<svg[^>]*aria-hidden="true"/);
		expect(sel.inner).toMatch(/lucide-check|check/);
		expect(sel.cls).toContain('font-semibold');
		expect(sel.inner).toContain('% of rent');
		expect(other.inner).not.toContain('<svg');
		expect(other.cls).not.toContain('font-semibold');
		expect(other.inner).toContain('$ per month');
	});

	test('segments meet the 44x96 minimum and use token classes', () => {
		for (const s of segments(html(UnitToggle, { ...props, value: 'usd' }))) {
			expect(s.cls).toContain('min-h-11');
			expect(s.cls).toContain('min-w-24');
			expect(s.cls).toContain('border-input');
		}
	});

	test('the selected state follows value', () => {
		const [pctSeg, usdSeg] = segments(html(UnitToggle, { ...props, value: 'usd' }));
		expect(pctSeg.inner).not.toContain('<svg');
		expect(usdSeg.inner).toContain('<svg');
	});
});

describe('ExpenseLines', async () => {
	const { default: ExpenseLines } = await import('./ExpenseLines.svelte');
	const { analyze } = await import('@tran/core/finance');
	const { addCustomLine, defaultForm, parseForm } = await import('./form-model');

	const sample = () => {
		const form = { ...defaultForm(), price: '200,000', rent: '2,000' };
		return { form, analysis: analyze(parseForm(form).inputs!) };
	};
	const renderLines = (props: Record<string, unknown>) =>
		html(ExpenseLines, { errors: {}, rentCents: 200_000, ...props });
	const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
	const groups = (h: string) => [...h.matchAll(/<div\b[^>]*role="group"[^>]*>/g)].map((m) => m[0]);

	test('eight labelled row groups with the default names in order', () => {
		const { form, analysis } = sample();
		const h = renderLines({ form: form.expenses, analysis });
		const gs = groups(h);
		expect(gs).toHaveLength(8);
		const names = gs.map((g) => {
			const id = attr(g, 'aria-labelledby')!;
			return new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(h)?.[1].trim();
		});
		expect(names).toEqual([
			'Vacancy allowance',
			'Property management',
			'Maintenance',
			'Capital reserves',
			'Property tax',
			'Insurance',
			'HOA dues',
			'Owner-paid utilities'
		]);
	});

	test('fieldset note, computed lines and the totals footer', () => {
		const { form, analysis } = sample();
		const t = text(renderLines({ form: form.expenses, analysis }));
		expect(t).toContain(
			"Percent lines are starting assumptions. Change any of them to match the property. Tax and insurance stay blank until you enter them, because Tran won't guess them."
		);
		expect(t).toContain('= $100 a month'); // vacancy 5% of $2,000
		expect(t).toContain('= $152 a month'); // management 8% of $1,900 collected
		// 100 + 152 + 100 + 100 = $452 a month, x12 = $5,424
		expect(t).toContain('Operating expenses: $452 a month · $5,424 a year');
	});

	test('"$ per month" rows show "% of rent" only when rent is entered', () => {
		const { form, analysis } = sample();
		form.expenses[4].amount = '200';
		expect(text(renderLines({ form: form.expenses, analysis }))).toContain('= 10% of rent');
		for (const rentCents of [null, 0]) {
			const t = text(renderLines({ form: form.expenses, analysis: null, rentCents }));
			expect(t).not.toMatch(/= \S*% of rent/);
			expect(t).not.toContain('a month'); // no rent: percent lines have nothing to show either
		}
	});

	test('no footer without an analysis', () => {
		const { form } = sample();
		expect(text(renderLines({ form: form.expenses, analysis: null }))).not.toContain(
			'Operating expenses:'
		);
	});

	test('unit toggles: one per row with the "{Line} entered as" legend', () => {
		const { form, analysis } = sample();
		const h = renderLines({ form: form.expenses, analysis });
		expect(h.match(/<fieldset\b/g)).toHaveLength(8);
		expect(h).toContain('<legend class="sr-only">Property tax entered as</legend>');
		expect(text(h)).toContain('% of rent');
		expect(text(h)).toContain('$ per month');
	});

	test('default rows have no remove button; custom rows have a name input and remove', () => {
		const { analysis } = sample();
		let form = addCustomLine(defaultForm());
		form = addCustomLine(form);
		form.expenses[8].name = 'Lawn care';
		const h = renderLines({ form: form.expenses, analysis });
		const buttons = [...h.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
		const removes = buttons.filter((b) => /aria-label="Remove/.test(b));
		expect(removes.map((b) => attr(b, 'aria-label'))).toEqual([
			'Remove Lawn care',
			'Remove this expense line'
		]);
		for (const b of removes) expect(b).toMatch(/size-11/);
		expect(h.match(/>Expense name</g)).toHaveLength(2);
		expect(text(h)).toContain('Add expense line');
	});

	test('the add button gives way to the cap note at 12 custom lines', () => {
		let form = defaultForm();
		for (let i = 0; i < 12; i++) form = addCustomLine(form);
		const t = text(renderLines({ form: form.expenses, analysis: null }));
		expect(t).not.toContain('Add expense line');
		expect(t).toContain("You've added 12 custom lines, the most this form holds.");
	});

	test('a line error shows the verbatim copy on that line', () => {
		const { form, analysis } = sample();
		form.expenses[0].amount = '150';
		const h = renderLines({
			form: form.expenses,
			analysis,
			errors: { 'expense:vacancy': 'pct-range' }
		});
		expect(text(h)).toContain('Use a percent from 0 to 100.');
		expect(h.match(/aria-invalid="true"/g)).toHaveLength(1);
	});
});

describe('expense unit conversion (pure helper)', async () => {
	const { convertLineUnit } = await import('./expense-lines');
	const ctx = { rentCents: 200_000, gsiCents: 200_000, egiCents: 190_000 };
	const line = (unit: 'pct' | 'usd', amount: string): ExpenseLineForm => ({
		id: 'maintenance',
		kind: 'maintenance',
		name: 'Maintenance',
		unit,
		amount
	});

	test('8% of $2,000 -> $160 a month, announced', () => {
		const r = convertLineUnit({ ...line('pct', '8'), id: 'm', kind: 'maintenance' }, 'usd', ctx);
		expect(r.line).toMatchObject({ unit: 'usd', amount: '160' });
		expect(r.message).toBe('Maintenance changed to $ per month. Still $160 a month.');
	});

	test('dollars back to percent keeps the monthly dollars', () => {
		const r = convertLineUnit(line('usd', '160'), 'pct', ctx);
		expect(r.line).toMatchObject({ unit: 'pct', amount: '8' });
		expect(r.message).toBe('Maintenance changed to % of rent. Still $160 a month.');
	});

	test('management converts on collected income', () => {
		const r = convertLineUnit(
			{
				id: 'management',
				kind: 'management',
				name: 'Property management',
				unit: 'pct',
				amount: '8'
			},
			'usd',
			ctx
		);
		expect(r.line.amount).toBe('152');
	});

	test('zero base: amount blank and the short announcement', () => {
		const r = convertLineUnit(line('usd', '160'), 'pct', {
			rentCents: 0,
			gsiCents: 0,
			egiCents: 0
		});
		expect(r.line).toMatchObject({ unit: 'pct', amount: '' });
		expect(r.message).toBe('Maintenance changed to % of rent.');
	});

	test('blank or invalid amounts switch unit and clear', () => {
		expect(convertLineUnit(line('usd', ''), 'pct', ctx)).toEqual({
			line: line('pct', ''),
			message: 'Maintenance changed to % of rent.'
		});
		expect(convertLineUnit(line('usd', 'abc'), 'pct', ctx).line.amount).toBe('');
	});

	test('unnamed custom lines are announced as "This expense line"', () => {
		const r = convertLineUnit(
			{ id: 'custom-1', kind: 'custom', name: ' ', unit: 'usd', amount: '' },
			'pct',
			ctx
		);
		expect(r.message).toBe('This expense line changed to % of rent.');
	});
});

describe('lineContext', async () => {
	const { lineContext } = await import('./expense-lines');
	const { analyze } = await import('@tran/core/finance');
	const { defaultForm, parseForm } = await import('./form-model');

	test('uses gross and collected income from the analysis', () => {
		const form = { ...defaultForm(), price: '200,000', rent: '2,000', otherIncome: '100' };
		const analysis = analyze(parseForm(form).inputs!);
		// GSI = 2,100; vacancy 5% = 105; EGI = 1,995
		expect(lineContext(analysis, 200_000)).toEqual({
			rentCents: 200_000,
			gsiCents: 210_000,
			egiCents: 199_500
		});
	});

	test('without an analysis, rent stands in for every base', () => {
		expect(lineContext(null, 150_000)).toEqual({
			rentCents: 150_000,
			gsiCents: 150_000,
			egiCents: 150_000
		});
		expect(lineContext(null, null)).toEqual({ rentCents: 0, gsiCents: 0, egiCents: 0 });
	});
});
