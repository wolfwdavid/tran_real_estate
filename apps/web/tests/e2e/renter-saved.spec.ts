import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedSavedSearches } from './helpers/data';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls, type Net } from './support/network';
import { mockRentCast, RENTAL_LISTINGS_PATH, rentcastFixtures } from './support/rentcast-mocks';
import { expectLiveMode, expectSampleMode, withRentCastKey } from './support/seed';

// RENT-04 end to end on both bases: saving a search spends nothing; Phase 4's on-open scheduler
// re-runs it at most once per 24 hours (page.clock); the row counts only new listings that match
// the saved filters; View results badges them "New" at 0 calls and marks them seen; the 10-search
// limit explains itself; rename and delete are storage-only and keep the shortlist.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const T = new Date('2026-10-15T12:00:00Z').getTime();
const HOUR = 3_600_000;
const NAME = '74201 · Up to $2,000';

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

const form = (page: Page) => page.getByRole('search', { name: 'Search rentals' });
const searchButton = (page: Page) => form(page).getByRole('button', { name: /^Search rentals/ });
const locationInput = (page: Page) =>
	page.getByRole('textbox', { name: 'City and state, or ZIP code' });
const maxInput = (page: Page) => page.getByRole('textbox', { name: 'Max', exact: true });
const heading = (page: Page) => page.locator('#results-heading');
const section = (page: Page) => page.locator('section[aria-labelledby="saved-searches-heading"]');
const savedRow = (page: Page, name: string) =>
	section(page)
		.locator('[data-saved-search]')
		.filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });
const saveButton = (page: Page) =>
	page.getByRole('button', { name: 'Save this search', exact: true });
const announcer = (page: Page) => page.getByTestId('live-announcer');
const listingCalls = (net: Net) => rentcastCalls(net, RENTAL_LISTINGS_PATH);

async function open(page: Page, path = 'renter/') {
	await page.goto(path);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Find a rental' })).toBeVisible();
}

/** A new 74201 listing (cloned from a fixture row) at `price`, listed just now so it sorts first. */
function newListing(id: string, price: number, listedAt: number): Record<string, unknown> {
	const base = rentcastFixtures().rentals.find(
		(r) => r.zipCode === '74201' && r.status === 'Active'
	)!;
	const listed = new Date(listedAt).toISOString();
	return {
		...base,
		id,
		price,
		status: 'Active',
		removedDate: null,
		listedDate: listed,
		createdDate: listed,
		lastSeenDate: listed,
		daysOnMarket: 0,
		formattedAddress: `${id} Test Ln, Harlow Springs, OK 74201`,
		addressLine1: `${id} Test Ln`
	};
}

async function saveCurrentSearch(page: Page, expectedName: string) {
	await saveButton(page).click();
	const dialog = page.getByRole('dialog', { name: 'Save this search' });
	const name = dialog.getByRole('textbox', { name: 'Name' });
	await expect(name).toHaveValue(expectedName);
	await expect(name).toBeFocused();
	await dialog.getByRole('button', { name: 'Save search' }).click();
	await expect(dialog).toBeHidden();
	await expect(announcer(page)).toHaveText(`Search saved: ${expectedName}.`);
	const saved = page.getByRole('button', { name: 'Saved search' });
	await expect(saved).toHaveAttribute('aria-pressed', 'true');
}

test('save, re-run at most once per 24 hours, N new filtered, View results badges and marks seen', async ({
	page,
	net
}) => {
	const extraRows: Record<string, unknown>[] = [];
	await page.clock.setFixedTime(T);
	await mockRentCast(page, net, { extraRows });
	await withRentCastKey(page);
	await open(page);
	await expectLiveMode(page);

	await locationInput(page).fill('74201');
	await searchButton(page).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in 74201$/);
	expect(listingCalls(net)).toBe(1);
	await maxInput(page).fill('2000');
	await expect(
		page.getByText("Save this search to see what's new each time you come back.")
	).toBeVisible();

	// The dialog: name prefilled, body copy, axe clean. Saving spends nothing.
	await saveButton(page).click();
	const dialog = page.getByRole('dialog', { name: 'Save this search' });
	await expect(
		dialog.getByText('Tran checks saved searches when you open it, at most once a day each.', {
			exact: false
		})
	).toBeVisible();
	await expectNoViolations(page, 'save dialog');
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await saveCurrentSearch(page, NAME);
	await expect(savedRow(page, NAME).getByText('No new listings')).toBeVisible();
	await expect(savedRow(page, NAME).getByText(/^Checked .* from RentCast$/)).toBeVisible();
	expect(listingCalls(net)).toBe(1);

	// "Manage in Saved searches" moves focus to the row.
	await page.getByRole('link', { name: 'Manage in Saved searches' }).click();
	await expect(savedRow(page, NAME).getByRole('heading', { level: 3 })).toBeFocused();

	// Within 24 hours: not due, 0 calls.
	await page.clock.setFixedTime(T + HOUR);
	await page.reload();
	await expect(savedRow(page, NAME).getByText('No new listings')).toBeVisible();
	await expectLiveMode(page);
	expect(listingCalls(net)).toBe(1);

	// After 24 hours: 3 new listings, 2 within Max $2,000. Exactly 1 scheduled call.
	extraRows.push(
		newListing('NEW-1', 1500, T + 24 * HOUR),
		newListing('NEW-2', 1800, T + 24 * HOUR),
		newListing('NEW-3', 3000, T + 24 * HOUR)
	);
	await page.clock.setFixedTime(T + 25 * HOUR);
	await page.reload();
	await expect(savedRow(page, NAME).getByText('2 new since your last visit')).toBeVisible();
	expect(listingCalls(net)).toBe(2);
	await expectNoViolations(page, 'saved searches with a new count');

	// Reload again at the same time: already checked today, 0 more calls.
	await page.reload();
	await expect(savedRow(page, NAME).getByText('2 new since your last visit')).toBeVisible();
	expect(listingCalls(net)).toBe(2);

	// View results: 0 calls, exactly the 2 matching new listings are badged, and the row resets.
	await page.getByRole('link', { name: `View results for ${NAME}` }).click();
	const newCards = page.locator('[data-listing-card]').filter({ hasText: 'since your last visit' });
	await expect(newCards).toHaveCount(2);
	await expect(page).not.toHaveURL(/saved=/);
	await expect(maxInput(page)).toHaveValue('2000');
	await expect(savedRow(page, NAME).getByText('No new listings')).toBeVisible();
	expect(listingCalls(net)).toBe(2);

	await open(page);
	await expect(savedRow(page, NAME).getByText('No new listings')).toBeVisible();
	expect(listingCalls(net)).toBe(2);
});

test('limit: at 10 saved searches the dialog explains instead of saving', async ({ page, net }) => {
	await open(page);
	await expectSampleMode(page);
	await seedSavedSearches(page, 10, { lastRunAt: Date.now() });
	await expect(page.getByRole('heading', { level: 1, name: 'Find a rental' })).toBeVisible();
	await page.getByRole('button', { name: 'Try a sample search' }).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in /);

	await saveButton(page).click();
	const dialog = page.getByRole('dialog', { name: 'You have 10 saved searches' });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText(
			"That's the most Tran keeps, so daily checks fit inside your monthly calls. Delete a saved search to save this one."
		)
	).toBeVisible();
	await expect(dialog.getByRole('button')).toHaveCount(1);
	await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
	await expect(dialog.getByRole('textbox')).toHaveCount(0);
	await expectNoViolations(page, 'limit dialog');
	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
	expect(rentcastCalls(net)).toBe(0);
});

test('sample: rename and delete are storage-only, the shortlist stays, no fake "new"', async ({
	page,
	net
}) => {
	await open(page);
	await expectSampleMode(page);
	await page.getByRole('button', { name: 'Try a sample search' }).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in (\d{5})$/);
	const zip = (await heading(page).textContent())!.match(/(\d{5})$/)![1]!;

	// Shortlist one listing first.
	const firstCard = page.locator('[data-listing-card]').first();
	await firstCard.getByRole('button', { name: /^Save .+ to shortlist$/ }).click();
	await expect(firstCard.getByRole('button', { name: /^Saved to shortlist: / })).toBeVisible();
	const shortlisted = (await firstCard.getByRole('link').first().textContent())!.trim();

	await saveCurrentSearch(page, zip);
	const row = savedRow(page, zip);
	await expect(row.locator('[data-provenance-chip="sample"]')).toHaveText('Sample data');
	await expect(row.getByText(/\(sample data\)/)).toBeVisible();
	await expect(row.getByText(/new since your last visit/)).toHaveCount(0);

	// Rename.
	await row.getByRole('button', { name: 'Rename' }).click();
	const rename = page.getByRole('dialog', { name: 'Rename this search' });
	const nameBox = rename.getByRole('textbox', { name: 'Name' });
	await expect(nameBox).toHaveValue(zip);
	await nameBox.fill('');
	await rename.getByRole('button', { name: 'Save name' }).click();
	await expect(rename.getByText('Give this search a name.')).toBeVisible();
	await nameBox.fill('Near work');
	await rename.getByRole('button', { name: 'Save name' }).click();
	await expect(announcer(page)).toHaveText('Search renamed to Near work.');
	const renamed = savedRow(page, 'Near work');
	await expect(renamed).toBeVisible();

	// Delete: Keep search has initial focus; Delete search removes the row.
	await renamed.getByRole('button', { name: 'Delete' }).click();
	const confirm = page.getByRole('alertdialog', { name: 'Delete this saved search?' });
	await expect(confirm.getByRole('button', { name: 'Keep search' })).toBeFocused();
	await expect(confirm).toContainText('Listings on your shortlist stay there.');
	await confirm.getByRole('button', { name: 'Delete search' }).click();
	await expect(announcer(page)).toHaveText('Saved search deleted.');
	await expect(section(page)).toHaveCount(0);
	await expect(saveButton(page)).toBeVisible();

	await page.goto('renter/shortlist/');
	await expect(page.getByText(shortlisted, { exact: false }).first()).toBeVisible();
	expect(rentcastCalls(net)).toBe(0);
});
