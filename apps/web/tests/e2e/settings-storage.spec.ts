import { test, expect, type Page } from '@playwright/test';
import { announcer, openSettings, stubStorage } from './helpers/settings';

// PLAT-05: the Storage section reports persistent storage honestly (Granted / Not granted / Not
// reported, never a made-up value), lets the user ask again, and shows space used and last backup.
// Headless Chromium always answers persist() with false, so every granted path uses the Storage
// API stub; the unstubbed test documents that real behaviour.

type PersistWindow = Window & { __persistCalls?: number };

/** Counts navigator.storage.persist() calls. Register AFTER stubStorage (init scripts run in order). */
async function countPersistCalls(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const storage = navigator.storage as StorageManager & Record<string, unknown>;
		const original = storage?.persist;
		if (typeof original !== 'function') return;
		const w = window as PersistWindow;
		w.__persistCalls = 0;
		Object.defineProperty(storage, 'persist', {
			configurable: true,
			writable: true,
			value: () => {
				w.__persistCalls = (w.__persistCalls ?? 0) + 1;
				return original.call(storage);
			}
		});
	});
}

const storage = (page: Page) => page.locator('#storage');
const badge = (page: Page) => page.getByTestId('persist-badge');
const askAgain = (page: Page) =>
	storage(page).getByRole('button', { name: 'Ask the browser again' });

const GRANTED_TEXT =
	"This browser has agreed not to clear Tran's data to free up space. You can still clear it yourself in your browser settings.";
const NOT_GRANTED_TEXT =
	"This browser may clear Tran's data when the device is low on space, or after a week without a visit in Safari. Keep a recent backup.";
const NOT_REPORTED_TEXT =
	"This browser doesn't say whether it will keep Tran's data. Keep a recent backup.";

test('granted: badge, explanation and space used, no ask button', async ({ page }) => {
	await stubStorage(page, { persisted: true, estimate: { usage: 1536, quota: 6.4 * 1024 ** 3 } });
	await openSettings(page);
	await expect(badge(page)).toHaveText('Granted');
	await expect(storage(page).getByText(GRANTED_TEXT)).toBeVisible();
	await expect(storage(page).getByText('About 1.5 KB of 6.4 GB')).toBeVisible();
	await expect(askAgain(page)).toHaveCount(0);
});

test('not granted, ask again, granted', async ({ page }) => {
	await stubStorage(page, { persisted: false, grantOnRequest: true });
	await countPersistCalls(page);
	await openSettings(page);
	await expect(badge(page)).toHaveText('Not granted');
	await expect(storage(page).getByText(NOT_GRANTED_TEXT)).toBeVisible();

	await askAgain(page).click();
	await expect(badge(page)).toHaveText('Granted');
	await expect(announcer(page)).toHaveText('Persistent storage granted.');
	expect(await page.evaluate(() => (window as PersistWindow).__persistCalls)).toBe(1);
	await expect(askAgain(page)).toHaveCount(0);
});

test('not granted, ask again, still refused', async ({ page }) => {
	await stubStorage(page, { persisted: false, grantOnRequest: false });
	await openSettings(page);
	await expect(badge(page)).toHaveText('Not granted');
	await expect(storage(page).getByText('The browser said no.')).toHaveCount(0);

	await askAgain(page).click();
	await expect(announcer(page)).toHaveText("The browser didn't grant persistent storage.");
	await expect(badge(page)).toHaveText('Not granted');
	await expect(storage(page).getByText('The browser said no.')).toBeVisible();
});

test('not reported: neutral badge and no space-used row', async ({ page }) => {
	await stubStorage(page, { supported: false, estimate: null });
	await openSettings(page);
	await expect(badge(page)).toHaveText('Not reported');
	await expect(storage(page).getByText(NOT_REPORTED_TEXT)).toBeVisible();
	await expect(storage(page).getByText('Space used', { exact: true })).toHaveCount(0);
	await expect(askAgain(page)).toHaveCount(0);
});

test('real headless Chromium (no stub) reports Not granted, which is why the stubs exist', async ({
	page
}) => {
	await openSettings(page);
	await expect(badge(page)).toHaveText('Not granted');
	// The real estimate() is available, so the space row renders from the browser's own figure.
	await expect(storage(page).getByText(/^About .+ of .+$/)).toBeVisible();
});

test('last backup reads Never and links to the backup section', async ({ page }) => {
	await openSettings(page);
	await expect(page.getByTestId('last-backup-age')).toHaveText('Never');
	const link = storage(page).getByRole('link', { name: 'Download a backup' });
	await expect(link).toHaveAttribute('href', '#backup');
});
