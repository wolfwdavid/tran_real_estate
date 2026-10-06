import type { Page } from '@playwright/test';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls } from './support/network';
import {
	MARKETS_PATH,
	mockRentCast,
	RENT_ESTIMATE_PATH,
	RENTAL_LISTINGS_PATH
} from './support/rentcast-mocks';
import { expectLiveMode, withRentCastKey } from './support/seed';
import { AI_HOSTS, countRequests } from './helpers/ai-mocks';

// The renter call budget end to end (06-22, ROADMAP criterion 5), on both bases: one renter with a
// (mocked) RentCast key and no AI key walks the whole portal. The only spends are the three the UI
// labels with "(1 call)":
//   search 74201                      1  /v1/listings/rental/long-term
//   Load 74201 rent data              1  /v1/markets
//   Get rent estimate                 1  /v1/avm/rent/long-term
// Everything else (filters, sort, map, pin selection, detail from the search cache, the outreach
// draft on the Fixture provider, Copy text, shortlist status and notes, saving the search, the
// affordability check and its CTA) spends 0. No LLM host and no third-party host is ever reached.

test.use(RENTER_TEST_OPTIONS);
test.describe.configure({ timeout: 180_000 });

const form = (page: Page) => page.getByRole('search', { name: 'Search rentals' });
const searchButton = (page: Page) => form(page).getByRole('button', { name: /^Search rentals/ });
const heading = (page: Page) => page.locator('#results-heading');
const statusBar = (page: Page) => page.getByRole('region', { name: 'Data source' });
const announcer = (page: Page) => page.getByTestId('live-announcer');
const pins = (page: Page) => page.locator('.leaflet-marker-icon.tran-pin-icon');
const clusters = (page: Page) => page.locator('.leaflet-marker-icon.tran-cluster');
const markers = (page: Page) => page.locator('.leaflet-marker-icon[role="button"]');
const tier1 = (page: Page) => page.locator('[data-fair-rent-tier="zip-median"]');
const tier2 = (page: Page) => page.locator('[data-fair-rent-tier="rent-estimate"]');
const outreach = (page: Page) => page.locator('[data-outreach]');
const panel = (page: Page) => outreach(page).getByRole('region', { name: 'Your message' });

async function waitForPage(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1').first()).toBeVisible();
}

test('a full renter journey spends exactly 3 RentCast calls and nothing else', async ({
	page,
	net
}) => {
	const llm = Object.values(AI_HOSTS).map((host) => countRequests(page, new URL(host).host));
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await mockRentCast(page, net);
	await withRentCastKey(page);

	// 1) Search: the one listings call.
	await page.goto('renter/');
	await waitForPage(page);
	await expectLiveMode(page);
	await page.getByRole('textbox', { name: 'City and state, or ZIP code' }).fill('74201');
	await expect(searchButton(page)).toHaveText(/Search rentals\s*\(1 call\)/);
	await searchButton(page).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in 74201$/);
	expect(rentcastCalls(net)).toBe(1);

	// 2) Filters and sort: local, free. Max $2,000 + 3 bedrooms + Townhouse + 30 days leaves R017.
	await page.getByRole('textbox', { name: 'Max', exact: true }).fill('2000');
	await page.getByRole('radio', { name: '3', exact: true }).check();
	await page.getByRole('checkbox', { name: 'Townhouse' }).check();
	await page.getByRole('radio', { name: '30 days' }).check();
	await page
		.getByRole('combobox', { name: 'Sort by' })
		.selectOption({ label: 'Rent: low to high' });
	await expect(heading(page)).toHaveText(/^[1-9]\d* of \d+ rentals in 74201$/);
	await expect(searchButton(page)).toContainText('(0 calls · cached)');
	const searchUrl = page.url();
	expect(rentcastCalls(net)).toBe(1);

	// 3) Map tab (tiles mocked) and a pin selected with the keyboard.
	await page.getByRole('tab', { name: 'Map' }).click();
	await expect(page.locator('.leaflet-container')).toBeVisible();
	await expect(markers(page).first()).toBeVisible();
	for (let i = 0; i < 6 && (await pins(page).count()) === 0; i++) {
		await clusters(page).first().focus();
		await page.keyboard.press('Enter');
		await page.waitForTimeout(400);
	}
	const pin = pins(page).first();
	await expect(pin).toBeVisible();
	await pin.focus();
	await page.keyboard.press('Enter');
	await expect(announcer(page)).toContainText('selected.');
	const card = page.locator('article[data-listing-card][aria-current="true"]:visible');
	await expect(card).toBeVisible();
	await expect.poll(() => net.counts.tiles ?? 0).toBeGreaterThan(0);
	expect(rentcastCalls(net)).toBe(1);

	// 4) Its detail: resolved from the search cache, 0 calls.
	// The list, split list and map preview each render the card, so scope the link to the
	// selected, visible one.
	const linkId = await card.getAttribute('aria-labelledby');
	await card.locator(`[id="${linkId}"]`).click();
	await expect(page).toHaveURL(/renter\/listing\/\?id=/);
	await waitForPage(page);
	await expect(page.getByText('Loading listing…')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Listing not found');
	await expect(page.getByRole('button', { name: 'Look it up again (1 call)' })).toHaveCount(0);
	expect(rentcastCalls(net)).toBe(1);

	// 5) Load 74201 rent data: the one markets call.
	await tier1(page).getByRole('button', { name: 'Load 74201 rent data (1 call)' }).click();
	await expect(tier1(page).locator('[data-fair-rent-sentence]').first()).toBeVisible();
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(1);

	// 6) Get rent estimate: the one AVM call.
	await tier2(page).getByRole('button', { name: 'Get rent estimate (1 call)' }).click();
	await expect(tier2(page).getByText(/^Estimate: \$[\d,]+ a month$/)).toBeVisible();
	expect(rentcastCalls(net, RENT_ESTIMATE_PATH)).toBe(1);
	expect(rentcastCalls(net)).toBe(3);

	// 7) Outreach on the Fixture provider (no AI key): draft, then Copy text. 0 calls.
	await outreach(page).getByLabel('How many people will live there').fill('2');
	await panel(page).getByRole('button', { name: 'Draft message', exact: true }).click();
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 20_000
	});
	await expect(panel(page).getByText('Sample output', { exact: true }).first()).toBeVisible();
	await panel(page)
		.getByTestId('generation-exits')
		.getByRole('button', { name: 'Copy text' })
		.click();
	await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();

	// 8) Save to shortlist, then on the shortlist: status Contacted and a note. 0 calls.
	await page.getByRole('button', { name: 'Save to shortlist' }).click();
	await expect(page.getByRole('button', { name: 'On your shortlist' })).toBeVisible();
	await page.goto('renter/shortlist/');
	await waitForPage(page);
	const shortCard = page.locator('article[data-shortlist-card]');
	await expect(shortCard).toHaveCount(1);
	await shortCard.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Contacted' });
	const contacted = page.locator('section[data-shortlist-section="contacted"] article');
	await expect(contacted).toHaveCount(1);
	await contacted.getByRole('button', { name: 'Add notes' }).click();
	await contacted.getByRole('textbox', { name: /^Notes for / }).fill('Asked about parking.');
	await contacted.getByRole('button', { name: 'Save notes' }).click();
	await expect(contacted).toContainText('Asked about parking.');

	// 9) Back to the filtered search (restored from the cache) and save it. 0 calls.
	await page.goto(searchUrl);
	await waitForPage(page);
	await expect(heading(page)).toHaveText(/^[1-9]\d* of \d+ rentals in 74201$/);
	await expect(searchButton(page)).toContainText('(0 calls · cached)');
	await page.getByRole('button', { name: 'Save this search', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Save this search' });
	await dialog.getByRole('button', { name: 'Save search' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('button', { name: 'Saved search' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// 10) Affordability and its CTA. 0 calls.
	await page.goto('renter/affordability/');
	await waitForPage(page);
	await page.getByRole('textbox', { name: 'Income before taxes' }).fill('72,000');
	await page.getByRole('link', { name: /^Search rentals up to \$/ }).click();
	await expect(page).toHaveURL(/renter\/\?.*max=/);
	await waitForPage(page);

	// The budget: exactly 3, one of each, and the meter agrees.
	expect(rentcastCalls(net)).toBe(3);
	expect(rentcastCalls(net, RENTAL_LISTINGS_PATH)).toBe(1);
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(1);
	expect(rentcastCalls(net, RENT_ESTIMATE_PATH)).toBe(1);
	expect(net.requests.filter((r) => r.url.includes('/v1/avm/rent/long-term'))).toHaveLength(1);
	expect(net.requests.filter((r) => r.url.includes('/v1/markets'))).toHaveLength(1);
	expect(net.requests.filter((r) => r.url.includes('listings/rental/long-term'))).toHaveLength(1);
	await expect(statusBar(page)).toContainText(/RentCast calls:\s*3 of 50 this month/);
	for (const counter of llm) expect(counter.count).toBe(0);
	// net.external (zero third-party requests) is asserted by the fixture at teardown.
});
