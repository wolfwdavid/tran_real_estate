// Investor portal demo and budget E2E (07-21, ROADMAP Phase 7 SC5). Runs on root and sub through
// the no-network harness (anything not mocked fails the test). Two composed journeys:
// - keyless: analyze -> autofill -> save -> compare -> buy box -> Deep analyze -> markets ->
//   dashboard -> memo -> print, all on sample data, with zero requests to RentCast or any AI host
//   and the "Sample data" source on every investor page visited;
// - mocked key: the same journey spends exactly 6 RentCast calls (2 autofill, 1 watched ZIP,
//   1 buy-box check, 2 Deep analyze; quick metrics reuse the watched ZIP's stats for 0), and
//   reloading every visited page spends nothing more.
import type { Locator, Page } from '@playwright/test';
import {
	AI_HOSTS,
	INVESTOR_TEST_OPTIONS,
	MOCK_CITY,
	MOCK_ZIP,
	VALUE_ESTIMATE_PATH,
	blockRentCast,
	collectRequests,
	expect,
	mockAnthropicText,
	mockRentCast,
	mockSubjectAddress,
	rentEstimateBody,
	test,
	useMockedAnthropicKey,
	useMockedRentCastKey,
	valueEstimateBody
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const RENT = '/v1/avm/rent/long-term';
const SALE = '/v1/listings/sale';
const MARKETS = '/v1/markets';
/** A memo with no figures of its own: the number check has nothing to flag. */
const CLEAN_MEMO =
	'This memo describes the rental property analysis saved in Tran Real Estate Tools. The table lists the figures from that analysis.';

// ------------------------------------------------------------------ shared steps

async function openAnalyzer(page: Page, query = ''): Promise<void> {
	await page.goto(`investor/analyze/${query}`);
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
}

async function type(page: Page, selector: string, value: string): Promise<void> {
	const field = page.locator(selector);
	await field.fill(value);
	await field.press('Tab');
}

const dealId = (page: Page) => new URL(page.url()).searchParams.get('id');

async function saveDeal(page: Page): Promise<string> {
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	return dealId(page)!;
}

async function saveAsNew(page: Page, name: string): Promise<string> {
	const before = dealId(page);
	await type(page, '#deal-name', name);
	await page.getByRole('button', { name: 'Save as a new deal' }).click();
	await expect.poll(() => dealId(page)).not.toBe(before);
	return dealId(page)!;
}

async function openDeals(page: Page): Promise<void> {
	await page.goto('investor/deals/');
	await expect(page.getByRole('heading', { level: 1, name: 'Saved deals' })).toBeVisible();
}

async function openBuyBoxes(page: Page): Promise<void> {
	await page.goto('investor/buy-boxes/');
	await expect(page.getByText('Loading your investor data…')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1, name: 'Buy boxes' })).toBeVisible();
}

const boxForm = (page: Page) => page.locator('[data-buy-box-form]');
const boxCard = (page: Page, name: string) =>
	page.locator('article[data-buy-box]', {
		has: page.getByRole('heading', { level: 2, name, exact: true })
	});

/** New buy box with a Name and Location, then "Save and check now" with the expected cost. */
async function newBuyBox(page: Page, name: string, location: string, cost: string) {
	await page.getByRole('button', { name: 'New buy box' }).click();
	await expect(boxForm(page).getByLabel('Name', { exact: true })).toBeFocused();
	await boxForm(page).getByLabel('Name', { exact: true }).fill(name);
	const loc = boxForm(page).getByLabel('Location', { exact: true });
	await loc.fill(location);
	await loc.press('Tab');
	const save = boxForm(page).getByRole('button', { name: /^Save and check now/ });
	await expect(save).toHaveAccessibleName(`Save and check now ${cost}`);
	await save.click();
	await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeFocused();
	return boxCard(page, name);
}

async function openMatches(c: Locator): Promise<Locator> {
	const details = c.locator('details[data-matches]');
	await expect(details).toBeVisible();
	await expect(async () => {
		if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
			await details.locator('summary').first().click();
		}
		await expect(details).toHaveAttribute('open', '', { timeout: 1000 });
	}).toPass();
	const first = c.locator('[data-match-row]').first();
	await expect(first).toBeVisible();
	return first;
}

const zipHeading = (page: Page) =>
	page.getByRole('heading', { level: 2, name: `ZIP ${MOCK_ZIP}`, exact: true });

async function watchZip(page: Page, cost: string): Promise<void> {
	await page.goto('investor/markets/');
	await expect(page.getByText(/of 5 ZIP codes watched$/)).toBeVisible();
	await page.getByLabel('ZIP code').fill(MOCK_ZIP);
	const watch = page.getByRole('button', { name: /^Watch ZIP/ });
	await expect(watch).toHaveAccessibleName(`Watch ZIP ${cost}`);
	await watch.click();
	await expect(zipHeading(page)).toBeFocused();
}

async function openDashboard(page: Page): Promise<void> {
	await page
		.locator('article', { has: zipHeading(page) })
		.getByRole('link', { name: 'Open dashboard' })
		.click();
	await expect(page.locator('h1')).toHaveText(`ZIP ${MOCK_ZIP} market`);
	await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
}

/** Deals -> the deal's Memo link -> Draft memo -> checks pass -> print view ready. */
async function memoToPrint(page: Page, dealName: string): Promise<string> {
	await openDeals(page);
	await page.getByRole('link', { name: `Memo for ${dealName}`, exact: true }).click();
	await expect(page).toHaveURL(/\/investor\/memo\/\?id=/);
	await expect(page.locator('[data-memo-page]')).toBeVisible();
	const memoUrl = page.url();
	const panel = page.getByRole('region', { name: 'Memo draft' });
	await panel.getByRole('button', { name: 'Draft memo', exact: true }).click();
	// The keyless sample memo streams word by word (20-60ms each).
	await expect(panel.getByText('Draft ready.', { exact: true })).toBeVisible({ timeout: 60_000 });
	await expect(panel.getByText('Number check passed')).toBeVisible();
	await expect(panel.getByText('Advice language check passed')).toBeVisible();
	const print = page.locator('[data-memo-print-link]');
	await expect(print).toHaveAttribute('href', /\/print\/memo\/\?id=.+&memo=.+/);
	await print.click();
	await expect(page).toHaveURL(/print\/memo\/\?id=.+&memo=.+/);
	await expect(page.locator('[data-ready]')).toBeVisible();
	return memoUrl;
}

/** The data-source bar names sample data on this page. */
async function expectSampleSource(page: Page, where: string): Promise<void> {
	await expect(
		page.getByRole('region', { name: 'Data source' }).getByText('Sample data', { exact: true }),
		`Sample data source on ${where}`
	).toBeVisible();
}

// ------------------------------------------------------------------ keyless

test('keyless full flow uses only sample data', async ({ page }) => {
	test.setTimeout(240_000);
	const external = collectRequests(page, ['api.rentcast.io', ...AI_HOSTS]);
	const blocked = await blockRentCast(page);

	// Analyze: the sample deal, a free sample autofill, save, then a second deal.
	await page.goto('investor/');
	await expectSampleSource(page, 'the investor overview');
	await page.getByRole('link', { name: 'Analyze a deal' }).first().click();
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expectSampleSource(page, 'the analyzer');
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	const rentAutofill = page.getByRole('button', {
		name: 'Autofill rent estimate (0 calls · sample data)'
	});
	await expect(rentAutofill).toBeVisible();
	await rentAutofill.click();
	await expect(page.locator('[data-estimate-result="rent"]')).toBeVisible();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	await saveDeal(page);
	await type(page, '#rent', '2500');
	await saveAsNew(page, 'Higher rent');

	// Deals -> compare both.
	await openDeals(page);
	await expectSampleSource(page, 'saved deals');
	for (const name of ['Sample deal', 'Higher rent']) {
		const box = page.getByRole('checkbox', { name: `Compare ${name}`, exact: true });
		await box.click();
		await expect(box).toBeChecked();
	}
	await page.getByRole('link', { name: 'Compare 2 deals' }).click();
	await expect(page).toHaveURL(/investor\/compare\/\?ids=/);
	await expect(page.locator('table')).toBeVisible();
	await expect(page.locator('table th[scope="col"]')).toHaveCount(2);
	await expectSampleSource(page, 'compare');

	// Buy box in a sample metro: matches with quick metrics at 0 calls, then Deep analyze.
	await openBuyBoxes(page);
	await expectSampleSource(page, 'buy boxes');
	const card = await newBuyBox(page, 'Sample starter homes', MOCK_CITY, '(0 calls · sample data)');
	const row = await openMatches(card);
	await expect(row.locator('[data-quick-metrics] dd').first()).toContainText('%');
	const deep = row.getByRole('button', { name: /^Deep analyze/ });
	await expect(deep).toHaveAccessibleName('Deep analyze (0 calls · sample data)');
	await deep.click();
	await expect(page).toHaveURL(/investor\/analyze\/$/);
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(page.locator('#price-chip')).toHaveText('From listing');

	// Markets: watch a sample ZIP, open its dashboard.
	await watchZip(page, '(0 calls · sample data)');
	await expectSampleSource(page, 'markets');
	await openDashboard(page);
	await expectSampleSource(page, 'the market dashboard');

	// Memo for the sample deal, then the print view.
	await memoToPrint(page, 'Sample deal');

	expect(blocked.count()).toBe(0);
	expect(external).toEqual([]);
});

// ------------------------------------------------------------------ mocked key

test('mocked key flow stays within 6 calls', async ({ page, net }) => {
	test.setTimeout(240_000);
	const rentBody = await rentEstimateBody();
	const valueBody = await valueEstimateBody();
	// Estimates answer any address (the subject and the Deep analyze listing) with fixture bodies.
	const rc = await mockRentCast(page, net, {
		respond: {
			rentEstimate: { status: 200, body: rentBody },
			valueEstimate: { status: 200, body: valueBody }
		}
	});
	const ai = await mockAnthropicText(page, CLEAN_MEMO);
	await useMockedRentCastKey(page);
	await useMockedAnthropicKey(page);
	expect(rc.count()).toBe(0);

	// Analyze: address, then the two autofills (1 call each), then save.
	await openAnalyzer(page);
	await type(page, '#address', await mockSubjectAddress());
	const rentAutofill = page.getByRole('button', { name: /^Autofill rent estimate/ });
	const valueAutofill = page.getByRole('button', { name: /^Autofill value estimate/ });
	await expect(rentAutofill).toHaveAccessibleName('Autofill rent estimate (1 call)');
	await rentAutofill.click();
	await expect(page.locator('#rent')).not.toHaveValue('');
	await expect(valueAutofill).toHaveAccessibleName('Autofill value estimate (1 call)');
	await valueAutofill.click();
	await expect(page.locator('#price')).not.toHaveValue('');
	expect(rc.count(RENT)).toBe(1);
	expect(rc.count(VALUE_ESTIMATE_PATH)).toBe(1);
	await type(page, '#deal-name', 'Autofilled');
	const analyzeUrl = `investor/analyze/?id=${await saveDeal(page)}`;
	expect(rc.count()).toBe(2);

	// Markets: watch the ZIP (1 call), open its dashboard (0 calls).
	await watchZip(page, '(1 call)');
	expect(rc.count(MARKETS)).toBe(1);
	await openDashboard(page);
	const dashboardUrl = page.url();
	expect(rc.count()).toBe(3);

	// Buy box in the watched ZIP: the check is 1 call, quick metrics reuse the watched ZIP's stats.
	await openBuyBoxes(page);
	const card = await newBuyBox(page, 'Harlow ZIP', MOCK_ZIP, '(1 call)');
	await expect(card.getByText(/^Checked /)).toBeVisible();
	expect(rc.count(SALE)).toBe(1);
	const row = await openMatches(card);
	await expect(row.locator('[data-quick-metrics] dd').first()).toContainText('%');
	await expect(card.getByRole('button', { name: /^Load ZIP rents/ })).toHaveCount(0);
	expect(rc.count(MARKETS)).toBe(1);
	expect(rc.count()).toBe(4);

	// Deep analyze: 2 calls in the click, then the analyzer renders from the cache.
	const deep = row.getByRole('button', { name: /^Deep analyze/ });
	await expect(deep).toHaveAccessibleName('Deep analyze (2 calls)');
	await deep.click();
	await expect(page).toHaveURL(/investor\/analyze\/$/);
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(page.locator('#price-chip')).toHaveText('From listing');
	await expect(page.locator('#rent-chip')).toContainText(/RentCast · as of/);

	// Memo for the saved deal (the mocked AI), then the print view.
	const memoUrl = await memoToPrint(page, 'Autofilled');
	expect(ai).toHaveLength(1);
	const printUrl = page.url();

	expect(rc.count(RENT)).toBe(2);
	expect(rc.count(VALUE_ESTIMATE_PATH)).toBe(2);
	expect(rc.count(SALE)).toBe(1);
	expect(rc.count(MARKETS)).toBe(1);
	expect(rc.count()).toBe(6);

	// Page loads spend nothing: reload every visited page once.
	const visited = [
		'investor/',
		analyzeUrl,
		'investor/analyze/',
		'investor/markets/',
		dashboardUrl,
		'investor/buy-boxes/',
		'investor/deals/',
		memoUrl,
		printUrl
	];
	for (const url of visited) {
		await page.goto(url);
		await page.reload();
		await expect(page.locator('h1').first()).toBeVisible();
		await page.waitForLoadState('networkidle');
	}
	await page.waitForTimeout(500);
	expect(rc.count()).toBe(6);
});
