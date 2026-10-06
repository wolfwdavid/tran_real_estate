import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls, type Net } from './support/network';
import { mockRentCast, RENTAL_LISTINGS_PATH } from './support/rentcast-mocks';
import { expectLiveMode, expectSampleMode, withRentCastKey } from './support/seed';

// RENT-02 results end to end on both bases: honest, sample-badged cards that link to the detail
// page, a local sort, local "Show 24 more" paging that moves focus, the filtered-empty state with
// a free Clear filters, List | Map tabs kept in the URL (the Map panel is 06-19's stub here: no
// tiles, no Leaflet), and a card shortlist toggle. None of it spends a RentCast call after the
// one search.

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
const cards = (page: Page) => results(page).locator('article[data-listing-card]');
const listTab = (page: Page) => page.getByRole('tab', { name: 'List' });
const mapTab = (page: Page) => page.getByRole('tab', { name: 'Map' });
const listingCalls = (net: Net) => rentcastCalls(net, RENTAL_LISTINGS_PATH);

async function open(page: Page) {
	await page.goto('renter/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Find a rental' })).toBeVisible();
}

/** Keyless: the free sample search (fixture ZIP, 0 calls). */
async function sampleSearch(page: Page) {
	await open(page);
	await expectSampleMode(page);
	await page.getByRole('button', { name: 'Try a sample search' }).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in /);
	await expect(cards(page).first()).toBeVisible();
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

function rentOf(text: string): number {
	const m = /\$([\d,]+) a month/.exec(text);
	if (!m) throw new Error(`no rent in card text: ${text}`);
	return Number(m[1].replace(/,/g, ''));
}

async function addressLink(card: Locator): Promise<Locator> {
	const id = await card.getAttribute('aria-labelledby');
	return card.locator(`[id="${id}"]`);
}

test('cards: rent, Sample data chip, detail link, sort, and never "available"', async ({
	page,
	net
}) => {
	await sampleSearch(page);
	const first = cards(page).first();
	await expect(first).toContainText('a month');
	await expect(first.getByText('Sample data', { exact: true })).toBeVisible();
	await expect(first).toHaveAttribute('data-provenance', 'sample');
	await expect(await addressLink(first)).toHaveAttribute('href', /renter\/listing\/\?id=/);
	expect(await unbadgedSampleCards(page)).toBe(0);
	for (const text of await cards(page).allTextContents()) {
		expect(text.toLowerCase()).not.toContain('available');
	}

	await page
		.getByRole('combobox', { name: 'Sort by' })
		.selectOption({ label: 'Rent: low to high' });
	const texts = await cards(page).allTextContents();
	const rents = texts.slice(0, 3).map(rentOf);
	expect(rents).toEqual([...rents].sort((a, b) => a - b));
	expect(rentcastCalls(net)).toBe(0);
});

test('pagination: Show 24 more pages locally and focuses card 25', async ({ page, net }) => {
	// The sample ZIP has fewer than 25 rows, so page through a 500-row live answer.
	await mockRentCast(page, net, { rows: 'many500' });
	await withRentCastKey(page);
	await open(page);
	await expectLiveMode(page);
	await locationInput(page).fill('74201');
	await searchButton(page).click();
	await expect(heading(page)).toHaveText(/^500 rentals in 74201$/);
	expect(listingCalls(net)).toBe(1);

	await expect(cards(page)).toHaveCount(24);
	await expect(results(page).getByText('Showing 24 of 500', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Show 24 more' }).click();
	await expect(cards(page)).toHaveCount(48);
	await expect(results(page).getByText('Showing 48 of 500', { exact: true })).toBeVisible();
	await expect(page.locator(':focus')).toHaveAttribute('href', /renter\/listing\//);
	const focusedId = await page.locator(':focus').getAttribute('id');
	expect(focusedId).toBe(await cards(page).nth(24).getAttribute('aria-labelledby'));
	expect(listingCalls(net)).toBe(1);
});

test('filtered empty: filters that hide every row offer a free Clear filters', async ({
	page,
	net
}) => {
	await sampleSearch(page);
	const total = await cards(page).count();
	await maxInput(page).fill('1');
	await expect(page.getByRole('heading', { name: 'No rentals match these filters' })).toBeVisible();
	await expect(results(page)).toContainText('Clearing them costs nothing.');
	await expect(cards(page)).toHaveCount(0);
	await expectNoViolations(page, 'renter/ filtered empty');

	await page
		.getByRole('tabpanel', { name: 'List' })
		.getByRole('button', { name: 'Clear filters' })
		.click();
	await expect(cards(page)).toHaveCount(total);
	expect(rentcastCalls(net)).toBe(0);
});

test('tabs: arrow keys move to Map, the URL keeps view=map, Back restores it, no tiles', async ({
	page,
	net
}) => {
	await sampleSearch(page);
	await expect(listTab(page)).toHaveAttribute('aria-selected', 'true');
	await expectNoViolations(page, 'renter/ results list');
	const detailHref = await (await addressLink(cards(page).first())).getAttribute('href');

	await listTab(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(mapTab(page)).toHaveAttribute('aria-selected', 'true');
	await expect(mapTab(page)).toBeFocused();
	await expect(page).toHaveURL(/[?&]view=map(&|$)/);
	await expect(page.getByText('Loading map…')).toBeVisible();
	await expectNoViolations(page, 'renter/ map tab');

	// Leave and come Back: the URL restores the Map tab (0 calls, cache only).
	await page.goto(detailHref!);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/[?&]view=map(&|$)/);
	await expect(mapTab(page)).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByText('Loading map…')).toBeVisible();

	await listTab(page).click();
	await expect(page).not.toHaveURL(/view=map/);
	await expect(cards(page).first()).toBeVisible();

	expect(net.counts.tiles).toBeUndefined();
	await expect(page.locator('.leaflet-container')).toHaveCount(0);
	expect(rentcastCalls(net)).toBe(0);
});

test('shortlist from a card: Save → Saved with aria-pressed, 0 calls', async ({ page, net }) => {
	await sampleSearch(page);
	const first = cards(page).first();
	await first.getByRole('button', { name: /^Save .+ to shortlist$/ }).click();
	const saved = first.getByRole('button', { name: /^Saved to shortlist: / });
	await expect(saved).toHaveAttribute('aria-pressed', 'true');
	await expect(saved).toHaveText('Saved');
	expect(rentcastCalls(net)).toBe(0);
});

test('375px: the results list passes axe and never scrolls sideways', async ({ page, net }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await sampleSearch(page);
	await expectNoViolations(page, 'renter/ results at 375px');
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(375);

	// WCAG 1.4.12 text spacing: the cards, count line and tabs still fit 375px. A constructed
	// sheet (CSP refuses an injected <style>), as layout.spec does.
	await page.evaluate(() => {
		const s = new CSSStyleSheet();
		s.replaceSync(
			'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'
		);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
	});
	await expect(heading(page)).not.toHaveCSS('word-spacing', '0px');
	const spaced = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(spaced).toBeLessThanOrEqual(375);

	await mapTab(page).click();
	await expect(page.getByText('Loading map…')).toBeVisible();
	await expectNoViolations(page, 'renter/ map tab at 375px');
	expect(rentcastCalls(net)).toBe(0);
});
