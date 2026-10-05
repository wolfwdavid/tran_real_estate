// OutreachSection in real Chromium (06-18, RENT-07): the form validates before the panel runs
// (field errors, focus on the first invalid field, nothing generated), the email exit addresses
// the validated listing email with "Question about {street line}", a listing without an email
// shows the no-recipient note, and a keyless Draft message streams the sample draft.
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { Listing } from '@tran/core/listings';
import type { Provenance } from '$lib/data';
import { axeViolations } from '$lib/testing/axe';
import OutreachSection from './OutreachSection.svelte';

const PROV: Provenance = {
	source: 'sample',
	fetchedAt: Date.parse('2026-10-01T00:00:00.000Z'),
	stale: false
};

function listing(over: Partial<Listing> = {}): Listing {
	return {
		id: `OUTREACH-${crypto.randomUUID()}`,
		kind: 'rental',
		formattedAddress: '12 Fictional Ln, Harlow Springs, OK 74201',
		addressLine1: '12 Fictional Ln',
		addressLine2: null,
		city: 'Harlow Springs',
		state: 'OK',
		zipCode: '74201',
		latitude: null,
		longitude: null,
		propertyType: 'Apartment',
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900,
		yearBuilt: 1990,
		price: 1250,
		status: 'Active',
		listingType: null,
		listedDate: null,
		removedDate: null,
		lastSeenDate: null,
		daysOnMarket: 5,
		mlsName: null,
		mlsNumber: null,
		agent: { name: 'Pat Example', phone: null, email: 'pat@example.com', website: null },
		office: null,
		history: [],
		...over
	};
}

// Component tests load no CSS, so 44px rows render at text height and trip target-size; the E2E
// axe runs cover sizes (same filter as GenerationPanel.browser.test.ts).
const axe = async (root: Element) =>
	(await axeViolations(root)).filter((v) => !v.startsWith('target-size:'));

const draftButton = () => page.getByRole('button', { name: 'Draft message' });
const emailLink = () =>
	document.querySelector<HTMLAnchorElement>('[data-testid="generation-exits"] a');

/** Draft message, then wait for the finished (keyless sample) draft: the exits ungate then. */
async function draftAndWait(container: Element): Promise<void> {
	await draftButton().click();
	await vi.waitFor(() => expect(container.textContent).toContain('Draft ready.'), {
		timeout: 20_000
	});
}

describe('OutreachSection', () => {
	it('renders the form and the panel with exactly three exits', async () => {
		const { container } = await render(OutreachSection, {
			props: { row: listing(), provenance: PROV }
		});
		await expect
			.element(page.getByRole('heading', { level: 2, name: 'Message the listing contact' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('heading', { level: 3, name: 'Your message' }))
			.toBeVisible();
		expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(4);
		await expect.element(page.getByRole('radio', { name: 'No pets' })).toBeChecked();
		expect(container.querySelector('[data-outreach-no-recipient]')).toBeNull();
		expect(container.querySelectorAll('[data-testid="generation-exits"] > *')).toHaveLength(3);
		expect(await axe(container)).toEqual([]);
	});

	it('shows "What pets?" only when Yes is chosen, and counts the question', async () => {
		await render(OutreachSection, { props: { row: listing(), provenance: PROV } });
		expect(page.getByLabelText('What pets?').query()).toBeNull();
		await page.getByRole('radio', { name: 'Yes' }).click();
		const pets = page.getByLabelText('What pets?');
		await expect.element(pets).toHaveAttribute('maxlength', '60');
		await page.getByLabelText('Anything else to ask').fill('Is parking included?');
		await expect.element(page.getByText('20 of 500')).toBeVisible();
	});

	it('a bad people count blocks generation and focuses the field', async () => {
		const { container } = await render(OutreachSection, {
			props: { row: listing(), provenance: PROV }
		});
		const people = page.getByLabelText('How many people will live there');
		await people.fill('13');
		await draftButton().click();
		await expect
			.element(page.getByText('Enter a number from 1 to 12, or leave it blank.'))
			.toBeVisible();
		await expect.element(people).toHaveFocus();
		await expect.element(people).toHaveAttribute('aria-invalid', 'true');
		// Nothing ran: the label did not swap to Stop / Generate again and no draft exists.
		await expect.element(draftButton()).toBeVisible();
		expect(container.textContent).not.toContain('Draft ready.');
		expect(await axe(container)).toEqual([]);

		await people.fill('3');
		await expect
			.element(page.getByText('Enter a number from 1 to 12, or leave it blank.'))
			.not.toBeInTheDocument();
	});

	it('no topic and no question shows the fieldset error and focuses the first topic', async () => {
		await render(OutreachSection, { props: { row: listing(), provenance: PROV } });
		for (const name of [
			'Availability and move-in timing',
			'Pet policy and pet fees',
			'Application fees and deposit',
			'Lease length and terms'
		]) {
			await page.getByRole('checkbox', { name }).click();
		}
		await draftButton().click();
		await expect
			.element(page.getByText('Choose at least one topic, or type a question below.'))
			.toBeVisible();
		await expect
			.element(page.getByRole('checkbox', { name: 'Availability and move-in timing' }))
			.toHaveFocus();
		await expect.element(draftButton()).toBeVisible();
	});

	it('a listing without an email shows the no-recipient note and a bare mailto', async () => {
		const { container } = await render(OutreachSection, {
			props: {
				row: listing({
					agent: {
						name: 'Pat Example',
						phone: '405-555-0142',
						email: 'not an email',
						website: null
					},
					office: { name: 'Example Office', phone: null, email: null, website: null }
				}),
				provenance: PROV
			}
		});
		await expect
			.element(page.getByText(/^RentCast didn't list an email for this contact/))
			.toBeVisible();
		expect(await axe(container)).toEqual([]);
		await draftAndWait(container);
		expect(emailLink()?.getAttribute('href') ?? '').toMatch(/^mailto:\?subject=/);
	});

	it('the office email is the fallback recipient', async () => {
		const { container } = await render(OutreachSection, {
			props: {
				row: listing({
					agent: null,
					office: {
						name: 'Example Office',
						phone: null,
						email: 'leasing@example.com',
						website: null
					}
				}),
				provenance: PROV
			}
		});
		await draftAndWait(container);
		expect(emailLink()?.getAttribute('href') ?? '').toMatch(/^mailto:leasing@example\.com\?/);
	});

	it('keyless, Draft message streams the sample draft to a mailto for the listing email', async () => {
		const { container } = await render(OutreachSection, {
			props: { row: listing(), provenance: PROV }
		});
		await page.getByLabelText('How many people will live there').fill('3');
		await draftAndWait(container);
		const href = emailLink()?.getAttribute('href') ?? '';
		expect(href).toMatch(
			/^mailto:pat@example\.com\?subject=Question%20about%2012%20Fictional%20Ln&/
		);
		expect(href).toContain('body=');
	});
});
