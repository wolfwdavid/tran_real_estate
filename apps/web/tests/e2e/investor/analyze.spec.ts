// Deal analyzer E2E (07-12, INV-01 / manual half of INV-02 / save half of INV-03). Runs on the root
// and sub projects through the 06-09 no-network harness: anything not mocked fails the test.
// The headline proof: typing every number by hand, seeing results, saving and reloading spends
// zero RentCast requests even with a RentCast key saved.
import type { Page } from '@playwright/test';
import {
	INVESTOR_TEST_OPTIONS,
	collectRequests,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	mockRentCast,
	test,
	useMockedRentCastKey
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

async function openAnalyzer(page: Page, query = ''): Promise<void> {
	await page.goto(`investor/analyze/${query}`);
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
}

async function type(page: Page, selector: string, value: string): Promise<void> {
	const field = page.locator(selector);
	await field.fill(value);
	await field.press('Tab');
}

const cashFlow = (page: Page) => page.locator('#results [data-metric="cashFlow"]');

async function trySample(page: Page): Promise<void> {
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(cashFlow(page)).toHaveText('$184');
}

test('manual entry makes zero RentCast calls with a key present', async ({ page, net }) => {
	const rc = await mockRentCast(page, net);
	const rcRequests = collectRequests(page, ['api.rentcast.io']);
	await useMockedRentCastKey(page);
	await openAnalyzer(page);

	// Closing stays at the 3% default ($6,000) and the expense percents at 5/8/5/5: reference case A.
	await type(page, '#price', '200000');
	await type(page, '#down-pct', '20');
	await type(page, '#rate', '7');
	await type(page, '#rent', '2000');
	await type(page, '#expense-tax-amount', '200');
	await type(page, '#expense-insurance-amount', '100');
	await expect(cashFlow(page)).toHaveText('$184');
	await expect(page.locator('#price')).toHaveValue('200,000');

	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	await page.reload();
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(cashFlow(page)).toHaveText('$184');

	expect(rcRequests).toEqual([]);
	expect(rc.count()).toBe(0);
});

test('expense lines drive the results', async ({ page }) => {
	await openAnalyzer(page);
	await trySample(page);

	// Management 8% -> 10% of $1,900 collected: $38 a month more.
	await type(page, '#expense-management-amount', '10');
	await expect(cashFlow(page)).toHaveText('$146');

	// Maintenance to dollars: 5% of $2,000 rent becomes $100 a month; cash flow unchanged.
	await page
		.getByRole('group', { name: 'Maintenance entered as' })
		.getByText('$ per month')
		.click();
	await expect(page.locator('#expense-maintenance-amount')).toHaveValue('100');
	await expect(cashFlow(page)).toHaveText('$146');

	// A custom line lowers cash flow by its amount; removing it restores it.
	await page.getByRole('button', { name: 'Add expense line' }).click();
	await expect(page.getByLabel('Expense name')).toBeFocused();
	await page.getByLabel('Expense name').fill('Pest control');
	await type(page, '#expense-custom-1-amount', '50');
	await expect(cashFlow(page)).toHaveText('$96');
	await page.getByRole('button', { name: 'Remove Pest control' }).click();
	await expect(cashFlow(page)).toHaveText('$146');

	// Every definition is on the page, no hover needed.
	await expect(
		page.getByText('A year of NOI divided by the purchase price. It leaves out financing.')
	).toBeVisible();
	await expect(
		page.getByText(
			"NOI divided by a year of loan payments. Below 1.00 means the income doesn't cover the loan."
		)
	).toBeVisible();
});

test('validation runs on blur with the exact copy', async ({ page }) => {
	await openAnalyzer(page);
	const price = page.locator('#price');
	await price.fill('abc');
	await expect(page.getByText('Enter a number, like 250000.')).toHaveCount(0);
	await price.press('Tab');
	await expect(page.getByText('Enter a number, like 250000.')).toBeVisible();
	await expect(price).toHaveAttribute('aria-invalid', 'true');

	await type(page, '#down-pct', '120');
	await expect(page.getByText('Use a percent from 0 to 100.')).toBeVisible();
	await expect(page.locator('#down-pct')).toHaveAttribute('aria-invalid', 'true');
});

test('all cash removes the loan fields and DSCR reads No loan', async ({ page }) => {
	await openAnalyzer(page);
	await trySample(page);
	await page.getByLabel('All cash').check();
	await expect(page.locator('#down-pct')).toHaveCount(0);
	await expect(page.locator('#rate')).toHaveCount(0);
	await expect(page.getByText("No loan, so there's no loan payment and no DSCR.")).toBeVisible();
	await expect(page.locator('#results [data-metric="dscr"]')).toContainText('No loan');
});

test('save and reopen a deal', async ({ page }) => {
	await openAnalyzer(page);
	await trySample(page);
	await expect(page.locator('#results-heading')).toBeFocused();

	const save = page.getByRole('button', { name: 'Save deal' });
	await save.click();
	await expect(page).toHaveURL(/\/investor\/analyze\/\?id=[0-9a-f-]{36}$/);
	await expect(page.locator('[data-save-status]')).toContainText('Saved');
	await expect(page.getByText('Saved to your deals.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Draft a memo' })).toBeVisible();

	const other = await page.context().newPage();
	await other.goto(page.url());
	await expect(other.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(other.locator('#price')).toHaveValue('200,000');
	await expect(other.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	await expect(other.locator('[data-save-status]')).toContainText('Saved');

	// An edit flips the badge and the primary label.
	await type(page, '#rent', '2,100');
	await expect(page.locator('[data-save-status]')).toHaveText('Unsaved changes');
	await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Draft a memo' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.locator('[data-save-status]')).toContainText('Saved');
	await other.close();
});

test('the working draft survives a reload', async ({ page }) => {
	await openAnalyzer(page);
	await type(page, '#price', '200000');
	await type(page, '#rent', '2100');
	await page.waitForTimeout(600);
	await page.reload();
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(page.locator('#rent')).toHaveValue('2,100');
	await expect(page.locator('#price')).toHaveValue('200,000');
	await expect(page.locator('[data-save-status]')).toHaveText('Unsaved changes');
});

test('clear analysis asks first and empties the form', async ({ page }) => {
	await openAnalyzer(page);
	await trySample(page);
	await page.locator('[data-action-row]').getByRole('button', { name: 'Clear analysis' }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Clear this analysis?' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Keep my numbers' })).toBeFocused();
	await dialog.getByRole('button', { name: 'Clear analysis' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.locator('#deal-name')).toBeFocused();
	await expect(page.locator('#price')).toHaveValue('');
	await expect(page.locator('#results [data-results-empty]')).toBeVisible();

	// The cleared draft stays cleared after a reload.
	await page.waitForTimeout(600);
	await page.reload();
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(page.locator('#price')).toHaveValue('');
});

test('a missing deal id shows the not-found panel', async ({ page }) => {
	await page.goto('investor/analyze/?id=nope');
	await expect(page.getByText("We couldn't find that deal in this browser")).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to saved deals' })).toBeVisible();
});

test('the sample link fills the sample deal', async ({ page }) => {
	await page.goto('investor/analyze/?sample=1');
	await expect(page.locator('#price')).toHaveValue('200,000');
	await expect(cashFlow(page)).toHaveText('$184');
	await expect(page).not.toHaveURL(/sample=1/);
});

test('analyzer states have no axe violations', async ({ page }) => {
	await openAnalyzer(page);
	await expectNoAxeViolations(page, 'analyzer empty');

	await trySample(page);
	await expectNoAxeViolations(page, 'analyzer filled');

	await page.locator('#results summary', { hasText: 'Show the math' }).click();
	await expect(page.getByText('Operating expenses before vacancy')).toBeVisible();
	await expectNoAxeViolations(page, 'analyzer with Show the math open');

	await type(page, '#repairs', 'abc');
	await expect(page.locator('#repairs')).toHaveAttribute('aria-invalid', 'true');
	await expectNoAxeViolations(page, 'analyzer with a field error');

	await page.locator('[data-action-row]').getByRole('button', { name: 'Clear analysis' }).click();
	await expect(page.getByRole('alertdialog', { name: 'Clear this analysis?' })).toBeVisible();
	await expectNoAxeViolations(page, 'analyzer Clear dialog');
});

test('375px: no horizontal scroll, also with WCAG text spacing', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await openAnalyzer(page);
	await expectNoHorizontalScroll(page);
	await page.getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(cashFlow(page)).toHaveText('$184');
	await expectNoHorizontalScroll(page);
	await page.evaluate(() => {
		const s = new CSSStyleSheet();
		s.replaceSync(
			'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'
		);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
	});
	await expect(page.locator('h1')).not.toHaveCSS('word-spacing', '0px');
	await expectNoHorizontalScroll(page);
});
