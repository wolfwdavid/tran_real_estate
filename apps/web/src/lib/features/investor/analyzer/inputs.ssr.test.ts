// SSR structural tests for the analyzer inputs (07-10). svelte/server renders each component to a
// string in the node project; behaviour that needs a DOM (focus, blur) is covered by the page plan.
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import MoneyInput from './MoneyInput.svelte';
import PercentInput from './PercentInput.svelte';
import NumberInput from './NumberInput.svelte';
import UnitToggle from './UnitToggle.svelte';

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
