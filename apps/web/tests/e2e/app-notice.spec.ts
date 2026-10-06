import { test, expect, type Page } from '@playwright/test';
import { announcer, cspCollector, openSettings } from './helpers/settings';
import { fileFrom, makeBackup } from './helpers/backup-files';

// PLAT-05 / success criterion 4 (03-15): the (app) layout's AppNotice shows "Back up your saved
// data" once the last backup (or the first saved item) is 7+ calendar days old, on app pages only.
// It is satisfiable in one click and snoozes for 24 hours. Time is controlled with page.clock
// (local time, so calendar-day math matches the user's clock). The locked-keys variant is
// exercised in 03-16 with the Key security UI.

const SEEDED = new Date('2026-10-01T10:00:00');
const TITLE = 'Back up your saved data';
const NEVER = "You haven't backed up yet. Browsers can clear saved data, so download a copy.";

function notice(page: Page) {
	return page.getByRole('region', { name: TITLE });
}

/** Installs the clock at SEEDED and imports two prefs through the real Settings import UI. */
async function seed(page: Page): Promise<void> {
	await page.clock.install({ time: SEEDED });
	await openSettings(page);
	await page.locator('#backup-file').setInputFiles(fileFrom(makeBackup({ prefs: 2 })));
	await expect(page.getByRole('heading', { name: 'Review this backup' })).toBeVisible();
	await page.getByRole('button', { name: 'Import backup' }).click();
	await expect(page.getByTestId('import-result')).toContainText('Import complete.');
}

/** Opens a route and waits for the page to settle (the notice renders after onMount). */
async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
}

test('no notice before 7 days', async ({ page }) => {
	await seed(page);
	await page.clock.setSystemTime(new Date('2026-10-07T10:00:00'));
	await open(page, 'renter/');
	await expect(page.locator('main h1').first()).toBeVisible();
	await expect(notice(page)).toHaveCount(0);
});

test('never-backed-up notice at 8 days on every app page', async ({ page }) => {
	const csp = await cspCollector(page);
	await seed(page);
	await page.clock.setSystemTime(new Date('2026-10-09T10:00:00'));

	for (const path of ['renter/', 'investor/', 'agent/', 'settings/']) {
		await open(page, path);
		await expect(notice(page), path).toBeVisible();
		await expect(notice(page)).toContainText(NEVER);
		// Portal pages lead with the Data source status bar (04-22); Settings and the agent portal
		// (08-UI-SPEC Planner Note 4) hide it.
		const slot = path === 'settings/' || path === 'agent/' ? 1 : 2;
		await expect(page.locator(`main > :nth-child(${slot})`)).toContainText(TITLE);
		if (slot === 2) {
			await expect(page.locator('main > :first-child')).toHaveAttribute(
				'aria-label',
				'Data source'
			);
		}
		expect(await notice(page).evaluate((el) => getComputedStyle(el).position)).toBe('static');
		expect(
			await notice(page)
				.locator('..')
				.evaluate((el) => getComputedStyle(el).position)
		).toBe('static');
		expect(await csp()).toEqual([]);
	}
});

test('marketing and print pages have no notice', async ({ page }) => {
	await seed(page);
	await page.clock.setSystemTime(new Date('2026-10-09T10:00:00'));
	// Prove the reminder is due on an app page first, so the absence below is meaningful.
	await open(page, 'renter/');
	await expect(notice(page)).toBeVisible();

	for (const path of ['', 'print/']) {
		await open(page, path);
		await expect(page.locator('body')).toBeVisible();
		await expect(notice(page), path || 'home').toHaveCount(0);
		await expect(page.locator('#app-notice-title')).toHaveCount(0);
	}
});

test('N days ago after a Settings export', async ({ page }) => {
	await seed(page);
	await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download backup' }).click()
	]);
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: today');

	await page.clock.setSystemTime(new Date('2026-10-08T10:00:00'));
	await open(page, 'renter/');
	await expect(notice(page)).toContainText(
		'Your last backup was 7 days ago. Browsers can clear saved data, so download a fresh copy.'
	);
});

test('Download backup from the notice satisfies the reminder', async ({ page }) => {
	const csp = await cspCollector(page);
	await seed(page);
	await page.clock.setSystemTime(new Date('2026-10-09T10:00:00'));
	await open(page, 'renter/');
	await expect(notice(page)).toBeVisible();

	const [dl] = await Promise.all([
		page.waitForEvent('download'),
		notice(page).getByRole('button', { name: 'Download backup' }).click()
	]);
	const filename = dl.suggestedFilename();
	expect(filename).toMatch(/^tran-backup-\d{4}-\d{2}-\d{2}\.json$/);
	await expect(announcer(page)).toHaveText(`Backup downloaded: ${filename}.`);
	await expect(notice(page)).toHaveCount(0);
	expect(await csp()).toEqual([]);

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main h1').first()).toBeVisible();
	await expect(notice(page)).toHaveCount(0);
	expect(await csp()).toEqual([]);
});

test('Remind me tomorrow hides the notice for 24 hours', async ({ page }) => {
	await seed(page);
	const due = new Date('2026-10-09T10:00:00');
	await page.clock.setSystemTime(due);
	await open(page, 'renter/');
	await expect(notice(page)).toBeVisible();

	await notice(page).getByRole('button', { name: 'Remind me tomorrow' }).click();
	await expect(notice(page)).toHaveCount(0);
	await expect(announcer(page)).toHaveText('Backup reminder hidden until tomorrow.');

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main h1').first()).toBeVisible();
	await expect(notice(page)).toHaveCount(0);

	await page.clock.setSystemTime(new Date(due.getTime() + 25 * 60 * 60 * 1000));
	await page.reload();
	await expect(notice(page)).toBeVisible();
	await expect(notice(page)).toContainText(NEVER);
});
