import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import { announcerMessage } from '$lib/components/a11y/announcer.svelte';
import DataSourceChoice from './DataSourceChoice.svelte';

type Source = 'rentcast' | 'sample';

function props(keyState: 'none' | 'locked' | 'available', value: Source = 'rentcast') {
	const onChange = vi.fn<(v: Source) => Promise<void>>(async () => {});
	return { props: { keyState, value, onChange }, onChange };
}

describe('DataSourceChoice', () => {
	test('no key: status line and Add a RentCast key link, no radios', async () => {
		const { props: p } = props('none', 'sample');
		const { container } = await render(DataSourceChoice, { props: p });
		expect(container.querySelector('[role="radio"]')).toBeNull();
		expect(container.querySelector('fieldset')).toBeNull();
		expect(container.textContent).toContain(
			'Using sample data because no RentCast key is available.'
		);
		const link = page.getByRole('link', { name: 'Add a RentCast key' });
		await expect.element(link).toHaveAttribute('href', '/settings/#api-keys');
		const icon = container.querySelector('svg[data-icon="flask-conical"]');
		expect(icon?.getAttribute('aria-hidden')).toBe('true');
		expect(await axeViolations(container)).toEqual([]);
	});

	test('locked: Unlock your keys link', async () => {
		const { props: p } = props('locked', 'sample');
		const { container } = await render(DataSourceChoice, { props: p });
		expect(container.querySelector('[role="radio"]')).toBeNull();
		await expect
			.element(page.getByRole('link', { name: 'Unlock your keys' }))
			.toHaveAttribute('href', '/settings/#key-security');
		expect(await axeViolations(container)).toEqual([]);
	});

	test('available: fieldset, legend and two radios checked per value; no Save button', async () => {
		const { props: p } = props('available', 'rentcast');
		const { container } = await render(DataSourceChoice, { props: p });
		const fieldset = container.querySelector('fieldset');
		expect(fieldset).not.toBeNull();
		expect(fieldset!.querySelector('legend')!.textContent!.trim()).toBe(
			'Where portal data comes from'
		);
		const live = page.getByRole('radio', { name: 'RentCast, with your key' });
		const sample = page.getByRole('radio', { name: 'Sample data' });
		await expect.element(live).toBeChecked();
		await expect.element(sample).not.toBeChecked();
		expect(container.textContent).toContain(
			'Real listings and estimates. Each new search uses calls from your monthly count.'
		);
		expect(container.textContent).toContain(
			'Made-up listings and numbers for exploring. Uses no calls.'
		);
		expect(container.querySelector('button:not([role="radio"])')).toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('available with value sample checks Sample data', async () => {
		const { props: p } = props('available', 'sample');
		const { container } = await render(DataSourceChoice, { props: p });
		await expect.element(page.getByRole('radio', { name: 'Sample data' })).toBeChecked();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('selecting Sample data calls onChange once, then announces', async () => {
		const { props: p, onChange } = props('available', 'rentcast');
		await render(DataSourceChoice, { props: p });
		await page.getByRole('radio', { name: 'Sample data' }).click();
		await expect.poll(() => onChange.mock.calls.length).toBe(1);
		expect(onChange).toHaveBeenCalledWith('sample');
		await expect.poll(() => announcerMessage()).toBe('Showing sample data.');
	});

	test('selecting RentCast announces Showing RentCast data.', async () => {
		const { props: p, onChange } = props('available', 'sample');
		await render(DataSourceChoice, { props: p });
		await page.getByRole('radio', { name: 'RentCast, with your key' }).click();
		await expect.poll(() => onChange.mock.calls.length).toBe(1);
		expect(onChange).toHaveBeenCalledWith('rentcast');
		await expect.poll(() => announcerMessage()).toBe('Showing RentCast data.');
	});
});
