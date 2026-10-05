import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { announcer, fakeKey, openSettings, saveKey } from './helpers/settings';
import { fileFrom, makeBackup } from './helpers/backup-files';

// Settings accessibility contract (03-16, UI-SPEC "Accessibility Contract" + "Focus management"):
// axe over every Settings state and over a portal page showing the backup notice, on both bases.
// Exactly the Phase 1 WCAG 2.0/2.1/2.2 A/AA tag set with the non-vacuity guard. One test per state
// so a failure names it. Also: dialog overlays actually paint (RESEARCH Pitfall 4: the --color-*
// reset could make an overlay silently transparent), focus placement inside and after dialogs,
// and no horizontal page scroll at 375px.

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	// An empty violations list is only meaningful if axe evaluated rules against real content.
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

const PASS = ['quiet', 'harbor', 'lantern', 'seven'].join(' ');
const WRONG = ['wrong', 'guess', 'every', 'time'].join(' ');

const security = (page: Page) => page.locator('#key-security');
const card = (page: Page, id: string) => page.locator(`#key-${id}`);

/** The overlay elements bits-ui renders through our shadcn wrappers (data-slot is ours). */
const OVERLAY = '[data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]';

async function saveAndWait(page: Page, label: string, id: string, key: string): Promise<void> {
	await saveKey(page, label, key);
	await expect(card(page, id)).toContainText(`Key ending in ${key.slice(-4)}`);
}

async function chooseRemember(page: Page): Promise<void> {
	await security(page).getByRole('radio', { name: 'Remember on this device', exact: true }).click();
	await expect(announcer(page)).toHaveText('Keys will be remembered on this device.');
}

/** Remember mode + one key + a passphrase lock, all on `page`. */
async function lockedSetup(page: Page): Promise<void> {
	await openSettings(page);
	await chooseRemember(page);
	await saveAndWait(page, 'Anthropic', 'anthropic', fakeKey('anthropic', 'A'));
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

/** Opens a backup through the real import UI; returns the preview panel. */
async function openPreview(page: Page): Promise<Locator> {
	await page.locator('#backup-file').setInputFiles(fileFrom(makeBackup({ prefs: 2 })));
	const heading = page.getByRole('heading', { name: 'Review this backup' });
	await expect(heading).toBeVisible();
	return page.getByTestId('import-preview');
}

async function chooseReplace(page: Page): Promise<void> {
	await page.getByRole('radio', { name: 'Replace', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Changes if you replace' })).toBeVisible();
}

async function focusInsideDialog(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const d = document.querySelector('[role="dialog"], [role="alertdialog"]');
		return !!d && d.contains(document.activeElement);
	});
}

async function expectOverlayPaints(page: Page, label: string): Promise<void> {
	const overlay = page.locator(OVERLAY);
	await expect(overlay, `${label} overlay`).toHaveCount(1);
	const bg = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
	expect(bg, `${label} overlay background`).not.toBe('rgba(0, 0, 0, 0)');
	expect(bg, `${label} overlay background`).not.toBe('transparent');
}

async function expectNoPageScrollAt375(page: Page, label: string): Promise<void> {
	const width = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(width, `page scrollWidth on ${label}`).toBeLessThanOrEqual(375);
}

/** The import table wrapper scrolls internally and is keyboard focusable. */
async function expectTableWrapperScrollable(page: Page, name: string): Promise<void> {
	const wrapper = page.getByRole('region', { name });
	await expect(wrapper).toHaveAttribute('tabindex', '0');
	const { scrollWidth, clientWidth } = await wrapper.evaluate((el) => ({
		scrollWidth: el.scrollWidth,
		clientWidth: el.clientWidth
	}));
	expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
	await wrapper.focus();
	await expect(wrapper).toBeFocused();
}

test('1. empty Settings (no keys) is axe clean', async ({ page }) => {
	await openSettings(page);
	await expect(card(page, 'anthropic').getByText('Not added', { exact: true })).toBeVisible();
	await expectAxeClean(page, 'Settings empty');
});

test('2. keys saved (session mode) is axe clean and never scrolls at 375px', async ({ page }) => {
	await openSettings(page);
	await saveAndWait(page, 'Anthropic', 'anthropic', fakeKey('anthropic', 'K'));
	await saveAndWait(page, 'RentCast', 'rentcast', fakeKey('rentcast', 'K'));
	await expectAxeClean(page, 'Settings with keys saved');

	await page.setViewportSize({ width: 375, height: 800 });
	await expectNoPageScrollAt375(page, 'keys saved');
	await expectAxeClean(page, 'Settings with keys saved at 375px');
});

test('3. remember mode with a locked vault is axe clean', async ({ page, context }) => {
	await lockedSetup(page);
	const reopened = await context.newPage();
	await openSettings(reopened);
	await expect(security(reopened).getByRole('button', { name: 'Unlock keys' })).toBeVisible();
	await expect(card(reopened, 'anthropic').getByText('Locked', { exact: true })).toBeVisible();
	await expectAxeClean(reopened, 'Settings locked vault');
});

test('4. import preview in Merge is axe clean, focused and fits 375px', async ({ page }) => {
	await openSettings(page);
	await openPreview(page);
	// Focus management: after choosing a file the preview heading takes focus.
	await expect(page.getByRole('heading', { name: 'Review this backup' })).toBeFocused();
	await expect(page.getByRole('region', { name: 'Changes if you merge' })).toBeVisible();
	await expectAxeClean(page, 'import preview (Merge)');

	await page.setViewportSize({ width: 375, height: 800 });
	await expectNoPageScrollAt375(page, 'import preview (Merge)');
	await expectTableWrapperScrollable(page, 'Changes if you merge');
});

test('5. import preview in Replace is axe clean and fits 375px', async ({ page }) => {
	await openSettings(page);
	await openPreview(page);
	await chooseReplace(page);
	await expectAxeClean(page, 'import preview (Replace)');

	await page.setViewportSize({ width: 375, height: 800 });
	await expectNoPageScrollAt375(page, 'import preview (Replace)');
	await expectTableWrapperScrollable(page, 'Changes if you replace');
});

test('6. Forget all keys dialog: axe, focus, overlay paint, Escape and confirm focus', async ({
	page
}) => {
	await openSettings(page);
	await saveAndWait(page, 'OpenAI', 'openai', fakeKey('openai', 'F'));
	const trigger = page
		.locator('#api-keys')
		.getByRole('button', { name: 'Forget all keys', exact: true });
	await trigger.click();
	const dialog = page.getByRole('alertdialog', { name: 'Forget all API keys?' });
	await expect(dialog).toBeVisible();
	expect(await focusInsideDialog(page)).toBe(true);
	await expect(dialog.getByRole('button', { name: 'Keep my keys', exact: true })).toBeFocused();
	await expectOverlayPaints(page, 'Forget all');
	await expectAxeClean(page, 'Forget all keys dialog');

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();

	// Confirmed forget: focus lands on the API keys heading.
	await trigger.click();
	await dialog.getByRole('button', { name: 'Forget all keys', exact: true }).click();
	await expect(announcer(page)).toHaveText('All API keys forgotten.');
	await expect(dialog).toBeHidden();
	await expect(page.locator('#api-keys-heading')).toBeFocused();
});

test('7. Replace all data dialog: axe, focus, overlay paint and Escape', async ({ page }) => {
	await openSettings(page);
	await openPreview(page);
	await chooseReplace(page);
	const trigger = page.getByRole('button', { name: 'Replace all data…' });
	await trigger.click();
	const dialog = page.getByRole('alertdialog', { name: 'Replace all data in this browser?' });
	await expect(dialog).toBeVisible();
	expect(await focusInsideDialog(page)).toBe(true);
	await expect(dialog.getByRole('button', { name: 'Keep my data', exact: true })).toBeFocused();
	await expectOverlayPaints(page, 'Replace all data');
	await expectAxeClean(page, 'Replace all data dialog');

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('8. Add a passphrase dialog with a field error: axe, focus, overlay paint and Escape', async ({
	page
}) => {
	await openSettings(page);
	await chooseRemember(page);
	const trigger = security(page).getByRole('button', { name: 'Add a passphrase' });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Lock your remembered keys' });
	await expect(dialog).toBeVisible();
	expect(await focusInsideDialog(page)).toBe(true);
	await expectOverlayPaints(page, 'Passphrase');

	await dialog.getByRole('button', { name: 'Lock keys' }).click();
	await expect(dialog.getByText('Use at least 12 characters.')).toBeVisible();
	await expect(dialog.getByLabel('Passphrase', { exact: true })).toBeFocused();
	await expectAxeClean(page, 'Add a passphrase dialog with errors');

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('9. Change passphrase dialog: axe, focus and Escape', async ({ page }) => {
	await lockedSetup(page);
	const trigger = security(page).getByRole('button', { name: 'Change passphrase' });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Change your passphrase' });
	await expect(dialog).toBeVisible();
	expect(await focusInsideDialog(page)).toBe(true);
	await expect(dialog.getByLabel('Current passphrase', { exact: true })).toBeFocused();
	await expectOverlayPaints(page, 'Change passphrase');
	await expectAxeClean(page, 'Change passphrase dialog');

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('10. cooldown countdown is axe clean', async ({ page: setupPage, context }) => {
	await lockedSetup(setupPage);
	const page = await context.newPage();
	await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
	await openSettings(page);
	const field = security(page).getByLabel('Passphrase', { exact: true });
	for (let i = 0; i < 5; i++) {
		await field.fill(WRONG);
		await security(page).getByRole('button', { name: 'Unlock keys' }).click();
		await expect(security(page).getByRole('button', { name: 'Unlocking…' })).toHaveCount(0);
	}
	await expect(
		security(page).getByText(/Too many attempts\. You can try again in \d+ seconds\./)
	).toBeVisible();
	await expect(field).toBeDisabled();
	await expectAxeClean(page, 'cooldown countdown');
});

test('11. a portal page showing the backup notice is axe clean', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-10-01T10:00:00') });
	await openSettings(page);
	await openPreview(page);
	await page.getByRole('button', { name: 'Import backup' }).click();
	await expect(page.getByTestId('import-result')).toContainText('Import complete.');

	await page.clock.setSystemTime(new Date('2026-10-09T10:00:00'));
	await page.goto('renter/');
	await expect(page.getByRole('region', { name: 'Back up your saved data' })).toBeVisible();
	await expectAxeClean(page, 'renter/ with the backup notice');
});
