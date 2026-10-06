// Investor overview E2E (07-20) on the real build, both bases, through the no-network harness.
// Proves: the three live count lines read the empty state on a fresh browser and follow saved
// deals and watched ZIPs; each card is one tab stop whose whole surface opens its area; the page
// keeps the "Investor portal" h1 and the disclaimer; opening the overview never calls RentCast;
// axe clean and no sideways scroll at 375px.
import type { Locator, Page } from '@playwright/test';
import {
	INVESTOR_TEST_OPTIONS,
	MOCK_ZIP,
	blockRentCast,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	test
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const LOADING = 'Loading your investor data…';
const DISCLAIMER = 'Not investment, legal, or tax advice. Tran is software, not a brokerage.';

const cardOf = (page: Page, key: 'deals' | 'buyBoxes' | 'markets'): Locator =>
	page.locator(`[data-overview-card="${key}"]`);
const countOf = (page: Page, key: 'deals' | 'buyBoxes' | 'markets'): Locator =>
	cardOf(page, key).locator('[data-overview-count]');

async function openOverview(page: Page): Promise<void> {
	await page.goto('investor/');
	await expect(page.getByRole('heading', { level: 1, name: 'Investor portal' })).toBeVisible();
	await expect(page.getByText(LOADING)).toHaveCount(0);
}

async function saveSampleDeal(page: Page): Promise<void> {
	await page.goto('investor/analyze/');
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
}

async function watchSampleZip(page: Page): Promise<void> {
	await page.goto('investor/markets/');
	await expect(page.getByText('0 of 5 ZIP codes watched')).toBeVisible();
	await page.getByLabel('ZIP code').fill(MOCK_ZIP);
	const watch = page.getByRole('button', { name: /^Watch ZIP/ });
	await expect(watch).toHaveAccessibleName('Watch ZIP (0 calls · sample data)');
	await watch.click();
	await expect(
		page.getByRole('heading', { level: 2, name: `ZIP ${MOCK_ZIP}`, exact: true })
	).toBeFocused();
}

test('fresh browser: empty counts, entry points, disclaimer, 0 calls, axe', async ({ page }) => {
	const blocked = await blockRentCast(page);
	await openOverview(page);

	await expect(
		page.getByText(
			'Analyze a property, save the deals you want to revisit, and watch the ZIP codes you care about.'
		)
	).toBeVisible();
	await expect(countOf(page, 'deals')).toHaveText('None saved yet');
	await expect(countOf(page, 'buyBoxes')).toHaveText('No buy boxes yet');
	await expect(countOf(page, 'markets')).toHaveText('0 of 5 ZIP codes watched');
	await expect(page.getByText(DISCLAIMER, { exact: true })).toBeVisible();

	const analyze = page.getByRole('link', { name: 'Analyze a deal' });
	await expect(analyze).toHaveAttribute('href', /\/investor\/analyze\/$/);

	// Three cards in a list, each with its h2 and exactly one focusable element (its link).
	await expect(page.locator('[data-overview-cards] > li')).toHaveCount(3);
	const expected = [
		['deals', 'Saved deals', 'Open saved deals'],
		['buyBoxes', 'Buy boxes', 'Open buy boxes'],
		['markets', 'Markets', 'Open markets']
	] as const;
	for (const [key, title, link] of expected) {
		const card = cardOf(page, key);
		await expect(card.getByRole('heading', { level: 2 })).toHaveText(title);
		await expect(card.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(1);
		await expect(card.getByRole('link')).toHaveAccessibleName(link);
	}

	// Keyboard: the cards are consecutive single tab stops.
	await cardOf(page, 'deals').getByRole('link').focus();
	await page.keyboard.press('Tab');
	await expect(cardOf(page, 'buyBoxes').getByRole('link')).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(cardOf(page, 'markets').getByRole('link')).toBeFocused();
	// The focus ring is drawn on the card.
	await expect(cardOf(page, 'markets')).not.toHaveCSS('outline-style', 'none');

	await expectNoAxeViolations(page, 'investor overview (empty)');
	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
	await expectNoAxeViolations(page, 'investor overview (empty) at 375px');
	expect(blocked.urls).toEqual([]);
});

test('counts follow a saved deal and a watched ZIP; every card opens its area', async ({
	page
}) => {
	const blocked = await blockRentCast(page);
	await saveSampleDeal(page);
	await watchSampleZip(page);

	await openOverview(page);
	await expect(countOf(page, 'deals')).toHaveText('1 saved');
	await expect(countOf(page, 'markets')).toHaveText('1 of 5 ZIP codes watched');
	await expect(countOf(page, 'buyBoxes')).toHaveText('No buy boxes yet');
	await expectNoAxeViolations(page, 'investor overview (with data)');

	// The whole card is the click target (stretched link): clicking its body opens the area.
	const areas = [
		['deals', /\/investor\/deals\/$/, 'Saved deals'],
		['buyBoxes', /\/investor\/buy-boxes\/$/, 'Buy boxes'],
		['markets', /\/investor\/markets\/$/, 'Markets']
	] as const;
	for (const [key, url, h1] of areas) {
		await openOverview(page);
		await cardOf(page, key).click({ position: { x: 24, y: 24 } });
		await expect(page).toHaveURL(url);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
	}

	// Primary action.
	await openOverview(page);
	await page.getByRole('link', { name: 'Analyze a deal' }).click();
	await expect(page).toHaveURL(/\/investor\/analyze\/$/);

	await openOverview(page);
	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
	await expectNoAxeViolations(page, 'investor overview (with data) at 375px');
	expect(blocked.urls).toEqual([]);
});
