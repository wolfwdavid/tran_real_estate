import type { Locator, Page } from '@playwright/test';
import { CHROME_ROUTES, TOOL_ROUTES } from './routes';
import { RENTER_TEST_OPTIONS, expect, test } from './support/network';

// The disclaimer presence audit (10-21; PITFALLS "Looks Done But Isn't": Disclaimers; 10-UI-SPEC
// docs/LAUNCH-AUDIT.md item 6). Every page with the site chrome carries the footer's
// not-a-brokerage / not-advice sentence; every calculator carries "General guidelines, not
// financial advice"; the deal analyzer, the investor memo and its printout, the fair-rent check and
// the Market Snapshot (builder and printout) carry their own disclaimers. Report surfaces are
// visited in sample mode, so no key is needed, and the shared harness (support/network) fails a
// test on any request that leaves the local server.
//
// The launch audit (scripts/launch-audit.mjs) reads the results by test title, `disclaimer:
// <name>`, and prints the required text from DISCLAIMER_CHECKS below. It parses this array as
// source: keep every entry a flat object literal with literal `name` and `text` strings (wording
// verbatim from the components and the phase UI-SPECs). The footer check runs once per chrome route
// under the same name, so one failing route fails the audit row.

export interface DisclaimerCheck {
	name: string;
	/** Where the check looks (base-relative, as visited). */
	route: string;
	text: string;
	scope: 'footer' | 'page';
}

export const DISCLAIMER_CHECKS: readonly DisclaimerCheck[] = [
	{
		name: 'site footer',
		route: 'every route in CHROME_ROUTES',
		text: 'Tran Real Estate Tools is software, not a real estate brokerage. Nothing on this site is investment, legal, or tax advice.',
		scope: 'footer'
	},
	{
		name: 'affordability calculator',
		route: 'tools/affordability/',
		text: 'General guidelines, not financial advice',
		scope: 'page'
	},
	{
		name: 'cap rate calculator',
		route: 'tools/cap-rate/',
		text: 'General guidelines, not financial advice',
		scope: 'page'
	},
	{
		name: 'cash-on-cash calculator',
		route: 'tools/cash-on-cash/',
		text: 'General guidelines, not financial advice',
		scope: 'page'
	},
	{
		name: 'DSCR calculator',
		route: 'tools/dscr/',
		text: 'General guidelines, not financial advice',
		scope: 'page'
	},
	{
		name: 'renter affordability',
		route: 'renter/affordability/',
		text: 'This is a general guideline based on common rules of thumb, not financial advice.',
		scope: 'page'
	},
	{
		name: 'deal analyzer',
		route: 'investor/analyze/ (sample deal)',
		text: "These figures are arithmetic on the numbers you entered. They're not investment, legal, or tax advice. Check every number before you rely on it.",
		scope: 'page'
	},
	{
		name: 'investor overview',
		route: 'investor/',
		text: 'Not investment, legal, or tax advice. Tran is software, not a brokerage.',
		scope: 'page'
	},
	{
		name: 'investor memo',
		route: 'investor/memo/?id= (saved sample deal)',
		text: 'Not investment, legal, or tax advice. Tran is software, not a brokerage.',
		scope: 'page'
	},
	{
		name: 'investor memo printout',
		route: 'print/memo/?id= (saved sample deal)',
		text: 'This memo was prepared with Tran Real Estate Tools, a software tool. It is not investment, legal, or tax advice, and Tran is not a real estate brokerage.',
		scope: 'page'
	},
	{
		name: 'fair-rent check',
		route: 'renter/listing/?id=SAMPLE-74201-R017 (sample data)',
		text: 'Estimates can be wrong. Use them as one input when you talk to the listing contact.',
		scope: 'page'
	},
	{
		name: 'market snapshot builder',
		route: 'agent/studio/snapshot/',
		text: 'Market information only. Not a comparative market analysis or a professional valuation of any property.',
		scope: 'page'
	},
	{
		name: 'market snapshot printout',
		route: 'print/snapshot/?id=sample',
		text: 'Market information only. Not a comparative market analysis or a professional valuation of any property.',
		scope: 'page'
	}
];

const TITLE = 'disclaimer: ';

function check(name: string): DisclaimerCheck {
	const c = DISCLAIMER_CHECKS.find((d) => d.name === name);
	if (!c) throw new Error(`no DISCLAIMER_CHECKS entry named ${name}`);
	return c;
}

/** The required text is on the page (whitespace-normalized) and visible. */
async function expectCarries(scope: Locator, text: string): Promise<void> {
	await expect(scope).toContainText(text);
	await expect(scope.getByText(text).first()).toBeVisible();
}

async function open(page: Page, path: string): Promise<void> {
	const response = await page.goto(path);
	expect(response?.status(), `${path} status`).toBe(200);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
}

test.use(RENTER_TEST_OPTIONS);

test('DISCLAIMER_CHECKS names are unique and every calculator page is covered', () => {
	const names = DISCLAIMER_CHECKS.map((c) => c.name);
	expect(names).toHaveLength(new Set(names).size);
	const calculators = TOOL_ROUTES.filter((r) => r !== 'tools/');
	expect(calculators).toHaveLength(4);
	for (const route of calculators) {
		expect(DISCLAIMER_CHECKS.map((c) => c.route)).toContain(route);
	}
});

// The footer on every page with the site chrome (print and public pages have none).
for (const route of CHROME_ROUTES) {
	test.describe(`footer on ${JSON.stringify(route)}`, () => {
		test(`${TITLE}site footer`, async ({ page }) => {
			await open(page, route);
			const footer = page.getByRole('contentinfo');
			await expect(footer).toHaveCount(1);
			await expect(footer).toContainText(check('site footer').text);
			await expect(footer).toContainText('not a real estate brokerage');
		});
	});
}

// The calculators: the "General guidelines, not financial advice" aside.
for (const name of [
	'affordability calculator',
	'cap rate calculator',
	'cash-on-cash calculator',
	'DSCR calculator'
]) {
	test(`${TITLE}${name}`, async ({ page }) => {
		const c = check(name);
		await open(page, c.route);
		await expectCarries(page.locator('main'), c.text);
	});
}

test(`${TITLE}renter affordability`, async ({ page }) => {
	const c = check('renter affordability');
	await open(page, c.route);
	await expectCarries(page.locator('main'), c.text);
});

test(`${TITLE}investor overview`, async ({ page }) => {
	const c = check('investor overview');
	await open(page, c.route);
	await expectCarries(page.locator('main'), c.text);
});

/** Analyzer -> Try a sample deal (sample mode, no key, 0 calls). */
async function sampleDeal(page: Page): Promise<void> {
	await open(page, 'investor/analyze/');
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
}

/** Sample deal -> Save deal -> Draft a memo: the memo page for the saved deal. */
async function sampleMemo(page: Page): Promise<void> {
	await sampleDeal(page);
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	await page.getByRole('link', { name: 'Draft a memo' }).click();
	await expect(page).toHaveURL(/\/investor\/memo\/\?id=/);
	await expect(page.locator('[data-memo-page]')).toBeVisible();
}

test(`${TITLE}deal analyzer`, async ({ page }) => {
	await sampleDeal(page);
	await expectCarries(page.locator('#results'), check('deal analyzer').text);
});

test(`${TITLE}investor memo`, async ({ page }) => {
	await sampleMemo(page);
	await expectCarries(page.locator('[data-memo-page]'), check('investor memo').text);
});

test(`${TITLE}investor memo printout`, async ({ page }) => {
	await sampleMemo(page);
	await page.getByRole('link', { name: 'Print the analysis without a memo' }).click();
	await expect(page).toHaveURL(/print\/memo\/\?id=/);
	await expect(page.locator('[data-ready]')).toBeVisible();
	const sheet = page.locator('article.print-sheet');
	await expectCarries(sheet, check('investor memo printout').text);
	// The short form sits at the top of the sheet too.
	await expect(sheet.locator('header')).toContainText('Not investment, legal, or tax advice.');
});

test(`${TITLE}fair-rent check`, async ({ page }) => {
	await open(page, 'renter/listing/?id=SAMPLE-74201-R017');
	await expect(page.getByText('Loading listing…')).toHaveCount(0);
	// The estimate is shown (sample data reads its fixture for free), so this is the result
	// state's disclaimer (06-UI-SPEC). The pre-estimate intro ("...not a professional valuation")
	// shows only before a live estimate is requested; renter-fair-rent.spec.ts covers it.
	const estimate = page.locator('[data-fair-rent-tier="rent-estimate"]');
	await expect(estimate.getByText(/^Estimate: \$[\d,]+ a month$/)).toBeVisible();
	await expectCarries(estimate, check('fair-rent check').text);
});

test(`${TITLE}market snapshot builder`, async ({ page }) => {
	await open(page, 'agent/studio/snapshot/');
	await expect(page.locator('h1')).toHaveText('Market Snapshot');
	await expectCarries(page.locator('main'), check('market snapshot builder').text);
});

test(`${TITLE}market snapshot printout`, async ({ page }) => {
	await open(page, 'print/snapshot/?id=sample');
	await expect(page.locator('[data-ready]')).toBeVisible();
	await expectCarries(page.locator('article.print-sheet'), check('market snapshot printout').text);
});
