// Buy boxes E2E (07-18, INV-04 / ROADMAP SC3) on the real build, both bases, through the
// no-network harness. Proves with exact RentCast call counts at every step:
// - the cost is in the button name before any click ("Save and check now (1 call)");
// - Save and check now spends exactly 1 listings call; quick metrics never fetch market stats;
//   "Load ZIP rents (1 call)" spends exactly 1 markets call and only on the click;
// - reloading the page spends nothing;
// - a "Save only" box is checked once on app open (Phase 4 scheduler), never again that day;
// - "Deep analyze (2 calls)" spends exactly one rent and one value estimate, then the analyzer opens
//   pre-filled (From listing + RentCast chips) and spends nothing more;
// - matches below the user's targets are grouped, never dropped; validation copy; delete;
// - axe on every state and no sideways scroll at 375px.
//
// Live specs use MOCK_ZIP as the location so every match shares one ZIP (one Load ZIP rents call
// fills them all). Estimates are answered for any address with the fixture subject's bodies.
import type { Locator, Page } from '@playwright/test';
import {
	INVESTOR_TEST_OPTIONS,
	MOCK_CITY,
	MOCK_ZIP,
	VALUE_ESTIMATE_PATH,
	blockRentCast,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	mockRentCast,
	rentEstimateBody,
	test,
	useMockedRentCastKey,
	valueEstimateBody,
	type Net
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const SALE = '/v1/listings/sale';
const RENT = '/v1/avm/rent/long-term';
/** A second fixture metro (its own listings request) for the app-open spec. */
const OTHER_CITY = 'Juniper Mesa, AZ';

async function live(page: Page, net: Net) {
	const rent = await rentEstimateBody();
	const value = await valueEstimateBody();
	const rc = await mockRentCast(page, net, {
		respond: {
			rentEstimate: { status: 200, body: rent },
			valueEstimate: { status: 200, body: value }
		}
	});
	await useMockedRentCastKey(page);
	return rc;
}

async function openBuyBoxes(page: Page): Promise<void> {
	await page.goto('investor/buy-boxes/');
	await expect(page.getByText('Loading your investor data…')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1, name: 'Buy boxes' })).toBeVisible();
}

const newButton = (page: Page) => page.getByRole('button', { name: 'New buy box' });
const form = (page: Page) => page.locator('[data-buy-box-form]');
const saveAndCheck = (page: Page) =>
	form(page).getByRole('button', { name: /^Save and check now/ });
const card = (page: Page, name: string) =>
	page.locator('article[data-buy-box]', {
		has: page.getByRole('heading', { level: 2, name, exact: true })
	});
const cardHeading = (page: Page, name: string) =>
	page.getByRole('heading', { level: 2, name, exact: true });

/** Fills the new-box form (Name + Location, plus any extra labelled fields). */
async function fillForm(
	page: Page,
	name: string,
	location: string,
	extra: Record<string, string> = {}
): Promise<void> {
	await expect(form(page).getByLabel('Name', { exact: true })).toBeFocused();
	await form(page).getByLabel('Name', { exact: true }).fill(name);
	const loc = form(page).getByLabel('Location', { exact: true });
	await loc.fill(location);
	await loc.press('Tab');
	for (const [label, value] of Object.entries(extra)) {
		await form(page).getByLabel(label, { exact: true }).fill(value);
	}
}

/** Opens a card's Matches disclosure when it is closed. */
async function openMatches(c: Locator): Promise<void> {
	const details = c.locator('details[data-matches]');
	await expect(details).toBeVisible();
	// The disclosure may open on its own when New matches arrive, so re-check before each click.
	await expect(async () => {
		if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
			await details.locator('summary').first().click();
		}
		await expect(details).toHaveAttribute('open', '', { timeout: 1000 });
	}).toPass();
}

test('keyless: sample matches with quick metrics at 0 calls, never a RentCast request', async ({
	page
}) => {
	const blocked = await blockRentCast(page);
	await openBuyBoxes(page);
	await expect(page.getByRole('heading', { name: 'No buy boxes yet' })).toBeVisible();
	await expectNoAxeViolations(page, 'buy boxes empty (sample)');

	await newButton(page).click();
	await expect(form(page).getByRole('heading', { name: 'New buy box' })).toBeVisible();
	await fillForm(page, 'Sample starter homes', MOCK_CITY);
	await expect(saveAndCheck(page)).toHaveAccessibleName(
		'Save and check now (0 calls · sample data)'
	);
	await expectNoAxeViolations(page, 'buy box form open (sample)');
	await saveAndCheck(page).click();

	const c = card(page, 'Sample starter homes');
	await expect(cardHeading(page, 'Sample starter homes')).toBeFocused();
	await openMatches(c);
	const rows = c.locator('[data-match-row]');
	await expect(rows.first()).toBeVisible();
	await expect(rows.first().locator('[data-provenance-chip="sample"]')).toHaveText('Sample data');
	// Sample mode reads ZIP stats from the fixtures, so quick metrics are there at once.
	const metrics = rows.first().locator('[data-quick-metrics]');
	await expect(metrics.getByText('Rent-to-price')).toBeVisible();
	await expect(metrics.getByText('GRM')).toBeVisible();
	await expect(metrics.getByText('Est. cap rate')).toBeVisible();
	await expect(metrics.locator('dd').first()).toContainText('%');
	await expect(rows.first().getByRole('button', { name: /^Load ZIP rents/ })).toHaveCount(0);
	await expect(rows.first().getByRole('button', { name: /^Deep analyze/ })).toHaveAccessibleName(
		'Deep analyze (0 calls · sample data)'
	);
	expect(blocked.urls).toEqual([]);
});

test('live: cost first, 1-call check, 0-call quick metrics, explicit ZIP rents, free reload, Deep analyze = 2 calls', async ({
	page,
	net
}) => {
	const rc = await live(page, net);
	await openBuyBoxes(page);
	await newButton(page).click();
	await fillForm(page, 'Harlow ZIP', MOCK_ZIP);

	// The cost is in the name before the click, and reading it is free.
	await expect(saveAndCheck(page)).toHaveAccessibleName('Save and check now (1 call)');
	expect(rc.count(SALE)).toBe(0);
	await saveAndCheck(page).click();

	const c = card(page, 'Harlow ZIP');
	await expect(cardHeading(page, 'Harlow ZIP')).toBeFocused();
	await expect(c.getByText(/^Checked /)).toBeVisible();
	expect(rc.count(SALE)).toBe(1);
	await openMatches(c);
	const rows = c.locator('[data-match-row]');
	await expect(rows.first()).toBeVisible();
	// Quick metrics never fetch: the ZIP's stats are not cached, so they wait for the click.
	expect(rc.count('/v1/markets')).toBe(0);
	await expect(rows.first().getByText('Load ZIP rents to see quick metrics.')).toBeVisible();
	const load = rows.first().getByRole('button', { name: /^Load ZIP rents/ });
	await expect(load).toHaveAccessibleName('Load ZIP rents (1 call)');
	expect(rc.count('/v1/markets')).toBe(0);
	await load.click();
	await expect(page.getByText('Load ZIP rents to see quick metrics.')).toHaveCount(0);
	expect(rc.count('/v1/markets')).toBe(1);
	const metrics = rows.first().locator('[data-quick-metrics]');
	await expect(metrics.locator('dd').first()).toContainText('%');
	await expect(metrics.locator('[data-quick-basis]')).toContainText(
		/^Quick metrics use the ZIP's median rent/
	);
	await expect(c.getByRole('button', { name: /^Check now/ })).toHaveAccessibleName(
		'Check now (0 calls · cached)'
	);

	// Reloading the page spends nothing.
	const sale = rc.count(SALE);
	const markets = rc.count('/v1/markets');
	await page.reload();
	await expect(cardHeading(page, 'Harlow ZIP')).toBeVisible();
	await openMatches(card(page, 'Harlow ZIP'));
	await expect(card(page, 'Harlow ZIP').locator('[data-quick-metrics] dd').first()).toContainText(
		'%'
	);
	expect(rc.count(SALE)).toBe(sale);
	expect(rc.count('/v1/markets')).toBe(markets);
	await expectNoAxeViolations(page, 'buy boxes with matches (live)');
	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
	await page.setViewportSize({ width: 1280, height: 900 });

	// Deep analyze: exactly 2 calls in the click, then the analyzer renders from the cache.
	const row = card(page, 'Harlow ZIP').locator('[data-match-row]').first();
	const priceText = (await row.locator('p').nth(1).innerText()).split(' · ')[0];
	const deep = row.getByRole('button', { name: /^Deep analyze/ });
	await expect(deep).toHaveAccessibleName('Deep analyze (2 calls)');
	expect(rc.count(RENT)).toBe(0);
	expect(rc.count(VALUE_ESTIMATE_PATH)).toBe(0);
	await deep.click();
	await expect(page).toHaveURL(/investor\/analyze\/$/);
	expect(rc.count(RENT)).toBe(1);
	expect(rc.count(VALUE_ESTIMATE_PATH)).toBe(1);
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(page.locator('#price')).toHaveValue(priceText.replace('$', ''));
	await expect(page.locator('#price-chip')).toHaveText('From listing');
	await expect(page.locator('#rent')).not.toHaveValue('');
	await expect(page.locator('#rent-chip')).toContainText(/RentCast · as of/);
	await expect(page.locator('[data-estimate-result="rent"]')).toBeVisible();
	await expect(page.locator('[data-estimate-result="value"]')).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Autofill rent estimate (0 calls · cached)' })
	).toBeVisible();
	const total = rc.count();
	await page.waitForTimeout(1000);
	expect(rc.count()).toBe(total);
});

test('Deep analyze with a failed value estimate still opens the analyzer with the rent', async ({
	page,
	net
}) => {
	const rent = await rentEstimateBody();
	await mockRentCast(page, net, {
		respond: {
			rentEstimate: { status: 200, body: rent },
			valueEstimate: { status: 500, body: {} }
		}
	});
	await useMockedRentCastKey(page);
	await openBuyBoxes(page);
	await newButton(page).click();
	await fillForm(page, 'Partial', MOCK_ZIP);
	await saveAndCheck(page).click();
	const c = card(page, 'Partial');
	await expect(cardHeading(page, 'Partial')).toBeFocused();
	await openMatches(c);
	await c
		.locator('[data-match-row]')
		.first()
		.getByRole('button', { name: /^Deep analyze/ })
		.click();
	await expect(page).toHaveURL(/investor\/analyze\/$/);
	await expect(page.locator('#rent-chip')).toContainText(/RentCast · as of/);
	await expect(page.locator('#price-chip')).toHaveText('From listing');
	// The failed value estimate shows its GatewayError in the Purchase fieldset, no result block.
	const purchase = page.locator('fieldset', {
		has: page.locator('legend', { hasText: /^Purchase$/ })
	});
	await expect(purchase.locator('[data-autofill="value"] section')).toBeVisible();
	await expect(page.locator('[data-estimate-result="value"]')).toHaveCount(0);
	await expect(page.locator('[data-estimate-result="rent"]')).toBeVisible();
	await expectNoAxeViolations(page, 'analyzer after a partial Deep analyze');
});

test('app open checks a due buy box once; New badges; no second check', async ({ page, net }) => {
	const rc = await live(page, net);
	await openBuyBoxes(page);
	await newButton(page).click();
	await fillForm(page, 'Juniper', OTHER_CITY);
	await form(page).getByRole('button', { name: 'Save only' }).click();
	await expect(cardHeading(page, 'Juniper')).toBeFocused();
	await expect(
		card(page, 'Juniper').getByText(
			'Not checked yet. Use Check now, or Tran will check it next time you open the app.'
		)
	).toBeVisible();
	expect(rc.count(SALE)).toBe(0);

	// App open: the Phase 4 scheduler checks the due box once.
	await page.goto('investor/');
	await expect.poll(() => rc.count(SALE)).toBe(1);
	// The mock counts the request when it is sent; the check finishes only once the result is
	// stored, which the overview shows. Leaving before that aborts the in-flight check (07-21).
	await expect(page.locator('[data-overview-card="buyBoxes"] [data-overview-count]')).toHaveText(
		/new match(es)? since your last visit/
	);

	await openBuyBoxes(page);
	const c = card(page, 'Juniper');
	await expect(c.getByText(/^Checked /)).toBeVisible();
	await expect(c.locator('details[data-matches]')).toHaveAttribute('open', '');
	await expect(c.locator('[data-new-match]').first()).toBeVisible();
	await expect(c.locator('[data-new-since]')).toContainText('new since your last visit');
	expect(rc.count(SALE)).toBe(1);

	// Opening the app again the same day spends nothing.
	await page.goto('investor/');
	await openBuyBoxes(page);
	await expect(card(page, 'Juniper').getByText(/^Checked /)).toBeVisible();
	await page.waitForTimeout(500);
	expect(rc.count(SALE)).toBe(1);
});

test('targets group matches below them; nothing is dropped', async ({ page, net }) => {
	const rc = await live(page, net);
	await openBuyBoxes(page);
	await newButton(page).click();
	await fillForm(page, 'Targets', MOCK_ZIP);
	await saveAndCheck(page).click();
	const c = card(page, 'Targets');
	await expect(cardHeading(page, 'Targets')).toBeFocused();
	await openMatches(c);
	const total = await c.locator('[data-match-row]').count();
	expect(total).toBeGreaterThan(0);
	await expect(c.locator('summary').first()).toHaveText(`Matches (${total})`);
	await c
		.locator('[data-match-row]')
		.first()
		.getByRole('button', { name: /^Load ZIP rents/ })
		.click();
	await expect(page.getByText('Load ZIP rents to see quick metrics.')).toHaveCount(0);

	await c.getByRole('button', { name: 'Edit' }).click();
	await expect(form(page).getByRole('heading', { name: 'Edit Targets' })).toBeVisible();
	await form(page).getByLabel('Minimum estimated cap rate').fill('50');
	await form(page).getByRole('button', { name: 'Save only' }).click();
	await expect(cardHeading(page, 'Targets')).toBeFocused();
	await expect(c.getByText('Cap rate 50%+')).toBeVisible();

	await openMatches(c);
	await expect(c.locator('summary').first()).toHaveText('Matches (0 meet your targets)');
	const below = c.locator('details[data-below-targets]');
	await expect(below.locator('summary')).toHaveText(`Show ${total} below your targets`);
	await expect(below).not.toHaveAttribute('open', '');
	await below.locator('summary').click();
	await expect(below.locator('[data-match-row]')).toHaveCount(total);
	await expectNoAxeViolations(page, 'buy boxes with the below-targets group open');
	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
	expect(rc.count('/v1/markets')).toBe(1);
	expect(rc.count(SALE)).toBe(1);
});

test('validation copy, cancel, and delete with confirmation', async ({ page }) => {
	await blockRentCast(page);
	await openBuyBoxes(page);
	await newButton(page).click();
	await form(page).getByRole('button', { name: 'Save only' }).click();
	await expect(form(page).getByText('Give this buy box a name.')).toBeVisible();
	await expect(form(page).getByText('Enter a city and state, or a ZIP code.')).toBeVisible();
	await expect(form(page).getByLabel('Name', { exact: true })).toBeFocused();

	await form(page).getByLabel('Name', { exact: true }).fill('Delete me');
	await form(page).getByLabel('Location', { exact: true }).fill('Nowhere');
	await form(page).getByLabel('Minimum price').fill('400000');
	await form(page).getByLabel('Maximum price').fill('300000');
	await form(page).getByRole('button', { name: 'Save only' }).click();
	await expect(form(page).getByText('Use a format like Austin, TX or 78701.')).toBeVisible();
	await expect(form(page).getByText('The minimum price is higher than the maximum.')).toBeVisible();
	await expectNoAxeViolations(page, 'buy box form with errors');

	await form(page).getByLabel('Location', { exact: true }).fill(MOCK_CITY);
	await form(page).getByLabel('Minimum price').fill('100000');
	await form(page).getByRole('button', { name: 'Save only' }).click();
	await expect(cardHeading(page, 'Delete me')).toBeFocused();

	await card(page, 'Delete me').getByRole('button', { name: 'Delete' }).click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog.getByRole('heading', { name: 'Delete Delete me?' })).toBeVisible();
	await expect(dialog).toContainText(
		"This removes the buy box and its saved matches from this browser. Tran will stop checking it. It can't be undone."
	);
	await expect(dialog.getByRole('button', { name: 'Keep buy box' })).toBeFocused();
	await expectNoAxeViolations(page, 'delete buy box dialog');
	await dialog.getByRole('button', { name: 'Delete buy box' }).click();
	await expect(cardHeading(page, 'Delete me')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'No buy boxes yet' })).toBeVisible();
});
