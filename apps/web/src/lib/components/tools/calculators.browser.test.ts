// Real-browser coverage for the free calculators (GTM-03): empty, example, invalid and (DSCR)
// not-applicable states, the debounced polite summary, Clear focus, and axe on each state.
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { announcerMessage } from '$lib/components/a11y/announcer.svelte';
import { axeViolations } from '$lib/testing/axe';
import CapRateCalculator from './CapRateCalculator.svelte';
import CashOnCashCalculator from './CashOnCashCalculator.svelte';
import DscrCalculator from './DscrCalculator.svelte';

const fillExample = () => page.getByRole('button', { name: 'Fill in an example' }).click();

describe('calculators (browser)', () => {
	test('cap rate: empty state, example figures, one debounced announcement, clear', async () => {
		const { container } = await render(CapRateCalculator);
		await expect
			.element(
				page.getByText('Enter a purchase price, monthly rent, vacancy rate', { exact: false })
			)
			.toBeVisible();
		expect(container.querySelector('[aria-live]')).toBeNull();
		expect(await axeViolations(container)).toEqual([]);

		await fillExample();
		await expect.element(page.getByText('6.24%')).toBeVisible();
		await expect.element(page.getByText('$22,800')).toBeVisible();
		await expect.element(page.getByText('Example numbers, not market data.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Fill in an example' })).toHaveFocus();
		await expect
			.poll(announcerMessage, { timeout: 2000 })
			.toBe('Cap rate 6.24%. Net operating income $15,600 a year.');
		expect(await axeViolations(container)).toEqual([]);

		await page.getByRole('button', { name: 'Clear' }).click();
		await expect
			.element(page.getByRole('textbox', { name: 'Purchase price, in dollars' }))
			.toHaveFocus();
		await expect.poll(announcerMessage).toBe('Calculator cleared.');
		await expect.element(page.getByText('6.24%')).not.toBeInTheDocument();
	});

	test('cap rate: errors show on blur, link by aria-describedby, and submit focuses the first', async () => {
		const { container } = await render(CapRateCalculator);
		const price = page.getByRole('textbox', { name: 'Purchase price, in dollars' });
		await price.fill('abc');
		await userEvent.tab();
		await expect.element(page.getByText('Use numbers only, like 250,000.')).toBeVisible();
		await expect.element(price).toHaveAttribute('aria-invalid', 'true');
		await expect.element(price).toHaveAccessibleDescription(/Use numbers only/);
		expect(await axeViolations(container)).toEqual([]);

		await price.fill('250000');
		await userEvent.tab();
		await expect.element(price).toHaveValue('250,000');
		await expect.element(page.getByText('Use numbers only, like 250,000.')).not.toBeInTheDocument();

		await price.click();
		await userEvent.keyboard('{Enter}');
		await expect.element(page.getByText('Enter monthly rent.')).toBeVisible();
		await expect
			.element(page.getByRole('textbox', { name: 'Monthly rent, in dollars' }))
			.toHaveFocus();
	});

	test('cash-on-cash: example gives 0.90% and the supporting rows', async () => {
		const { container } = await render(CashOnCashCalculator);
		await fillExample();
		await expect.element(page.getByText('0.90%')).toBeVisible();
		await expect.element(page.getByText('$70,000')).toBeVisible();
		await expect.element(page.getByText('$1,247')).toBeVisible();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('DSCR: example gives 1.04 and covers; a $0 loan is not applicable', async () => {
		const { container } = await render(DscrCalculator);
		await fillExample();
		await expect.element(page.getByText('1.04')).toBeVisible();
		await expect.element(page.getByText('The income covers the loan payments.')).toBeVisible();

		await page.getByRole('textbox', { name: 'Loan amount, in dollars' }).fill('0');
		await expect.element(page.getByText("DSCR doesn't apply", { exact: false })).toBeVisible();
		await expect
			.element(page.getByText('Example numbers, not market data.'))
			.not.toBeInTheDocument();
		expect(await axeViolations(container)).toEqual([]);
	});
});
