// ShortlistCard in real Chromium (06-15, RENT-05): the rent-change line appears only for a NEWER
// cached row with a different rent (read through peekListingById, never a spend), and the notes
// editor saves explicitly, cancels on Escape, and returns focus to its Add/Edit button.
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { Listing } from '@tran/core/listings';
import type { ShortlistItem } from '@tran/core/renter/records';
import { axeViolations } from '$lib/testing/axe';
import { getShortlistRepo } from '../storage/shortlist-repo';
import ShortlistCard from './ShortlistCard.svelte';

const SAVED_AT = Date.parse('2026-10-01T00:00:00.000Z');
const STREET = '12 Fictional Ln';

function row(id: string, price: number): Listing {
	return {
		id,
		kind: 'rental',
		formattedAddress: `${STREET}, Harlow Springs, OK 74201`,
		addressLine1: STREET,
		addressLine2: null,
		city: 'Harlow Springs',
		state: 'OK',
		zipCode: '74201',
		latitude: null,
		longitude: null,
		propertyType: 'Condo',
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900,
		yearBuilt: null,
		hoaFee: null,
		price,
		status: 'Active',
		listingType: null,
		listedDate: '2026-09-28T00:00:00.000Z',
		removedDate: null,
		lastSeenDate: new Date().toISOString(),
		daysOnMarket: null,
		mlsName: null,
		mlsNumber: null,
		agent: null,
		office: null,
		history: []
	} as Listing;
}

async function saved(price = 1500): Promise<ShortlistItem> {
	const id = `CARD-${crypto.randomUUID()}`;
	return getShortlistRepo().add(row(id, price), { source: 'rentcast', fetchedAt: SAVED_AT });
}

const gatewayWith = (listing: Listing, fetchedAt: number) => ({
	peekListingById: vi.fn(async () => ({
		listing,
		provenance: { source: 'rentcast' as const, fetchedAt, stale: false }
	}))
});

describe('ShortlistCard rent change', () => {
	it('says the rent changed when a newer cached row has a different rent', async () => {
		const item = await saved(1500);
		const fresh = row(item.listingId, 1575);
		fresh.lastSeenDate = '2026-10-04T00:00:00.000Z';
		const gateway = gatewayWith(fresh, SAVED_AT + 86_400_000);
		const { container } = await render(ShortlistCard, { props: { item, gateway } });

		await expect
			.element(page.getByText('Rent changed from $1,500 to $1,575 on Oct 4.'))
			.toBeVisible();
		expect(gateway.peekListingById).toHaveBeenCalledWith(item.listingId);
		expect(await axeViolations(container)).toEqual([]);
	});

	it('stays quiet for the same rent or an older cached row', async () => {
		const item = await saved(1500);
		const same = gatewayWith(row(item.listingId, 1500), SAVED_AT + 1000);
		const r1 = await render(ShortlistCard, { props: { item, gateway: same } });
		await vi.waitFor(() => expect(same.peekListingById).toHaveBeenCalled());
		expect(r1.container.querySelector('[data-rent-change]')).toBeNull();
		r1.unmount();

		const older = gatewayWith(row(item.listingId, 1400), SAVED_AT - 1000);
		const r2 = await render(ShortlistCard, { props: { item, gateway: older } });
		await vi.waitFor(() => expect(older.peekListingById).toHaveBeenCalled());
		expect(r2.container.querySelector('[data-rent-change]')).toBeNull();
	});
});

describe('NotesEditor (inside the card)', () => {
	it('saves explicitly, persists, and returns focus to the notes button', async () => {
		const item = await saved();
		await render(ShortlistCard, { props: { item } });

		await page.getByRole('button', { name: 'Add notes' }).click();
		const field = page.getByRole('textbox', { name: `Notes for ${STREET}` });
		await expect.element(field).toHaveFocus();
		await userEvent.keyboard('Ask about parking');
		await expect.element(page.getByText('17 of 2,000')).toBeVisible();
		// No axe here: component tests load no CSS, so the two adjacent unstyled buttons trip
		// target-size. renter-shortlist.spec.ts runs axe with notes editing open.

		await page.getByRole('button', { name: 'Save notes' }).click();
		await vi.waitFor(async () =>
			expect((await getShortlistRepo().getByListingId(item.listingId))?.notes).toBe(
				'Ask about parking'
			)
		);
		await expect.element(page.getByRole('button', { name: /notes$/ })).toHaveFocus();
	});

	it('Escape cancels without saving and refocuses the notes button', async () => {
		const item = await saved();
		await render(ShortlistCard, { props: { item } });

		await page.getByRole('button', { name: 'Add notes' }).click();
		await userEvent.keyboard('Draft that should not be kept');
		await userEvent.keyboard('{Escape}');

		await expect.element(page.getByRole('button', { name: 'Add notes' })).toHaveFocus();
		expect((await getShortlistRepo().getByListingId(item.listingId))?.notes).toBe('');
	});
});
