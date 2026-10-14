// Real-browser coverage for the affordability calculator: typing, the debounced result, the slider
// keyboard contract, the paired number input, and axe on the empty and filled states.
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import AffordabilityCalculator from './AffordabilityCalculator.svelte';

async function fillContract() {
	await page.getByRole('textbox', { name: 'Income before taxes' }).fill('72,000');
	await page.getByRole('textbox', { name: 'Monthly debt payments' }).fill('400');
	await expect
		.element(page.getByRole('heading', { name: 'Rent that fits: $1,500 to $1,800 a month' }))
		.toBeVisible();
}

describe('AffordabilityCalculator (browser)', () => {
	test('empty state passes axe', async () => {
		const { container } = await render(AffordabilityCalculator);
		await expect.element(page.getByText('Enter your income to see a rent range.')).toBeVisible();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('income gives the contract range; the slider and number input stay paired', async () => {
		const { container } = await render(AffordabilityCalculator);
		await fillContract();
		const slider = page.getByRole('slider', { name: 'Try a rent amount' });
		await expect.element(slider).toHaveAttribute('aria-valuetext', '$1,800 a month');
		await expect.element(slider).toHaveAttribute('aria-valuemax', '10000');
		await expect.element(slider).toHaveAttribute('aria-labelledby', 'afford-try-label');
		await expect.element(page.getByText('within the 30% guideline')).toBeVisible();

		await page.getByRole('spinbutton', { name: 'Try a rent amount a month' }).fill('2100');
		await expect.element(slider).toHaveAttribute('aria-valuetext', '$2,100 a month');
		await expect.element(page.getByText('above the 40% check')).toBeVisible();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('the slider is keyboard operable in $25 steps and drives the number input', async () => {
		await render(AffordabilityCalculator);
		await fillContract();
		const slider = page.getByRole('slider', { name: 'Try a rent amount' });
		// The slider module is imported after mount; wait for it before reading the element.
		await expect.element(slider).toHaveAttribute('aria-valuetext', '$1,800 a month');
		(slider.element() as HTMLElement).focus();
		await expect.element(slider).toHaveFocus();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(slider).toHaveAttribute('aria-valuetext', '$1,825 a month');
		await expect
			.element(page.getByRole('spinbutton', { name: 'Try a rent amount a month' }))
			.toHaveValue(1825);
		await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
		await expect.element(slider).toHaveAttribute('aria-valuetext', '$1,775 a month');
	});

	test('a month period reads the income as monthly', async () => {
		await render(AffordabilityCalculator);
		await page.getByRole('textbox', { name: 'Income before taxes' }).fill('6000');
		await page.getByRole('radio', { name: 'a month' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Rent that fits: $1,500 to $1,800 a month' }))
			.toBeVisible();
	});

	test('a blank income shows its error after blur', async () => {
		const { container } = await render(AffordabilityCalculator);
		const income = page.getByRole('textbox', { name: 'Income before taxes' });
		(income.element() as HTMLElement).focus();
		await userEvent.tab();
		await expect.element(income).toHaveAttribute('aria-invalid', 'true');
		await expect
			.element(income)
			.toHaveAccessibleDescription('Enter your income before taxes, like 60,000.');
		expect(await axeViolations(container)).toEqual([]);
	});
});
