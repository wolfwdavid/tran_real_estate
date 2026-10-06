// Analyzer autofill E2E (07-15, INV-02 autofill half). Runs on root and sub through the no-network
// harness. Proves: the cost is in the button name before any click, one click spends exactly one
// call, a cached repeat spends none, no address means no request, the fill rule never overwrites a
// typed number, provenance chips follow edits, few-comparables honesty, and the keyless sample path.
import type { Page } from '@playwright/test';
import {
	INVESTOR_TEST_OPTIONS,
	VALUE_ESTIMATE_PATH,
	blockRentCast,
	collectRequests,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	mockRentCast,
	mockSubjectAddress,
	rentEstimateBody,
	test,
	useMockedRentCastKey,
	valueEstimateBody
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const RENT_PATH = '/v1/avm/rent/long-term';
const whole = (dollars: number) => Math.round(dollars).toLocaleString('en-US');
const money = (dollars: number) => `$${whole(dollars)}`;

async function openAnalyzer(page: Page): Promise<void> {
	await page.goto('investor/analyze/');
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
}

async function type(page: Page, selector: string, value: string): Promise<void> {
	const field = page.locator(selector);
	await field.fill(value);
	await field.press('Tab');
}

async function fillAddress(page: Page): Promise<void> {
	await type(page, '#address', await mockSubjectAddress());
}

const rentButton = (page: Page) => page.getByRole('button', { name: /^Autofill rent estimate/ });
const valueButton = (page: Page) => page.getByRole('button', { name: /^Autofill value estimate/ });
const rentChip = (page: Page) => page.locator('#rent-chip');

async function liveAnalyzer(page: Page): Promise<void> {
	await useMockedRentCastKey(page);
	await openAnalyzer(page);
	await fillAddress(page);
}

test('cost is shown before spending; one call, then cached', async ({ page, net }) => {
	const rc = await mockRentCast(page, net);
	const body = await rentEstimateBody();
	await liveAnalyzer(page);

	await expect(page.getByRole('button', { name: 'Autofill rent estimate (1 call)' })).toBeVisible();
	expect(rc.count(RENT_PATH)).toBe(0);

	await rentButton(page).click();
	await expect(page.locator('#rent')).toHaveValue(whole(Number(body.rent)));
	expect(rc.count(RENT_PATH)).toBe(1);
	await expect(rentChip(page)).toContainText(/RentCast · as of/);
	await expect(page.locator('[data-estimate-result="rent"]')).toContainText(
		`RentCast rent estimate: ${money(Number(body.rent))} a month`
	);
	await expect(page.locator('[data-estimate-result="rent"]')).toContainText(
		`Range ${money(Number(body.rentRangeLow))} to ${money(Number(body.rentRangeHigh))}, based on 8 comparables.`
	);
	await expect(rentButton(page)).toHaveAccessibleName('Autofill rent estimate (0 calls · cached)');
	await expect(rentButton(page)).toBeFocused();

	await rentButton(page).click();
	await expect(rentButton(page)).toHaveAccessibleName('Autofill rent estimate (0 calls · cached)');
	expect(rc.count(RENT_PATH)).toBe(1);
});

test("user value is kept; 'Use' writes the estimate", async ({ page, net }) => {
	await mockRentCast(page, net);
	const body = await rentEstimateBody();
	await liveAnalyzer(page);

	await type(page, '#rent', '2100');
	await rentButton(page).click();
	const use = page.getByRole('button', { name: `Use ${money(Number(body.rent))}` });
	await expect(use).toBeVisible();
	await expect(page.locator('#rent')).toHaveValue('2,100');
	await expect(rentChip(page)).toHaveCount(0);

	await use.click();
	await expect(page.locator('#rent')).toHaveValue(whole(Number(body.rent)));
	await expect(page.locator('#rent')).toBeFocused();
	await expect(rentChip(page)).toContainText(/RentCast · as of/);
});

test('editing a filled value marks it Edited by you', async ({ page, net }) => {
	await mockRentCast(page, net);
	await liveAnalyzer(page);

	await rentButton(page).click();
	await expect(rentChip(page)).toContainText(/RentCast · as of/);
	await type(page, '#rent', '1900');
	await expect(rentChip(page)).toHaveText('Edited by you');
	await expect(page.locator('[data-estimate-result="rent"]')).toBeVisible();
});

test('no address, no request', async ({ page, net }) => {
	const rc = await mockRentCast(page, net);
	await useMockedRentCastKey(page);
	await openAnalyzer(page);
	await type(page, '#address', '');

	await rentButton(page).click();
	await expect(page.getByText('Enter the property address to look up an estimate.')).toBeVisible();
	await expect(page.locator('#address')).toBeFocused();
	await expect(page.locator('#address')).toHaveAttribute('aria-invalid', 'true');
	expect(rc.count()).toBe(0);
});

test('few comparables are flagged', async ({ page, net }) => {
	await mockRentCast(page, net, { rentComps: 2 });
	await liveAnalyzer(page);

	await rentButton(page).click();
	const result = page.locator('[data-estimate-result="rent"]');
	await expect(result.getByText('Few comparables', { exact: true })).toBeVisible();
	await expect(result).toContainText('based on 2 comparables.');
	await expect(result).toContainText(
		'This estimate rests on fewer than 3 comparable homes, so treat it as rough.'
	);
	await result.getByText(/^Comparables used \(2\)$/).click();
	await expect(result.locator('table[data-comparables] tbody tr')).toHaveCount(2);
	await expectNoAxeViolations(page, 'autofill few comparables, table open');
	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
});

test('value estimate fills the purchase price and compares a typed price', async ({
	page,
	net
}) => {
	const rc = await mockRentCast(page, net);
	const body = await valueEstimateBody();
	await liveAnalyzer(page);

	await expect(
		page.getByRole('button', { name: 'Autofill value estimate (1 call)' })
	).toBeVisible();
	await valueButton(page).click();
	await expect(page.locator('#price')).toHaveValue(whole(Number(body.price)));
	expect(rc.count(VALUE_ESTIMATE_PATH)).toBe(1);
	await expect(page.locator('#price-chip')).toContainText(/RentCast · as of/);
	const result = page.locator('[data-estimate-result="value"]');
	await expect(result).toContainText(`RentCast value estimate: ${money(Number(body.price))}`);
	await expect(result.locator('[data-price-comparison]')).toHaveText(
		'Your purchase price matches this estimate.'
	);

	// A typed price is kept and compared factually.
	const typed = Math.round(Number(body.price) * 1.04);
	await type(page, '#price', String(typed));
	await expect(result.locator('[data-price-comparison]')).toHaveText(
		/^Your purchase price is \d+\.\d% above this estimate\.$/
	);
	await expect(page.locator('#price-chip')).toHaveText('Edited by you');

	await result.getByText(/^Comparables used \(\d+\)$/).click();
	await expect(result.locator('table[data-comparables]')).toBeVisible();
	await expect(result.locator('table[data-comparables] thead')).toContainText('Price');
	await expectNoAxeViolations(page, 'autofill value estimate, table open');
});

test('keyless sample autofill spends nothing', async ({ page }) => {
	const blocked = await blockRentCast(page);
	const rcRequests = collectRequests(page, ['api.rentcast.io']);
	await openAnalyzer(page);
	await fillAddress(page);

	await expect(
		page.getByRole('button', { name: 'Autofill rent estimate (0 calls · sample data)' })
	).toBeVisible();
	await rentButton(page).click();
	await expect(page.locator('#rent')).not.toHaveValue('');
	await expect(rentChip(page)).toHaveText('Sample data');
	await expect(page.locator('[data-estimate-result="rent"]')).toBeVisible();
	await expectNoAxeViolations(page, 'autofill sample estimate');
	expect(blocked.count()).toBe(0);
	expect(rcRequests).toEqual([]);
});
