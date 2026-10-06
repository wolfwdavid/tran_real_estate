// Real-browser checks SSR cannot exercise (07-10): focus after add/remove, unit switching with
// its announcement, blur-only validation, and axe on the rendered editor.
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import { addCustomLine, defaultForm, type AnalyzerForm } from './form-model';
import ExpenseLinesHarness from './testing/ExpenseLinesHarness.svelte';

async function setup(form: AnalyzerForm = defaultForm()) {
	const announce = vi.fn();
	const onvalidate = vi.fn();
	const result = await render(ExpenseLinesHarness, {
		props: { initial: { ...form, price: '200,000', rent: '2,000' }, announce, onvalidate }
	});
	return { container: result.container, announce, onvalidate };
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

describe('ExpenseLines in a browser', () => {
	test('Add expense line appends a row and focuses its name input', async () => {
		await setup();
		byId<HTMLButtonElement>('x-add')!.click();
		await vi.waitFor(() => expect(document.activeElement?.id).toBe('x-custom-1-name'));
		expect(document.querySelectorAll('[role="group"]')).toHaveLength(9);
	});

	test('removing the last custom row announces it and focuses Add expense line', async () => {
		const { announce } = await setup(addCustomLine(addCustomLine(defaultForm())));
		const first = byId<HTMLInputElement>('x-custom-1-name')!;
		await userEvent.fill(first, 'Lawn');
		// Removing a middle row moves focus to the next row's name field.
		(document.querySelector('button[aria-label="Remove Lawn"]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(document.activeElement?.id).toBe('x-custom-2-name'));
		expect(announce).toHaveBeenLastCalledWith('Removed Lawn.');
		(
			document.querySelector('button[aria-label="Remove this expense line"]') as HTMLButtonElement
		).click();
		await vi.waitFor(() => expect(document.activeElement?.id).toBe('x-add'));
		expect(announce).toHaveBeenLastCalledWith('Removed this expense line.');
		expect(document.querySelectorAll('[role="group"]')).toHaveLength(8);
	});

	test('the twelfth custom line replaces the add button with the cap note', async () => {
		let form = defaultForm();
		for (let i = 0; i < 11; i++) form = addCustomLine(form);
		await setup(form);
		byId<HTMLButtonElement>('x-add')!.click();
		await vi.waitFor(() => expect(document.activeElement?.id).toBe('x-custom-12-name'));
		expect(byId('x-add')!.tagName).toBe('P');
		expect(byId('x-add')!.textContent).toContain('the most this form holds');
	});

	test('switching a unit keeps the monthly dollars and announces it', async () => {
		const { announce, onvalidate } = await setup();
		const usdRadio = document.querySelector<HTMLInputElement>(
			'input[name="x-management-unit"][value="usd"]'
		)!;
		await userEvent.click(usdRadio);
		await vi.waitFor(() =>
			expect(byId<HTMLInputElement>('x-management-amount')!.value).toBe('152')
		);
		expect(usdRadio.checked).toBe(true);
		expect(announce).toHaveBeenCalledWith(
			'Property management changed to $ per month. Still $152 a month.'
		);
		expect(onvalidate).toHaveBeenCalledWith('expense:management');
	});

	test('arrow keys move between the two unit radios', async () => {
		await setup();
		const pct = document.querySelector<HTMLInputElement>(
			'input[name="x-maintenance-unit"][value="pct"]'
		)!;
		pct.focus();
		await userEvent.keyboard('{ArrowRight}');
		await vi.waitFor(() =>
			expect(byId<HTMLInputElement>('x-maintenance-amount')!.value).toBe('100')
		);
	});

	test('typing never validates; blur formats and validates once', async () => {
		const { onvalidate } = await setup();
		const tax = byId<HTMLInputElement>('x-tax-amount')!;
		await userEvent.fill(tax, '1234.5');
		expect(onvalidate).not.toHaveBeenCalled();
		tax.blur();
		await vi.waitFor(() => expect(tax.value).toBe('1,234.50'));
		expect(onvalidate).toHaveBeenCalledTimes(1);
		expect(onvalidate).toHaveBeenCalledWith('expense:tax');
	});

	test('axe finds no violations with a custom row', async () => {
		const { container } = await setup(addCustomLine(defaultForm()));
		expect(await axeViolations(container)).toEqual([]);
	});
});
