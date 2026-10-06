// Saved deals and compare E2E (07-16, INV-03). Runs on the root and sub projects through the 06-09
// no-network harness. Deals are created through the analyzer UI only (never by writing storage
// directly). Proves: list, sort, the 3-deal selection cap, the side-by-side comparison as a real
// table at 1280px and stacked by metric at 375px with Highest/Lowest words, removal from the
// comparison, unknown ids, delete with confirmation and focus, axe, and zero RentCast calls.
import type { Page } from '@playwright/test';
import {
	INVESTOR_TEST_OPTIONS,
	collectRequests,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	test
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const CAP_STATUS = '3 selected, the most you can compare. Clear one to choose another.';
const CAPTION =
	"Highest or Lowest marks the top figure in each row for that measure, for example the lowest GRM or the highest cash flow. It's arithmetic, not a recommendation.";

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

/** Save the current form as a new deal named `name` and wait for the URL to carry its new id. */
async function saveAsNew(page: Page, name: string): Promise<string> {
	const before = dealId(page);
	await type(page, '#deal-name', name);
	await page.getByRole('button', { name: 'Save as a new deal' }).click();
	await expect.poll(() => dealId(page)).not.toBe(before);
	return dealId(page)!;
}

/** Sample deal, Lower rent, Higher rent, Cheaper: all through the analyzer. Returns the ids. */
async function createFourDeals(page: Page): Promise<string[]> {
	await openAnalyzer(page, '?sample=1');
	await expect(page.locator('#deal-name')).toHaveValue('Sample deal');
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	const ids = [dealId(page)!];
	await type(page, '#rent', '1500');
	ids.push(await saveAsNew(page, 'Lower rent'));
	await type(page, '#rent', '2500');
	ids.push(await saveAsNew(page, 'Higher rent'));
	await type(page, '#price', '150000');
	ids.push(await saveAsNew(page, 'Cheaper'));
	return ids;
}

const cards = (page: Page) => page.locator('[data-deal-card]');
const compareBox = (page: Page, name: string) =>
	page.getByRole('checkbox', { name: `Compare ${name}`, exact: true });

async function openDeals(page: Page): Promise<void> {
	await page.goto('investor/deals/');
	await expect(page.getByRole('heading', { level: 1, name: 'Saved deals' })).toBeVisible();
}

/** WCAG 1.4.12 text spacing overrides (a constructed sheet: the CSP blocks inline styles). */
async function applyTextSpacing(page: Page): Promise<void> {
	await page.evaluate(() => {
		const s = new CSSStyleSheet();
		s.replaceSync(
			'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'
		);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
	});
	await expect(page.locator('h1')).not.toHaveCSS('word-spacing', '0px');
}

test('empty deals list offers to analyze or try the sample', async ({ page }) => {
	await openDeals(page);
	await expect(page.getByRole('heading', { level: 2, name: 'No saved deals yet' })).toBeVisible();
	await expect(
		page.getByText(
			'Analyze a property and save it to keep it here. You can compare up to 3 saved deals side by side.'
		)
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Analyze a deal' }).first()).toBeVisible();
	const sample = page.getByRole('link', { name: 'Try a sample deal' });
	await expect(sample).toHaveAttribute('href', /investor\/analyze\/\?sample=1$/);
	await expectNoAxeViolations(page, 'deals empty');

	await sample.click();
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await expect(page.locator('#deal-name')).toHaveValue('Sample deal');
});

test('list, sort, select up to 3, compare at 1280 and 375, remove, delete', async ({ page }) => {
	test.slow();
	const rentcast = collectRequests(page, ['api.rentcast.io']);
	await createFourDeals(page);

	// 2. List and sort.
	await openDeals(page);
	await expect(cards(page)).toHaveCount(4);
	await expect(cards(page).first()).toContainText('Saved ');
	await page.getByLabel('Sort by').selectOption({ label: 'Cap rate (highest first)' });
	const caps = await cards(page).locator('[data-metric="capRate"] dd').allInnerTexts();
	const nums = caps.map((t) => {
		const n = Number.parseFloat(t.replace('−', '-').replace(/[^\d.-]/g, ''));
		return Number.isFinite(n) ? n : -Infinity;
	});
	expect(nums).toHaveLength(4);
	for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeLessThanOrEqual(nums[i - 1]);
	await expect(cards(page).first().locator('h2')).toHaveText('Cheaper');

	// 3. Selection: the 4th is refused with a visible, announced reason.
	const status = page.locator('[data-compare-status]');
	await expect(status).toHaveText('Select 2 or 3 deals to compare.');
	const blockedLink = page.getByRole('link', { name: 'Compare 2 deals' });
	await expect(blockedLink).toHaveAttribute('aria-disabled', 'true');
	await expect(blockedLink).not.toHaveAttribute('href', /.*/);
	await expect(page.getByText('Select at least 2 deals to compare.')).toBeVisible();

	for (const name of ['Cheaper', 'Higher rent', 'Sample deal']) {
		await compareBox(page, name).click();
		await expect(compareBox(page, name)).toBeChecked();
	}
	await expect(status).toHaveText(CAP_STATUS);
	const fourth = compareBox(page, 'Lower rent');
	await expect(fourth).toHaveAttribute('aria-disabled', 'true');
	await fourth.focus();
	await page.keyboard.press('Space');
	await expect(fourth).not.toBeChecked();
	await expect(fourth).toBeFocused();
	await expect(
		page.locator('[data-compare-cap]', {
			hasText: 'You can compare up to 3 deals. Clear one to choose another.'
		})
	).toBeVisible();
	await expectNoAxeViolations(page, 'deals with 3 selected');

	await page.getByRole('link', { name: 'Compare 3 deals' }).click();
	await expect(page).toHaveURL(/investor\/compare\/\?ids=/);

	// 4. Compare at 1280px: a real table.
	await page.setViewportSize({ width: 1280, height: 900 });
	const table = page.locator('table');
	await expect(table).toBeVisible();
	await expect(table.locator('caption')).toHaveText(CAPTION);
	await expect(table.locator('th[scope="col"]')).toHaveCount(3);
	await expect(table.locator('th[scope="row"]')).toHaveCount(10);
	const marked = table.locator('td[data-marked="true"]');
	expect(await marked.count()).toBeGreaterThan(0);
	for (const text of await marked.allInnerTexts()) expect(text).toMatch(/Highest|Lowest/);
	const grmMarked = table.locator('tr[data-row="grm"] td[data-marked="true"]');
	expect(await grmMarked.count()).toBeGreaterThan(0);
	for (const text of await grmMarked.allInnerTexts()) {
		expect(text).toContain('Lowest');
		expect(text).not.toContain('Highest');
	}
	expect(await page.locator('#main-content').innerText()).not.toMatch(/best/i);
	await expectNoAxeViolations(page, 'compare at 1280');

	// 5. Compare at 375px: stacked by metric, no sideways scroll, remove one deal.
	await page.setViewportSize({ width: 375, height: 812 });
	await expect(table).toBeHidden();
	const stacked = page.locator('[data-compare-view="stacked"]');
	await expect(stacked.locator('[data-metric-card]')).toHaveCount(10);
	await expect(stacked.getByRole('heading', { level: 2, name: 'GRM', exact: true })).toBeVisible();
	await expect(
		stacked.getByRole('heading', { level: 2, name: 'Deals in this comparison' })
	).toBeVisible();
	await expectNoHorizontalScroll(page);
	await expectNoAxeViolations(page, 'compare at 375');

	const dealsHere = stacked.getByRole('region', { name: 'Deals in this comparison' });
	const removes = dealsHere.getByRole('button', { name: /^Remove .* from comparison$/ });
	await expect(removes).toHaveCount(3);
	const firstName = (await removes.first().getAttribute('aria-label'))!;
	await removes.first().click();
	await expect(removes).toHaveCount(2);
	await expect.poll(() => new URL(page.url()).searchParams.get('ids')?.split(',').length).toBe(2);
	await expect(removes.first()).toBeFocused();
	await expect(dealsHere).not.toContainText(firstName.replace(/^Remove | from comparison$/g, ''));
	await expect(stacked.locator('[data-metric-card]')).toHaveCount(10);
	await applyTextSpacing(page);
	await expectNoHorizontalScroll(page);

	// 7. Delete with confirmation (back at desktop width).
	await page.setViewportSize({ width: 1280, height: 900 });
	await openDeals(page);
	await expect(cards(page)).toHaveCount(4);
	await page.getByRole('button', { name: 'Delete Lower rent' }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Delete Lower rent?' });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByText(
			"This removes the deal and its memo drafts from this browser. It can't be undone. Download a backup first if you might want it later."
		)
	).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Keep deal' })).toBeFocused();
	await expectNoAxeViolations(page, 'delete dialog open');
	await dialog.getByRole('button', { name: 'Delete deal' }).click();
	await expect(dialog).toBeHidden();
	await expect(cards(page)).toHaveCount(3);
	await expect(page.getByRole('heading', { name: 'Lower rent' })).toHaveCount(0);
	await expect(page.locator('[data-deal-card] h2:focus')).toHaveCount(1);

	expect(rentcast).toEqual([]);
});

test('compare links with unknown ids', async ({ page }) => {
	await openAnalyzer(page, '?sample=1');
	await expect(page.locator('#deal-name')).toHaveValue('Sample deal');
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	const id = dealId(page)!;

	await page.goto('investor/compare/?ids=missing1,missing2');
	await expect(
		page.getByRole('heading', { level: 2, name: 'Pick at least 2 deals to compare' })
	).toBeVisible();
	await expect(page.getByText('Choose 2 or 3 deals from your saved deals.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Go to saved deals' })).toBeVisible();

	await page.goto(`investor/compare/?ids=${id},missing1`);
	await expect(
		page.getByText("1 deal in the link isn't in this browser, so it isn't shown.")
	).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Pick at least 2 deals to compare' })
	).toBeVisible();
	await expect(page.locator('table')).toHaveCount(0);
});
