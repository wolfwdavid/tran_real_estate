import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { announcer, fakeKey, openSettings, saveKey } from './helpers/settings';
import { fileFrom, makeBackup } from './helpers/backup-files';

// The locked-keys variant of the (app) AppNotice (03-15 built it, 03-16 proves it). With
// remembered keys behind a passphrase, a newly opened tab is locked: every portal page leads with
// "Your keys are locked" and a link to Key security, which beats the backup reminder even when
// that is overdue too. Settings itself never shows the locked notice (the unlock form is there).

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PASS = ['quiet', 'harbor', 'lantern', 'seven'].join(' ');
const SEEDED = new Date('2026-10-01T10:00:00');
const OVERDUE = new Date('2026-10-09T10:00:00');
const LOCKED = 'Your keys are locked';
const BACKUP = 'Back up your saved data';

const lockedNotice = (page: Page) => page.getByRole('region', { name: LOCKED });
const backupNotice = (page: Page) => page.getByRole('region', { name: BACKUP });
const security = (page: Page) => page.locator('#key-security');

async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** Opens a route and waits for the page to settle (the notice renders after onMount). */
async function open(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main h1').first()).toBeVisible();
}

/** Seeds an import (for the reminder), remember mode, a key and a passphrase lock. */
async function setup(page: Page): Promise<void> {
	await openSettings(page);
	await page.locator('#backup-file').setInputFiles(fileFrom(makeBackup({ prefs: 2 })));
	await expect(page.getByRole('heading', { name: 'Review this backup' })).toBeVisible();
	await page.getByRole('button', { name: 'Import backup' }).click();
	await expect(page.getByTestId('import-result')).toContainText('Import complete.');

	await security(page).getByRole('radio', { name: 'Remember on this device', exact: true }).click();
	await expect(announcer(page)).toHaveText('Keys will be remembered on this device.');
	const key = fakeKey('anthropic', 'N');
	await saveKey(page, 'Anthropic', key);
	await expect(page.locator('#key-anthropic')).toContainText(`Key ending in ${key.slice(-4)}`);

	await security(page).getByRole('button', { name: 'Add a passphrase' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Passphrase', { exact: true }).fill(PASS);
	await dialog.getByLabel('Confirm passphrase', { exact: true }).fill(PASS);
	await dialog.getByRole('checkbox').check();
	await dialog.getByRole('button', { name: 'Lock keys' }).click();
	await expect(announcer(page)).toHaveText(
		'Passphrase lock added. Your remembered keys are encrypted.'
	);
	await expect(dialog).toBeHidden();
}

test('locked keys notice beats the backup reminder, links to Settings and clears on unlock', async ({
	page: setupPage,
	context
}, testInfo) => {
	// Context-wide clock so the new (locked) tab shares the seeded timeline.
	await context.clock.install({ time: SEEDED });
	await setup(setupPage);
	await context.clock.setSystemTime(OVERDUE);

	const page = await context.newPage();
	await open(page, 'renter/');
	const notice = lockedNotice(page);
	await expect(notice).toBeVisible();
	await expect(notice).toContainText(
		'Your remembered keys stay locked until you enter your passphrase.'
	);
	// Both conditions hold (locked + overdue backup); only the locked notice renders.
	await expect(backupNotice(page)).toHaveCount(0);
	await expectAxeClean(page, 'renter/ with the locked notice');

	const link = notice.getByRole('link', { name: 'Unlock in Settings' });
	const basePath = new URL(String(testInfo.project.use.baseURL)).pathname;
	await expect(link).toHaveAttribute('href', `${basePath}settings/#key-security`);

	await link.click();
	await expect(page).toHaveURL(/settings\/#key-security$/);
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	const field = security(page).getByLabel('Passphrase', { exact: true });
	await expect(field).toBeVisible();
	await expect(lockedNotice(page)).toHaveCount(0);
	await expect(page.locator('#app-notice-title')).not.toHaveText(LOCKED);

	await field.fill(PASS);
	await security(page).getByRole('button', { name: 'Unlock keys' }).click();
	await expect(announcer(page)).toHaveText('Keys unlocked.');

	await open(page, 'renter/');
	await expect(backupNotice(page)).toBeVisible();
	await expect(lockedNotice(page)).toHaveCount(0);
});

test('the locked notice shows on every portal page of a locked tab', async ({
	page: setupPage,
	context
}) => {
	await setup(setupPage);
	const page = await context.newPage();
	for (const path of ['renter/', 'investor/', 'agent/']) {
		await open(page, path);
		await expect(lockedNotice(page), path).toBeVisible();
		// The Data source status bar is the first child of <main> (04-22); the notice is second.
		// The agent portal hides the bar (08-UI-SPEC Planner Note 4), so the notice leads there.
		if (path === 'agent/') {
			await expect(page.locator('main > :first-child')).toContainText(LOCKED);
		} else {
			await expect(page.locator('main > :first-child')).toHaveAttribute(
				'aria-label',
				'Data source'
			);
			await expect(page.locator('main > :nth-child(2)')).toContainText(LOCKED);
		}
	}
});
