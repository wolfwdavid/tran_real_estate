import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
	blockRentCast,
	mockRentCast,
	saveCap,
	saveRentCastKey,
	seedLedger,
	seedSavedSearches
} from './helpers/data';

// The Data source status bar and the check-on-open saved-search run (04-22) on the real built
// site, both bases (DATA-01, DATA-03; 04-UI-SPEC "DataStatusBar", "DueSearchesDialog").
// RentCast is never reached: blockRentCast aborts every request, and mocked tests count requests.

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/**
 * Seeds due saved searches from the marketing home page, which mounts no DataShell. Seeding on an
 * (app) page races that page's own check-on-open pass: if the pass lists the rows, it opens
 * DueSearchesDialog there and holds the 'tran-alerts' lock while waiting, so the next page's pass
 * can come back 'busy'.
 */
async function seedFromHome(page: Page, n: number): Promise<void> {
	await page.goto('');
	await seedSavedSearches(page, n, { lastRunAt: null, reload: false });
}

const statusBar = (page: Page) => page.getByRole('region', { name: 'Data source' });

test.beforeEach(async ({ page }) => {
	await blockRentCast(page);
});

for (const route of ['renter/', 'investor/']) {
	test(`keyless ${route}: "Sample data" leads <main>, links to the key, axe clean`, async ({
		page
	}) => {
		await page.goto(route);
		const bar = statusBar(page);
		await expect(bar).toContainText('Sample data');
		await expect(bar).toContainText('The places, people, and numbers here are made up.');
		const link = bar.getByRole('link', { name: 'Add a RentCast key' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', /settings\/#api-keys$/);

		const first = page.locator('main > :first-child');
		await expect(first).toHaveAttribute('role', 'region');
		await expect(first).toHaveAttribute('aria-label', 'Data source');

		await expectAxeClean(page, `${route} (sample)`);
	});
}

// The agent CRM spends no RentCast calls, so the bar is hidden on /agent/* (08-UI-SPEC Planner
// Note 4); the agent sub-pages are covered by agent-shell.spec.ts.
for (const route of ['settings/', '', 'agent/']) {
	test(`no Data source bar on ${route || 'home'}`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('main h1').first()).toBeVisible();
		if (route === 'settings/') {
			await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
		}
		await expect(statusBar(page)).toHaveCount(0);
	});
}

test('live: the compact meter shows "0 of 50" with the Usage and cap link, axe clean', async ({
	page
}) => {
	await saveRentCastKey(page);
	await page.goto('renter/');
	const bar = statusBar(page);
	await expect(bar).toContainText('RentCast calls:');
	await expect(bar).toContainText('0 of 50');
	await expect(bar.getByRole('link', { name: 'Usage and cap' })).toBeVisible();
	await expect(bar).not.toContainText('Sample data');
	await expectAxeClean(page, 'renter/ (live)');
});

test('live at the cap: due searches wait with the "weren\'t checked" line, no call', async ({
	page
}) => {
	const calls = await mockRentCast(page, () => ({ status: 404 }));
	await saveRentCastKey(page);
	await saveCap(page, 1);
	await seedLedger(page, 1);
	await seedFromHome(page, 5);
	await page.goto('renter/');

	const bar = statusBar(page);
	await expect(bar).toContainText(
		"Saved searches weren't checked because you've reached your cap. 5 are waiting."
	);
	await expect(bar.getByRole('link', { name: 'Change your cap' })).toBeVisible();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	expect(calls).toHaveLength(0);
	await expectAxeClean(page, 'renter/ (alerts at cap)');
});

test('more than 3 due: DueSearchesDialog opens on Not now; Not now spends nothing', async ({
	page
}) => {
	const calls = await mockRentCast(page, () => ({ status: 404 }));
	await saveRentCastKey(page);
	await saveCap(page, 40);
	await seedFromHome(page, 5);
	await page.goto('renter/');

	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole('heading', { name: 'Check 5 saved searches for new listings?' })
	).toBeVisible();
	await expect(dialog).toContainText('Calls this check uses:');
	const notNow = dialog.getByRole('button', { name: 'Not now', exact: true });
	await expect(notNow).toBeFocused();
	await expectAxeClean(page, 'renter/ (DueSearchesDialog)');

	await notNow.click();
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('live-announcer')).toHaveText(
		"Saved searches weren't checked. Tran will ask again next time you open it."
	);
	expect(calls).toHaveLength(0);
});
