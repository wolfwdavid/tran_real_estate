import { test, expect, type Page } from '@playwright/test';
import { blockRentCast, saveRentCastKey } from './helpers/data';

// The ?source=sample hand-off in the (app) layout (10-16; 10-UI-SPEC "Sample mode hand-off",
// Planner Note 7) and the DataStatusBar rule for /setup/rentcast/. Real built site, both bases;
// RentCast is never reached.

test.describe.configure({ timeout: 120_000 });

const statusBar = (page: Page) => page.getByRole('region', { name: 'Data source' });
const announcer = (page: Page) => page.getByTestId('live-announcer');

test.beforeEach(async ({ page }) => {
	await blockRentCast(page);
});

test('with a saved key, renter/?source=sample switches to sample data, cleans the URL and announces', async ({
	page
}) => {
	await saveRentCastKey(page);
	await page.goto('renter/');
	await expect(statusBar(page)).toContainText('RentCast calls:');

	await page.goto('renter/?source=sample');
	await expect(statusBar(page)).toContainText('Sample data');
	await expect(announcer(page)).toHaveText('Showing sample data.');
	await expect(page).toHaveURL(/\/renter\/$/);

	// The choice is the persisted data-source preference: it holds after a reload.
	await page.reload();
	await expect(statusBar(page)).toContainText('Sample data');
	await expect(statusBar(page)).not.toContainText('RentCast calls:');
});

test('investor/?source=sample without a key strips the parameter and announces', async ({
	page
}) => {
	// Other parameters and the hash survive.
	await page.goto('investor/?source=sample&x=1#top');
	await expect(announcer(page)).toHaveText('Showing sample data.');
	await expect(page).toHaveURL(/\/investor\/\?x=1#top$/);
	await expect(statusBar(page)).toContainText('Sample data');
});

test('agent/?source=sample loads the sample contacts into an empty CRM, once', async ({ page }) => {
	await page.goto('agent/?source=sample');
	await expect(announcer(page)).toHaveText('Showing sample data.');
	await expect(page).toHaveURL(/\/agent\/$/);

	await page.goto('agent/contacts/');
	await expect(page.getByRole('region', { name: 'Sample contacts' })).toBeVisible();
	const rows = await page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const count = db.transaction('contacts').objectStore('contacts').count();
					count.onsuccess = () => {
						resolve(count.result);
						db.close();
					};
				};
			})
	);

	// A second arrival with a non-empty CRM adds nothing.
	await page.goto('agent/?source=sample');
	await expect(announcer(page)).toHaveText('Showing sample data.');
	const again = await page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const count = db.transaction('contacts').objectStore('contacts').count();
					count.onsuccess = () => {
						resolve(count.result);
						db.close();
					};
				};
			})
	);
	expect(rows).toBeGreaterThan(0);
	expect(again).toBe(rows);
});

test('the setup page "Use sample data for now" hands off on an in-app navigation', async ({
	page
}) => {
	await page.goto('setup/rentcast/?portal=renter');
	await expect(page.locator('[data-setup-page][data-hydrated="true"]')).toBeAttached();
	await page.getByRole('link', { name: 'Use sample data for now', exact: true }).click();
	await expect(page).toHaveURL(/\/renter\/$/);
	await expect(announcer(page)).toHaveText('Showing sample data.');
});

test('no Data source bar on setup/rentcast/', async ({ page }) => {
	await page.goto('setup/rentcast/');
	await expect(page.locator('[data-setup-page][data-hydrated="true"]')).toBeAttached();
	await expect(statusBar(page)).toHaveCount(0);
});
