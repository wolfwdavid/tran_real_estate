// Real-browser coverage for the shared listing components: bound refs, focus, and axe.
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import ListingStatusChip from './ListingStatusChip.svelte';
import PriceHistory from './PriceHistory.svelte';
import PropertyTypeMark from './PropertyTypeMark.svelte';
import LocationFieldHarness from './testing/LocationFieldHarness.svelte';

const NOW = new Date('2026-10-05T12:00:00Z');

describe('LocationField (browser)', () => {
	test('bound inputEl focuses the input and bound value tracks typing', async () => {
		const { container } = await render(LocationFieldHarness, { props: {} });
		await page.getByRole('button', { name: 'Focus field' }).click();
		const input = page.getByRole('textbox', { name: 'City and state, or ZIP code' });
		await expect.element(input).toHaveFocus();
		await userEvent.keyboard('Austin, TX');
		expect(container.querySelector('[data-value]')?.textContent).toBe('Austin, TX');
		await expect.element(input).toHaveAccessibleDescription('For example, Austin, TX or 78701.');
		expect(await axeViolations(container)).toEqual([]);
	});

	test('error state is described and passes axe', async () => {
		const { container } = await render(LocationFieldHarness, { props: { error: 'bad-zip' } });
		const input = page.getByRole('textbox', { name: 'City and state, or ZIP code' });
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		await expect
			.element(input)
			.toHaveAccessibleDescription(
				'For example, Austin, TX or 78701. ZIP codes have 5 digits, like 78701.'
			);
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe('PriceHistory (browser)', () => {
	test('scrollable table region is focusable and the page passes axe', async () => {
		const { container } = await render(PriceHistory, {
			props: {
				history: {
					'2026-06-01': { price: 2200 },
					'2026-07-01': { price: 2150 },
					'2026-08-01': { price: 2000 },
					'2026-09-01': { price: 2050 }
				},
				listedDate: '2026-06-01',
				sample: true
			}
		});
		const region = page.getByRole('region', { name: 'Listing events from RentCast' });
		await userEvent.tab();
		await expect.element(region).toHaveFocus();
		expect(container.querySelector('svg[data-sparkline]')).not.toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe('chips and marks (browser)', () => {
	test('status chips and a mark disc pass axe', async () => {
		const { container } = await render(ListingStatusChip, {
			props: { row: { status: 'Active', lastSeenDate: '2026-09-20' }, now: NOW }
		});
		expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Not seen lately: last seen listed Sep 20'
		);
		expect(await axeViolations(container)).toEqual([]);
		const mark = await render(PropertyTypeMark, { props: { type: 'Townhouse', size: 'detail' } });
		const svg = mark.container.querySelector('svg');
		expect(svg?.getBoundingClientRect().width).toBe(64);
		expect(await axeViolations(mark.container)).toEqual([]);
	});
});
