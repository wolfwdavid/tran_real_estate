import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls } from './support/network';
import { mockRentCast, rentcastFixtures, RENTAL_LISTINGS_PATH } from './support/rentcast-mocks';
import { withRentCastKey } from './support/seed';

// RENT-03 / RENT-05 end to end on both bases: /renter/listing/?id= resolves at 0 calls (shortlist
// snapshot, cached rows, sample fixtures), spends exactly one call only when the renter presses
// "Look it up again (1 call)", saves to the shortlist, and never renders a listing value that is
// not a safe tel:/mailto:/http(s) link. Every network request goes through the 06-09 harness.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** A fixture with a dash in its id, an HOA fee, three history entries and full contact details. */
const FIXTURE_ID = 'SAMPLE-74201-R017';
const UNKNOWN_ID = '74201-Unknown-Ln';
const UNKNOWN_PATH = '/v1/listings/rental/long-term/74201-Unknown-Ln';
const BY_ID = (id: string) => `${RENTAL_LISTINGS_PATH}/${encodeURIComponent(id)}`;

type Row = Record<string, unknown>;

function fixtureRow(id: string): Row {
	const row = rentcastFixtures().rentals.find((r) => r.id === id);
	if (!row) throw new Error(`fixture ${id} missing`);
	return structuredClone(row);
}

/** The street line the detail page uses as its h1 (addressLine1 [+ ", " + addressLine2]). */
function street(row: Row): string {
	const line2 = typeof row.addressLine2 === 'string' ? row.addressLine2.trim() : '';
	return line2 ? `${row.addressLine1 as string}, ${line2}` : (row.addressLine1 as string);
}

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** The Phase 4 rule: every [data-provenance="sample"] block shows a visible Sample chip. */
async function unbadgedSampleCards(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			Array.from(document.querySelectorAll('[data-provenance="sample"]')).filter(
				(card) =>
					!Array.from(card.querySelectorAll('[data-provenance-chip="sample"]')).some(
						(chip) => chip.getClientRects().length > 0
					)
			).length
	);
}

async function openListing(page: Page, id: string | null) {
	await page.goto(id === null ? 'renter/listing/' : `renter/listing/?id=${encodeURIComponent(id)}`);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByText('Loading listing…')).toHaveCount(0);
}

const lookUpButton = (page: Page) =>
	page.getByRole('button', { name: 'Look it up again (1 call)' });

test('keyless: a sample listing resolves at 0 calls with facts, history and contact', async ({
	page,
	net
}) => {
	const row = fixtureRow(FIXTURE_ID);
	await openListing(page, FIXTURE_ID);

	await expect(page.getByRole('heading', { level: 1, name: street(row) })).toBeVisible();
	await expect(page).toHaveTitle(`${street(row)}: Tran Real Estate Tools`);

	const facts = page.locator('[data-listing-facts]');
	await expect(facts.locator('dt')).toHaveCount(9);
	await expect(facts.locator('dt')).toHaveText([
		'Bedrooms',
		'Bathrooms',
		'Square feet',
		'Property type',
		'Year built',
		'HOA fee',
		'Days on market',
		'Listed on',
		'Last seen listed'
	]);
	await expect(facts).toContainText('$320 a month');

	const history = page.locator('[data-price-history]');
	await expect(
		history.getByRole('heading', { level: 2, name: 'Price and listing history' })
	).toBeVisible();
	const table = history.getByRole('table', { name: 'Listing events from RentCast' });
	const noChanges = history.getByText(/^No rent changes recorded since it was listed on /);
	await expect(table.or(noChanges)).toBeVisible();

	const contact = page.locator('[data-listing-contact]');
	await expect(contact.getByRole('heading', { level: 2, name: 'Listing contact' })).toBeVisible();
	await expect(contact.locator('a[href^="tel:+1"]')).toHaveCount(1);
	await expect(contact.locator('a[href^="tel:+1"]')).toHaveText(/Call \(\d{3}\) \d{3}-\d{4}$/);
	await expect(contact.locator('a[href^="mailto:"]')).toHaveCount(1);
	await expect(
		contact.getByText("Tran doesn't contact anyone for you. These open your phone or email app.")
	).toBeVisible();

	// Sample chips: header and contact card (plus price history); never "Look it up elsewhere".
	await expect(
		page.locator('header[data-provenance="sample"]').getByText('Sample data')
	).toBeVisible();
	await expect(contact.getByText('Sample data')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Look it up elsewhere' })).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Rent and contact' })).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'How this rent compares' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Message the listing contact' })
	).toBeVisible();

	expect(await unbadgedSampleCards(page)).toBe(0);
	expect(rentcastCalls(net)).toBe(0);
	await expectNoViolations(page, 'sample listing detail');
});

test('a missing id says the link points nowhere', async ({ page, net }) => {
	await openListing(page, null);
	await expect(page.getByRole('heading', { level: 1, name: 'Listing not found' })).toBeVisible();
	await expect(
		page.getByText("This link doesn't point to a listing. Search again to find it.")
	).toBeVisible();
	await expect(page).toHaveTitle('Listing not found: Tran Real Estate Tools');
	await expect(page.getByRole('link', { name: 'Back to search' })).toHaveAttribute(
		'href',
		/\/renter\/$/
	);
	await expect(lookUpButton(page)).toHaveCount(0);
	expect(rentcastCalls(net)).toBe(0);
	await expectNoViolations(page, 'missing id');
});

test('keyless: an unknown id is not found and offers no paid lookup', async ({ page, net }) => {
	await openListing(page, UNKNOWN_ID);
	await expect(page.getByRole('heading', { level: 1, name: 'Listing not found' })).toBeVisible();
	await expect(page.getByText("This listing isn't saved in this browser.")).toBeVisible();
	await expect(page.getByRole('button', { name: /Look it up again/ })).toHaveCount(0);
	expect(rentcastCalls(net)).toBe(0);
});

test('live: Look it up again spends exactly one call; a 404 ends at No results', async ({
	page,
	net
}) => {
	await withRentCastKey(page);
	await mockRentCast(page, net);
	await openListing(page, UNKNOWN_ID);

	await expect(page.getByRole('heading', { level: 1, name: 'Listing not found' })).toBeVisible();
	await expect(lookUpButton(page)).toBeVisible();
	expect(rentcastCalls(net)).toBe(0);
	await expectNoViolations(page, 'live not found');

	await lookUpButton(page).click();
	await expect(page.getByText('No results for this search', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Look it up again/ })).toHaveCount(0);
	expect(rentcastCalls(net)).toBe(1);
	expect(rentcastCalls(net, UNKNOWN_PATH)).toBe(1);
});

test('live: a known id outside the cache loads with one call and links elsewhere', async ({
	page,
	net
}) => {
	const row = fixtureRow(FIXTURE_ID);
	await withRentCastKey(page);
	await mockRentCast(page, net);
	await openListing(page, FIXTURE_ID);

	await expect(lookUpButton(page)).toBeVisible();
	expect(rentcastCalls(net)).toBe(0);
	await lookUpButton(page).click();

	const h1 = page.getByRole('heading', { level: 1, name: street(row) });
	await expect(h1).toBeVisible();
	await expect(h1).toBeFocused();
	expect(rentcastCalls(net)).toBe(1);
	expect(rentcastCalls(net, BY_ID(FIXTURE_ID))).toBe(1);
	await expect(page.locator('header[data-provenance="rentcast"]')).toContainText(
		'RentCast · as of'
	);
	await expect(page.getByRole('button', { name: 'Refresh (1 call)' })).toBeVisible();

	const elsewhere = page.locator('[data-search-elsewhere]');
	await expect(
		elsewhere.getByRole('heading', { level: 2, name: 'Look it up elsewhere' })
	).toBeVisible();
	const links = elsewhere.getByRole('link');
	await expect(links).toHaveCount(3);
	await expect(links.nth(0)).toHaveAccessibleName('Search Google (opens external site)');
	await expect(links.nth(1)).toHaveAccessibleName('Search Zillow (opens external site)');
	await expect(links.nth(2)).toHaveAccessibleName('Search Apartments.com (opens external site)');
	const hosts = await links.evaluateAll((as) =>
		as.map((a) => new URL((a as HTMLAnchorElement).href).host)
	);
	expect(hosts).toEqual(['www.google.com', 'www.zillow.com', 'www.google.com']);
	await expectNoViolations(page, 'live listing detail');

	// Reloading resolves from the by-id cache entry: still exactly one call.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: street(row) })).toBeVisible();
	expect(rentcastCalls(net)).toBe(1);
});

test('shortlist toggle saves, survives a reload and removes a plain item without asking', async ({
	page,
	net
}) => {
	await openListing(page, FIXTURE_ID);
	await page.getByRole('button', { name: 'Save to shortlist' }).click();

	const on = page.getByRole('button', { name: 'On your shortlist' });
	await expect(on).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('link', { name: 'See it on your shortlist' })).toHaveAttribute(
		'href',
		new RegExp(`/renter/shortlist/#item-${FIXTURE_ID}$`)
	);

	await page.reload();
	await expect(page.getByRole('button', { name: 'On your shortlist' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByRole('button', { name: 'On your shortlist' }).click();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Save to shortlist' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(page.getByRole('link', { name: 'See it on your shortlist' })).toHaveCount(0);
	expect(rentcastCalls(net)).toBe(0);
});

test('live: unsafe contact values never become links', async ({ page, net }) => {
	const unsafe = fixtureRow(FIXTURE_ID);
	unsafe.listingAgent = {
		...(unsafe.listingAgent as Row),
		website: 'javascript:alert(1)',
		phone: 'javascript:5805550132'
	};
	unsafe.listingOffice = {
		...(unsafe.listingOffice as Row),
		website: 'javascript:alert(2)',
		phone: 'javascript:5805550133'
	};
	await withRentCastKey(page);
	await mockRentCast(page, net);
	// Registered after mockRentCast, so it wins for this one by-id URL.
	await page.route(
		(url) => url.host === 'api.rentcast.io' && url.pathname === BY_ID(FIXTURE_ID),
		(route) =>
			route.request().method() === 'OPTIONS'
				? route.fulfill({
						status: 204,
						headers: {
							'access-control-allow-origin': '*',
							'access-control-allow-methods': 'GET',
							'access-control-allow-headers': 'x-api-key, accept'
						}
					})
				: route.fulfill({
						status: 200,
						headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
						body: JSON.stringify(unsafe)
					})
	);
	await openListing(page, FIXTURE_ID);
	await lookUpButton(page).click();
	await expect(page.getByRole('heading', { level: 1, name: street(unsafe) })).toBeVisible();

	await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
	await expect(page.locator('[data-listing-contact] a[href^="tel:"]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Visit website/ })).toHaveCount(0);
	// The email is still valid, so that row stays.
	await expect(page.locator('[data-listing-contact] a[href^="mailto:"]')).toHaveCount(1);
});
