import type { Page, Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls, type Net } from './support/network';
import { mockRentCast } from './support/rentcast-mocks';
import { withRentCastKey } from './support/seed';

// RENT-08 end to end: the affordability calculator gives the contract range, makes zero network
// requests to any host, saves nothing, passes axe empty and filled, and its CTA prefills the
// search max without spending a call. Runs on both bases through the shared renter harness.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** The CTA target: the search page with only `?max=1800` prefilled. */
const SEARCH_MAX = 'renter/?max=1800';
const RANGE = 'Rent that fits: $1,500 to $1,800 a month';

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** Records every request that leaves the local preview server. */
function collectExternal(page: Page): string[] {
	const external: string[] = [];
	page.on('request', (r: Request) => {
		const host = new URL(r.url()).hostname;
		if (host !== '127.0.0.1' && host !== 'localhost') external.push(r.url());
	});
	return external;
}

async function open(page: Page) {
	await page.goto('renter/affordability/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(
		page.getByRole('heading', { level: 1, name: 'What rent fits your budget' })
	).toBeVisible();
}

async function fillContract(page: Page) {
	await page.getByRole('textbox', { name: 'Income before taxes' }).fill('72,000');
	await page.getByRole('textbox', { name: 'Monthly debt payments' }).fill('400');
	await expect(page.getByRole('heading', { name: RANGE })).toBeVisible();
}

const slider = (page: Page) => page.getByRole('slider', { name: 'Try a rent amount' });
const rentInput = (page: Page) =>
	page.getByRole('spinbutton', { name: 'Try a rent amount a month' });

function noRentCast(net: Net) {
	expect(Object.keys(net.counts).filter((k) => k.startsWith('api.rentcast.io'))).toEqual([]);
	expect(rentcastCalls(net)).toBe(0);
}

test('empty state and axe', async ({ page }) => {
	await open(page);
	await expect(
		page.getByText("These numbers stay on this page. Tran doesn't save them.")
	).toBeVisible();
	await expect(page.getByText('Enter your income to see a rent range.')).toBeVisible();
	await expect(page.getByText('not financial advice')).toBeVisible();
	await expectNoViolations(page, 'affordability empty');
});

test('income gives the contract range with zero requests', async ({ page, net }) => {
	const external = collectExternal(page);
	await open(page);
	await fillContract(page);

	const terms = page.locator('dl');
	await expect(terms).toContainText('25% of your income');
	await expect(terms).toContainText('$1,500');
	await expect(terms).toContainText('$1,800');
	await expect(terms).toContainText('$2,000');
	await expect(slider(page)).toHaveAttribute('aria-valuetext', '$1,800 a month');
	await expect(page.getByText('within the 30% guideline')).toBeVisible();

	await rentInput(page).fill('2100');
	await expect(slider(page)).toHaveAttribute('aria-valuetext', '$2,100 a month');
	await expect(page.getByText('above the 40% check')).toBeVisible();

	expect(external).toEqual([]);
	noRentCast(net);
});

test('filled state passes axe with the slider focused', async ({ page }) => {
	await open(page);
	await fillContract(page);
	await slider(page).focus();
	await expect(slider(page)).toBeFocused();
	await expectNoViolations(page, 'affordability filled');
});

test('nothing is saved', async ({ page }) => {
	await open(page);
	await fillContract(page);
	// Outlast the result settle and the announcement debounce, so any write would have happened.
	await page.waitForTimeout(1_200);
	const stored = () =>
		page.evaluate(() =>
			[localStorage, sessionStorage].flatMap((s) =>
				Object.keys(s).map((k) => `${k}=${s.getItem(k) ?? ''}`)
			)
		);
	const before = await stored();
	expect(before.filter((e) => e.includes('72000') || e.includes('72,000'))).toEqual([]);
	expect(page.url()).not.toContain('72');

	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Income before taxes' })).toHaveValue('');
	await expect(page.getByText('Enter your income to see a rent range.')).toBeVisible();
	const after = await stored();
	expect(after.filter((e) => e.includes('72000') || e.includes('72,000'))).toEqual([]);
});

test('CTA prefills max and spends nothing', async ({ page, net }) => {
	await open(page);
	await fillContract(page);
	await page.getByRole('link', { name: 'Search rentals up to $1,800' }).click();
	await expect(page).toHaveURL((url) => url.href.endsWith(SEARCH_MAX));
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	noRentCast(net);
});

test('keyboard: Tab reaches the slider and ArrowRight adds $25', async ({ page }) => {
	await open(page);
	await fillContract(page);
	await rentInput(page).focus();
	await page.keyboard.press('Tab');
	await expect(slider(page)).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page)).toHaveAttribute('aria-valuetext', '$1,825 a month');
	await expect(rentInput(page)).toHaveValue('1825');
});

test('with a RentCast key the page still makes zero RentCast calls', async ({ page, net }) => {
	await withRentCastKey(page);
	await mockRentCast(page, net);
	const external = collectExternal(page);
	await open(page);
	await fillContract(page);
	await rentInput(page).fill('1900');
	await expect(page.getByText('above the 30% guideline')).toBeVisible();
	await page.getByRole('link', { name: 'Search rentals up to $1,800' }).click();
	await expect(page).toHaveURL((url) => url.href.endsWith(SEARCH_MAX));
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	expect(external).toEqual([]);
	noRentCast(net);
});
