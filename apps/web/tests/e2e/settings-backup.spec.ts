import { readFile, writeFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { announcer, fakeKey, FAKE_PROVIDERS, openSettings } from './helpers/settings';
import { fileFrom, makeBackup, type FilePayload } from './helpers/backup-files';
import { KEY_SHAPES } from '../../../../packages/core/src/backup/key-scan';

// PLAT-04 / success criterion 3 (03-13): a backup never carries keys (even with all five saved),
// round-trips into a fresh browser profile after a previewed Merge or confirmed Replace, and bad
// files are rejected in plain language with nothing imported.

const PLANTED = Object.fromEntries(FAKE_PROVIDERS.map((p) => [p, fakeKey(p, 'Q')]));
const FILE_NAME = 'tran-backup-2026-10-04.json';

/** Seeds a session key for every provider before the first navigation (no API keys UI needed). */
async function seedAllKeys(page: Page): Promise<void> {
	await page.addInitScript((keys) => {
		sessionStorage.setItem('tran.vault.session.v1', JSON.stringify(keys));
	}, PLANTED);
}

async function chooseFile(page: Page, file: FilePayload): Promise<void> {
	await page.locator('#backup-file').setInputFiles(file);
}

/** Chooses a file and imports it with the default Merge mode. */
async function mergeImport(page: Page, file: FilePayload): Promise<void> {
	await chooseFile(page, file);
	await expect(page.getByRole('heading', { name: 'Review this backup' })).toBeVisible();
	await page.getByRole('button', { name: 'Import backup' }).click();
	await expect(page.getByTestId('import-result')).toContainText('Import complete.');
}

/** Clicks Download backup and returns the suggested filename and the file text. */
async function downloadBackup(page: Page): Promise<{ filename: string; text: string }> {
	const [dl] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download backup' }).click()
	]);
	const path = await dl.path();
	return { filename: dl.suggestedFilename(), text: await readFile(path, 'utf8') };
}

test('export is key-free with all five keys saved', async ({ page }) => {
	await seedAllKeys(page);
	await openSettings(page);
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: Never');
	await mergeImport(page, fileFrom(makeBackup({ prefs: 3 })));

	const { filename, text } = await downloadBackup(page);
	expect(filename).toMatch(/^tran-backup-\d{4}-\d{2}-\d{2}\.json$/);
	const parsed = JSON.parse(text) as { format: string; tables: { prefs: unknown[] } };
	expect(parsed.format).toBe('tran-backup-v1');
	expect(parsed.tables.prefs.length).toBe(3);
	for (const key of Object.values(PLANTED)) expect(text).not.toContain(key);
	for (const { re } of KEY_SHAPES) expect(re.test(text)).toBe(false);

	await expect(announcer(page)).toHaveText(`Backup downloaded: ${filename}.`);
	// The live() helper updates the line without a reload.
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: today');
});

test('fresh-profile import with preview', async ({ page, browser }, testInfo) => {
	await seedAllKeys(page);
	await openSettings(page);
	await mergeImport(page, fileFrom(makeBackup({ prefs: 3 })));
	const { filename, text } = await downloadBackup(page);
	const saved = testInfo.outputPath(filename);
	await writeFile(saved, text);

	const fresh = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
	try {
		const p2 = await fresh.newPage();
		await openSettings(p2);
		await p2.locator('#backup-file').setInputFiles(saved);
		const heading = p2.getByRole('heading', { name: 'Review this backup' });
		await expect(heading).toBeFocused();
		await expect(announcer(p2)).toHaveText('Backup checked. Review the changes before importing.');
		await expect(p2.getByText('Changes if you merge', { exact: true })).toBeVisible();
		await expect(p2.getByRole('row', { name: /^Settings/ }).locator('th, td')).toHaveText([
			'Settings',
			'3',
			'0',
			'0'
		]);
		await expect(p2.getByRole('row', { name: /^Total/ }).locator('th, td')).toHaveText([
			'Total',
			'3',
			'0',
			'0'
		]);
		await p2.getByRole('button', { name: 'Import backup' }).click();
		await expect(p2.getByTestId('import-result')).toHaveText(
			'Import complete. 3 added, 0 updated, 0 unchanged.'
		);
		await expect(p2.getByTestId('import-result')).toBeFocused();

		// The same file again: nothing would change, so only Close is offered.
		await p2.locator('#backup-file').setInputFiles(saved);
		await expect(
			p2.getByText(
				"This backup matches what's already in this browser. Importing it wouldn't change anything."
			)
		).toBeVisible();
		const preview = p2.getByTestId('import-preview');
		await expect(preview.getByRole('button')).toHaveText(['Close']);
		await p2.getByRole('button', { name: 'Close' }).click();
		await expect(preview).toHaveCount(0);
	} finally {
		await fresh.close();
	}
});

test('replace path with confirmation', async ({ page }) => {
	await openSettings(page);
	await mergeImport(page, fileFrom(makeBackup({ prefs: 3 })));

	await chooseFile(page, fileFrom(makeBackup({ prefs: 2, idOffset: 100 })));
	await page.getByLabel('Replace', { exact: true }).click();
	await expect(page.getByText('Changes if you replace', { exact: true })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Delete from this browser' })).toBeVisible();
	await expect(page.getByRole('row', { name: /^Settings/ }).locator('th, td')).toHaveText([
		'Settings',
		'3',
		'2'
	]);

	const trigger = page.getByRole('button', { name: 'Replace all data…' });
	await trigger.click();
	const dialog = page.getByRole('alertdialog', { name: 'Replace all data in this browser?' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('the 3 items');
	await expect(dialog).toContainText(`the 2 items in ${FILE_NAME}`);
	await expect(dialog.getByRole('button', { name: 'Keep my data' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(page.getByTestId('import-preview')).toBeVisible();

	await trigger.click();
	await dialog.getByRole('button', { name: 'Replace all data', exact: true }).click();
	await expect(page.getByTestId('import-result')).toHaveText(
		`Import complete. This browser now holds the 2 items from ${FILE_NAME}.`
	);
	await expect(announcer(page)).toHaveText(
		`Import complete. This browser now holds the 2 items from ${FILE_NAME}.`
	);
});

test('cancel closes the preview and changes nothing', async ({ page }) => {
	await openSettings(page);
	await chooseFile(page, fileFrom(makeBackup({ prefs: 2 })));
	await expect(page.getByTestId('import-preview')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(announcer(page)).toHaveText('Import canceled. Nothing changed.');
	await expect(page.getByTestId('import-preview')).toHaveCount(0);
	await expect(page.getByText('Nothing to back up yet.', { exact: false })).toBeVisible();
});

test('wrong files are rejected and the input resets', async ({ page }) => {
	test.setTimeout(90_000);
	await openSettings(page);
	const input = page.locator('#backup-file');
	const cases: [FilePayload, string][] = [
		[fileFrom('{', 'x.json'), "This isn't a Tran backup"],
		[fileFrom('{"format":"x"}', 'x.json'), "This isn't a Tran backup"],
		[
			fileFrom(makeBackup({ prefs: 1, schemaVersion: 99 })),
			'This backup is from a newer version of Tran'
		],
		[fileFrom(makeBackup({ prefs: 1, ownerId: 'remote' })), "This backup can't be read"],
		[fileFrom(Buffer.alloc(26 * 1024 * 1024, 32), 'big.json'), 'This file is too large']
	];
	for (const [file, title] of cases) {
		for (let attempt = 0; attempt < 2; attempt++) {
			await input.setInputFiles(file);
			await expect(page.getByText(title, { exact: true })).toBeVisible();
			await expect(announcer(page)).toContainText(title);
			await expect(input).toHaveValue('');
		}
		await expect(page.getByTestId('import-preview')).toHaveCount(0);
	}
	await expect(page.getByText('Nothing to back up yet.', { exact: false })).toBeVisible();
});

// The "older backup" migration line cannot be reached on the built site yet: BACKUP_SCHEMA_VERSION
// is 1, so no older backup file exists. The line itself is proven by an SSR test
// (apps/web/src/lib/features/shared/settings/import-preview.test.ts) and the migration steps by
// packages/core/src/backup/migrations.test.ts, which fails if the version is bumped without a
// migrations[n] step. Add an E2E here with the version-2 schema, importing a real version-1 file.

test('export refuses a key-bearing pref', async ({ page }) => {
	await openSettings(page);
	await mergeImport(page, fileFrom(makeBackup({ prefs: 1, firstValue: fakeKey('anthropic') })));
	await page.getByRole('button', { name: 'Download backup' }).click();
	await expect(page.waitForEvent('download', { timeout: 2000 })).rejects.toThrow();
	await expect(page.getByText('Backup stopped', { exact: true })).toBeVisible();
	await expect(page.getByTestId('last-backup')).toHaveText('Last backup: Never');
});
