import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FAKE_RENTCAST_KEY, RENTCAST_ROUTE, mockRentCast } from './helpers/data';

// /setup/rentcast/, the guided free RentCast key setup (10-16; GTM-01; 10-UI-SPEC "/setup/rentcast/").
// Real built site, both bases. RentCast (https://api.rentcast.io) is never reached: a catch-all
// route records and aborts every request, and afterEach asserts it recorded nothing; the Test key
// case answers from mockRentCast, which is registered later and takes precedence. Axe titles follow the 10-22 audit contract ("axe" in
// the title, "setup" in the path) and cover the three UI-SPEC states: no key, a saved untested key,
// and a tested key.

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

const step = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const step2 = (page: Page) => step(page, 'Paste and test your key');
const step3 = (page: Page) => step(page, 'Set your monthly call cap');
const finish = (page: Page) => step(page, 'Open your portal');

async function openSetup(page: Page, query = ''): Promise<void> {
	await page.goto(`setup/rentcast/${query}`);
	await expect(page.locator('[data-setup-page][data-hydrated="true"]')).toBeAttached();
}

async function saveKeyHere(page: Page): Promise<void> {
	const input = page.getByLabel('RentCast API key', { exact: true });
	await input.fill(FAKE_RENTCAST_KEY);
	await input
		.locator('xpath=ancestor::form[1]')
		.getByRole('button', { name: 'Save key', exact: true })
		.click();
	await expect(page.locator('#key-rentcast')).toContainText(
		`Key ending in ${FAKE_RENTCAST_KEY.slice(-4)}`
	);
}

/** RentCast requests that reached the catch-all (none may: only mockRentCast answers). */
let unexpected: string[] = [];

test.beforeEach(async ({ page }) => {
	unexpected = [];
	await page.route(RENTCAST_ROUTE, async (route) => {
		unexpected.push(`${route.request().method()} ${route.request().url()}`);
		await route.abort();
	});
});

test.afterEach(() => {
	expect(unexpected, 'unmocked requests to api.rentcast.io').toEqual([]);
});

const statusBar = (page: Page) => page.getByRole('region', { name: 'Data source' });
const announcer = (page: Page) => page.getByTestId('live-announcer');

test('prerendered shell: static copy, "Checking this browser…" placeholders, one noindex', async ({
	page
}) => {
	const response = await page.request.get('setup/rentcast/');
	expect(response.ok()).toBe(true);
	const html = await response.text();
	for (const text of [
		'Connect a free RentCast key',
		'Create a key just for Tran',
		'Paste and test your key',
		'Set your monthly call cap',
		'Open your portal',
		'Use sample data for now',
		'Checking this browser…',
		'https://app.rentcast.io/app/api'
	]) {
		expect(html, text).toContain(text);
	}
	expect(html.match(/name="robots" content="noindex"/g) ?? []).toHaveLength(1);
	expect(html).not.toContain('target="_blank"');
});

test('axe setup: no key — three steps, To do and Default: 40 badges, finish row for ?portal=investor', async ({
	page
}) => {
	await openSetup(page, '?portal=investor');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect a free RentCast key');
	await expect(page.locator('main ol > li')).toHaveCount(3);
	const headings = page.locator('main ol > li > section h2');
	await expect(headings).toHaveText([
		'Create a key just for Tran',
		'Paste and test your key',
		'Set your monthly call cap'
	]);

	const dashboard = page.getByRole('link', { name: /Open the RentCast API dashboard/ });
	await expect(dashboard).toHaveAttribute('href', 'https://app.rentcast.io/app/api');
	await expect(dashboard).not.toHaveAttribute('target');
	await expect(dashboard).toContainText('(opens external site)');

	await expect(step2(page).getByText('To do', { exact: true })).toBeVisible();
	await expect(step3(page).getByText('Default: 40', { exact: true })).toBeVisible();
	await expect(step3(page).getByLabel('Monthly call cap', { exact: true })).toHaveValue('40');
	await expect(
		finish(page).getByText('No tested key yet. Portals will use sample data until you add one.')
	).toBeVisible();
	// The setup page hides the portal Data source bar.
	await expect(statusBar(page)).toHaveCount(0);

	const open = finish(page).getByRole('link', { name: 'Open investor portal', exact: true });
	await expect(open).toHaveAttribute('href', /\/investor\/$/);
	await expect(
		finish(page).getByRole('link', { name: 'Use sample data for now', exact: true })
	).toHaveAttribute('href', /\/investor\/\?source=sample$/);

	await expect(
		step2(page).getByRole('link', { name: 'Key security', exact: true })
	).toHaveAttribute('href', /\/settings\/#key-security$/);

	// Visiting the page finishes the guide for this portal.
	const stored = await page.evaluate(() => localStorage.getItem('tran.onboarding.v1'));
	expect(JSON.parse(stored ?? 'null')).toEqual({ status: 'done', lastPortal: 'investor' });

	await expectAxeClean(page, 'setup/rentcast/ (no key)');
});

test('an unknown ?portal= falls back to the renter portal', async ({ page }) => {
	await openSetup(page, '?portal=hacker');
	await expect(
		finish(page).getByRole('link', { name: 'Open renter portal', exact: true })
	).toHaveAttribute('href', /\/renter\/$/);
	const stored = await page.evaluate(() => localStorage.getItem('tran.onboarding.v1'));
	expect(JSON.parse(stored ?? 'null')).toEqual({ status: 'done', lastPortal: 'renter' });
});

test('axe setup: saved untested key keeps step 2 at To do', async ({ page }) => {
	await openSetup(page, '?portal=agent');
	await saveKeyHere(page);
	await expect(step2(page).getByText('To do', { exact: true })).toBeVisible();
	await expect(step2(page).getByRole('button', { name: 'Test key (0 calls)' })).toBeVisible();
	await expect(finish(page).getByText('No tested key yet.', { exact: false })).toBeVisible();
	await expectAxeClean(page, 'setup/rentcast/ (saved, untested key)');
});

test('axe setup: tested key marks step 2 Done and the finish row ready, with one zero-cost probe', async ({
	page
}) => {
	const calls = await mockRentCast(page, () => ({ status: 404 }));
	await openSetup(page);
	await saveKeyHere(page);
	await step2(page).getByRole('button', { name: 'Test key (0 calls)' }).click();
	await expect(step2(page).getByText('Done', { exact: true })).toBeVisible();
	await expect(
		finish(page).getByText('Your key is saved and tested. Portals will use RentCast data.')
	).toBeVisible();
	expect(calls).toHaveLength(1);
	await expectAxeClean(page, 'setup/rentcast/ (tested key)');
});

test('saving a cap marks step 3 Done, and it stays Done after a reload', async ({ page }) => {
	await openSetup(page);
	const input = step3(page).getByLabel('Monthly call cap', { exact: true });
	await input.fill('30');
	await step3(page).getByRole('button', { name: 'Save cap', exact: true }).click();
	await expect(step3(page).getByText('Cap saved: 30 calls a month.')).toBeVisible();
	await expect(step3(page).getByText('Done', { exact: true })).toBeVisible();

	await openSetup(page);
	await expect(step3(page).getByText('Done', { exact: true })).toBeVisible();
	await expect(step3(page).getByLabel('Monthly call cap', { exact: true })).toHaveValue('30');
});

for (const portal of ['renter', 'investor'] as const) {
	test(`sample hand-off: ${portal}/?source=sample strips the parameter, announces and shows Sample data`, async ({
		page
	}) => {
		await page.goto(`${portal}/?source=sample`);
		await expect(announcer(page)).toHaveText('Showing sample data.');
		await expect(page).toHaveURL(new RegExp(`/${portal}/$`));
		expect(new URL(page.url()).searchParams.has('source')).toBe(false);
		await expect(statusBar(page)).toContainText('Sample data');
	});
}

test('sample hand-off: agent/?source=sample fills an empty CRM with the sample contacts', async ({
	page
}) => {
	await page.goto('agent/?source=sample');
	await expect(announcer(page)).toHaveText('Showing sample data.');
	await expect(page).toHaveURL(/\/agent\/$/);
	await page.goto('agent/contacts/');
	await expect(page.getByRole('region', { name: 'Sample contacts' })).toBeVisible();
});

test('the setup page finish row hands off to the chosen portal in sample mode', async ({
	page
}) => {
	await openSetup(page, '?portal=investor');
	await finish(page).getByRole('link', { name: 'Use sample data for now', exact: true }).click();
	await expect(page).toHaveURL(/\/investor\/$/);
	await expect(announcer(page)).toHaveText('Showing sample data.');
	await expect(statusBar(page)).toContainText('Sample data');
	expect(await page.evaluate(() => localStorage.getItem('tran.onboarding.v1'))).toBe(
		'{"status":"done","lastPortal":"investor"}'
	);
});
