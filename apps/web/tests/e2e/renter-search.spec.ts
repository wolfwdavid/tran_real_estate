import type { Page, TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
	test,
	expect,
	NON_LOCAL,
	RENTER_TEST_OPTIONS,
	rentcastCalls,
	type Net
} from './support/network';
import { mockRentCast, RENTAL_LISTINGS_PATH } from './support/rentcast-mocks';
import { expectLiveMode, expectSampleMode, withRentCastKey } from './support/seed';

// RENT-01/RENT-02 end to end on both bases: the search form validates before spending, a live
// search spends exactly 1 call (location + status=Active + limit=500, nothing else), filters and
// sort are local and free, a reload or a shared URL never spends, a 500-row answer offers one
// explicit narrow call (never offset paging), and the keyless sample search is free.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

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
const results = (page: Page) => page.locator('section[aria-labelledby="results-heading"]');
const listingCalls = (net: Net) => rentcastCalls(net, RENTAL_LISTINGS_PATH);

async function open(page: Page, path = 'renter/') {
	await page.goto(path);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Find a rental' })).toBeVisible();
}

async function openLive(page: Page, net: Net, opts: Parameters<typeof mockRentCast>[2] = {}) {
	await mockRentCast(page, net, opts);
	await withRentCastKey(page);
	await open(page);
	await expectLiveMode(page);
}

async function searchFor(page: Page, location: string) {
	await locationInput(page).fill(location);
	await searchButton(page).click();
}

test('keyless: empty state, then a free sample search with Sample data provenance', async ({
	page,
	net
}) => {
	await open(page);
	await expectSampleMode(page);
	await expect(page.getByRole('heading', { level: 2, name: 'Start with a place' })).toBeVisible();
	await expectNoViolations(page, 'renter/ empty state (sample)');

	await page.getByRole('button', { name: 'Try a sample search' }).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in /);
	await expect(results(page).getByText('Sample data', { exact: true }).first()).toBeVisible();
	await expect(searchButton(page)).toContainText('(0 calls · sample data)');
	await expectNoViolations(page, 'renter/ sample results');
	expect(rentcastCalls(net)).toBe(0);
});

test('validation: a missing or invalid location shows its error and makes no request', async ({
	page,
	net
}) => {
	await openLive(page, net);
	await searchButton(page).click();
	await expect(form(page).getByText('Enter a city and state, or a ZIP code.')).toBeVisible();
	await expect(locationInput(page)).toBeFocused();
	await expect(locationInput(page)).toHaveAttribute('aria-invalid', 'true');

	await searchFor(page, 'Austin');
	await expect(form(page).getByText('Add the state, like Austin, TX.')).toBeVisible();
	await searchFor(page, '7420');
	await expect(form(page).getByText('ZIP codes have 5 digits, like 78701.')).toBeVisible();
	await expect(locationInput(page)).toBeFocused();
	expect(rentcastCalls(net)).toBe(0);
});

test('live budget: 1 call per search, filters and sort spend nothing, reload and shared URLs spend nothing', async ({
	page,
	net,
	browser
}, testInfo: TestInfo) => {
	await openLive(page, net);
	await locationInput(page).fill('74201');
	await expect(searchButton(page)).toHaveText(/Search rentals\s*\(1 call\)/);
	await searchButton(page).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in 74201$/);
	expect(listingCalls(net)).toBe(1);

	// Exactly the wide request: location + Active + limit 500 (plus RentCast's suppressLogging).
	const sent = Object.fromEntries(new URL(net.requests[0].url).searchParams);
	delete sent.suppressLogging;
	expect(sent).toEqual({ zipCode: '74201', status: 'Active', limit: '500' });
	expect(net.requests[0].url).toContain('zipCode=74201');
	expect(net.requests[0].url).toContain('status=Active');
	expect(net.requests[0].url).toContain('limit=500');
	await expectNoViolations(page, 'renter/ results header (live)');

	// Five local changes.
	await maxInput(page).fill('2000');
	await page.getByRole('radio', { name: '2', exact: true }).check();
	await page.getByRole('checkbox', { name: 'Condo' }).check();
	await page.getByRole('radio', { name: '14 days' }).check();
	await page
		.getByRole('combobox', { name: 'Sort by' })
		.selectOption({ label: 'Rent: low to high' });
	await expect(heading(page)).toHaveText(/^\d+ of \d+ rentals in 74201$/);
	await expect(searchButton(page)).toContainText('(0 calls · cached)');
	await expect(page.getByRole('button', { name: 'Remove filter: Condo' })).toBeVisible();
	await expect(page).toHaveURL(/[?&]max=2000/);
	await expect(page).toHaveURL(/[?&]sort=rent-asc/);
	expect(listingCalls(net)).toBe(1);

	// Reload: restored from the cache, 0 new calls, same heading.
	const before = (await heading(page).textContent())?.trim();
	const sharedUrl = page.url();
	await page.reload();
	await expect(heading(page)).toHaveText(before ?? '');
	await expect(maxInput(page)).toHaveValue('2000');
	await expect(searchButton(page)).toContainText('(0 calls · cached)');
	expect(listingCalls(net)).toBe(1);

	// A fresh browser (empty IndexedDB) on the shared URL: prefilled, waiting, 0 calls.
	const context = await browser.newContext({
		...RENTER_TEST_OPTIONS,
		baseURL: testInfo.project.use.baseURL,
		reducedMotion: 'reduce'
	});
	try {
		const other = await context.newPage();
		const otherNet: Net = { counts: {}, requests: [], external: [], tileReferers: [] };
		// deny-all FIRST, then the RentCast mock (later routes win).
		await other.route(NON_LOCAL, (r) => {
			otherNet.external.push(r.request().url());
			return r.abort();
		});
		await mockRentCast(other, otherNet);
		await withRentCastKey(other);
		await other.goto(sharedUrl);
		await expect(other.locator('html')).not.toHaveAttribute('hidden');
		await expectLiveMode(other);
		await expect(locationInput(other)).toHaveValue('74201');
		await expect(maxInput(other)).toHaveValue('2000');
		await expect(searchButton(other)).toHaveText(/Search rentals\s*\(1 call\)/);
		await expect(other.getByRole('heading', { name: 'Start with a place' })).toBeVisible();
		expect(rentcastCalls(otherNet)).toBe(0);
		expect(otherNet.external).toEqual([]);
	} finally {
		await context.close();
	}
});

test('truncation: 500 rows warn, and Narrow on RentCast spends exactly 1 more call, never offset', async ({
	page,
	net
}) => {
	await openLive(page, net, { rows: 'many500' });
	await searchFor(page, '74201');
	await expect(heading(page)).toHaveText('500 rentals in 74201');
	await expect(page.getByText('Some listings may be missing')).toBeVisible();
	await expect(page.getByRole('button', { name: /^Narrow on RentCast/ })).toHaveCount(0);

	await maxInput(page).fill('2000');
	const narrow = page.getByRole('button', { name: 'Narrow on RentCast (1 call)' });
	await expect(narrow).toBeVisible();
	await expectNoViolations(page, 'renter/ truncation notice');
	expect(listingCalls(net)).toBe(1);

	await narrow.click();
	await expect.poll(() => listingCalls(net)).toBe(2);
	expect(net.requests[1].url).toMatch(/price=0(%3A|:)2000/);
	for (const r of net.requests) expect(r.url).not.toContain('offset');
	await expect(heading(page)).toBeVisible();
	expect(listingCalls(net)).toBe(2);
});

test('NoResults: a ZIP with no listings shows the Phase 4 panel', async ({ page, net }) => {
	await openLive(page, net);
	await searchFor(page, '74299');
	await expect(page.getByText('No results for this search', { exact: true })).toBeVisible();
	expect(listingCalls(net)).toBe(1);
	await page.getByRole('button', { name: 'Edit search' }).click();
	await expect(locationInput(page)).toBeFocused();
});

test('375px: the filters panel opens in flow, passes axe and never scrolls sideways', async ({
	page,
	net
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await open(page);
	await expectSampleMode(page);
	const toggle = form(page).getByRole('button', { name: /^Filters/ });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('group', { name: 'Bedrooms' })).toBeVisible();
	await page.getByRole('radio', { name: '2', exact: true }).check();
	await expect(toggle).toHaveText(/Filters · 1/);
	await expectNoViolations(page, 'renter/ filters open at 375px');
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(375);

	// Escape closes the panel and returns focus to the toggle.
	await page.getByRole('radio', { name: '2', exact: true }).focus();
	await page.keyboard.press('Escape');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(toggle).toBeFocused();

	// Removing the last chip moves focus to the Filters toggle.
	await page.getByRole('button', { name: 'Remove filter: 2 bedrooms' }).click();
	await expect(toggle).toBeFocused();
	await expect(toggle).toHaveText(/^\s*Filters\s*$/);
	expect(rentcastCalls(net)).toBe(0);
});
