// ShortlistToggle in real Chromium (06-14, RENT-05): the shortlist liveQuery drives the pressed
// state, a plain Saved item is removed at once, an item with notes asks first (focus starts on
// "Keep it"), and focus returns to the toggle after the dialog closes either way.
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import { getShortlistRepo } from '../storage/shortlist-repo';
import ShortlistToggle from './ShortlistToggle.svelte';

const PROV = { source: 'sample' as const, fetchedAt: Date.parse('2026-10-01T00:00:00.000Z') };
const STREET = '12 Fictional Ln';

function props(variant: 'card' | 'detail') {
	const id = `TOGGLE-${crypto.randomUUID()}`;
	return { id, props: { row: { id, price: 1500 }, provenance: PROV, variant, streetLine: STREET } };
}

describe('ShortlistToggle (detail)', () => {
	it('saves, shows the shortlist link, and removes a plain Saved item without asking', async () => {
		const { id, props: p } = props('detail');
		const { container } = await render(ShortlistToggle, { props: p });

		const save = page.getByRole('button', { name: 'Save to shortlist' });
		await expect.element(save).toHaveAttribute('aria-pressed', 'false');
		await save.click();

		const on = page.getByRole('button', { name: 'On your shortlist' });
		await expect.element(on).toHaveAttribute('aria-pressed', 'true');
		const link = page.getByRole('link', { name: 'See it on your shortlist' });
		await expect
			.element(link)
			.toHaveAttribute('href', `/renter/shortlist/#item-${encodeURIComponent(id)}`);
		expect(await getShortlistRepo().getByListingId(id)).toBeDefined();
		expect(await axeViolations(container)).toEqual([]);

		await on.click();
		await expect.element(page.getByRole('button', { name: 'Save to shortlist' })).toBeVisible();
		expect(page.getByRole('alertdialog').query()).toBeNull();
		expect(await getShortlistRepo().getByListingId(id)).toBeUndefined();
	});

	it('asks before removing an item with notes; Keep it keeps it and refocuses the toggle', async () => {
		const { id, props: p } = props('detail');
		await getShortlistRepo().add(p.row, PROV);
		await getShortlistRepo().setNotes(id, 'Ask about parking');
		await render(ShortlistToggle, { props: p });

		const on = page.getByRole('button', { name: 'On your shortlist' });
		await expect.element(on).toHaveAttribute('aria-pressed', 'true');
		await on.click();

		const dialog = page.getByRole('alertdialog');
		await expect
			.element(dialog.getByRole('heading', { name: 'Remove this listing from your shortlist?' }))
			.toBeVisible();
		await expect
			.element(dialog)
			.toHaveTextContent(`Your status and notes for ${STREET} will be deleted from this browser.`);
		const keep = page.getByRole('button', { name: 'Keep it' });
		await expect.element(keep).toHaveFocus();
		expect(await axeViolations(document.body)).toEqual([]);

		await userEvent.click(keep);
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'On your shortlist' })).toHaveFocus();
		expect((await getShortlistRepo().getByListingId(id))?.notes).toBe('Ask about parking');
	});

	it('Remove listing removes it and focus lands on the new Save to shortlist button', async () => {
		const { id, props: p } = props('detail');
		await getShortlistRepo().add(p.row, PROV);
		await getShortlistRepo().setStatus(id, 'toured');
		await render(ShortlistToggle, { props: p });

		await page.getByRole('button', { name: 'On your shortlist' }).click();
		await page.getByRole('button', { name: 'Remove listing' }).click();

		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		const save = page.getByRole('button', { name: 'Save to shortlist' });
		await expect.element(save).toHaveFocus();
		expect(await getShortlistRepo().getByListingId(id)).toBeUndefined();
	});
});

describe('ShortlistToggle (card)', () => {
	it('names the button with the street line and toggles Save / Saved', async () => {
		const { props: p } = props('card');
		const { container } = await render(ShortlistToggle, { props: p });

		const save = page.getByRole('button', { name: `Save ${STREET} to shortlist` });
		await expect.element(save).toHaveTextContent('Save');
		await save.click();
		const saved = page.getByRole('button', { name: `Saved to shortlist: ${STREET}` });
		await expect.element(saved).toHaveAttribute('aria-pressed', 'true');
		await expect.element(saved).toHaveTextContent('Saved');
		expect(page.getByRole('link').query()).toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});
});
