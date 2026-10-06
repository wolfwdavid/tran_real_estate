// ResultsView in real Chromium (06-16, RENT-02): the List | Map tabs follow the WAI-ARIA pattern
// (roving tabindex, arrow keys), the Map panel mounts on first use and stays mounted, "Show 24
// more" moves focus to the first new card, and the filtered-empty state clears for free. The
// controller is the real createRenterSearch with a counting spend: one search spends once, and
// paging, tab switches and Clear filters never spend again.
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { Listing } from '@tran/core/listings';
import { DEFAULT_FILTERS } from '@tran/core/renter';
import { axeViolations } from '$lib/testing/axe';
import ResultsView from './ResultsView.svelte';
import { createRenterSearch } from './search-state.svelte';

const NOW = new Date('2026-10-05T12:00:00.000Z');

function row(i: number): Listing {
	return {
		id: `VIEW-${i}`,
		kind: 'rental',
		formattedAddress: `${i + 1} Fictional Ln, Harlow Springs, OK 74201`,
		addressLine1: `${i + 1} Fictional Ln`,
		addressLine2: null,
		city: 'Harlow Springs',
		state: 'OK',
		zipCode: '74201',
		latitude: null,
		longitude: null,
		propertyType: 'Apartment',
		bedrooms: 1 + (i % 3),
		bathrooms: 1,
		squareFootage: 700 + i,
		yearBuilt: null,
		hoaFee: null,
		price: 1200 + i * 10,
		status: 'Active',
		listingType: null,
		listedDate: '2026-10-01T00:00:00.000Z',
		removedDate: null,
		lastSeenDate: '2026-10-04T00:00:00.000Z',
		daysOnMarket: 4,
		mlsName: null,
		mlsNumber: null,
		agent: null,
		office: null,
		history: []
	};
}

async function setup(n: number) {
	const data = Array.from({ length: n }, (_, i) => row(i));
	const spend = vi.fn(async () => ({
		data,
		provenance: { source: 'sample' as const, fetchedAt: NOW.getTime(), stale: false },
		truncated: false,
		droppedRows: 0,
		requestKey: 'test'
	}));
	const search = createRenterSearch({ gateway: () => null, spend, now: () => NOW });
	search.locInput = '74201';
	await search.search();
	expect(spend).toHaveBeenCalledTimes(1);
	const onFiltersCleared = vi.fn();
	const screen = await render(ResultsView, { props: { search, onFiltersCleared } });
	return { search, spend, onFiltersCleared, container: screen.container };
}

describe('ResultsView', () => {
	it('pages locally and moves focus to the first new card', async () => {
		const { search, spend, container } = await setup(60);
		await expect
			.element(page.getByRole('tab', { name: 'List' }))
			.toHaveAttribute('aria-selected', 'true');
		expect(container.querySelectorAll('article')).toHaveLength(24);
		await expect.element(page.getByText('Showing 24 of 60')).toBeVisible();

		await page.getByRole('button', { name: 'Show 24 more' }).click();
		await expect.element(page.getByText('Showing 48 of 60')).toBeVisible();
		expect(container.querySelectorAll('article')).toHaveLength(48);
		expect(document.activeElement?.id).toBe(`card-${search.sorted[24].id}-addr`);

		await page.getByRole('button', { name: 'Show 12 more' }).click();
		expect(container.querySelectorAll('article')).toHaveLength(60);
		expect(page.getByRole('button', { name: /^Show \d+ more$/ }).query()).toBeNull();
		expect(spend).toHaveBeenCalledTimes(1);
		expect(await axeViolations(container)).toEqual([]);
	});

	it('switches tabs with the arrow keys, mounts the map once and never spends', async () => {
		const { search, spend, container } = await setup(5);
		const list = page.getByRole('tab', { name: 'List' });
		const map = page.getByRole('tab', { name: 'Map' });
		await expect.element(map).toHaveAttribute('tabindex', '-1');
		expect(container.querySelector('[data-map-tab]')).toBeNull();

		(list.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(map).toHaveAttribute('aria-selected', 'true');
		await expect.element(map).toHaveFocus();
		expect(search.view).toBe('map');
		const instructions = page.getByText('Drag, or use the arrow keys, to move the map.', {
			exact: false
		});
		await expect.element(instructions).toBeVisible();
		await expect.poll(() => container.querySelector('.leaflet-container')).not.toBeNull();
		expect(await axeViolations(container)).toEqual([]);

		await userEvent.keyboard('{ArrowLeft}');
		await expect.element(list).toHaveAttribute('aria-selected', 'true');
		expect(search.view).toBe('list');
		// Kept mounted (hidden) so the map does not reload on the next visit.
		expect(container.querySelectorAll('.leaflet-container')).toHaveLength(1);
		await expect.element(instructions).not.toBeVisible();

		await map.click();
		expect(search.view).toBe('map');
		expect(spend).toHaveBeenCalledTimes(1);
	});

	it('shows the filtered-empty state and clears filters for free', async () => {
		const { search, spend, onFiltersCleared, container } = await setup(5);
		search.setFilters({ ...DEFAULT_FILTERS, priceMax: 1 });
		await expect
			.element(page.getByRole('heading', { level: 3, name: 'No rentals match these filters' }))
			.toBeVisible();
		await expect
			.element(page.getByText('Clearing them costs nothing.', { exact: false }))
			.toBeVisible();
		expect(await axeViolations(container)).toEqual([]);

		await page.getByRole('button', { name: 'Clear filters' }).click();
		expect(container.querySelectorAll('article')).toHaveLength(5);
		expect(onFiltersCleared).toHaveBeenCalledTimes(1);
		expect(spend).toHaveBeenCalledTimes(1);
		search.dispose();
	});
});
