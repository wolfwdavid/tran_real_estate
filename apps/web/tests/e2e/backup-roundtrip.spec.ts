import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect, rentcastCalls, RENTER_TEST_OPTIONS } from './support/network';
import { mockRentCast } from './support/rentcast-mocks';
import {
	expectLiveMode,
	expectSampleMode,
	TEST_RENTCAST_KEY,
	VAULT_SESSION_KEY,
	withRentCastKey
} from './support/seed';
import {
	BACKUP_STORES,
	expectEveryTableSeeded,
	SEEDED,
	SEEDED_COUNTS,
	seedAllBackupTables,
	type BackupStore
} from './support/seed-all';

// DEBT-05 (v1.0 audit, PLAT-04): every registered backup table survives the REAL Settings UI.
// One synthetic row per table is seeded, downloaded through "Download backup", the profile is
// wiped (database deleted, storage cleared, key gone), the file is imported through the preview,
// and every portal shows its row again. The whole run is in live mode (a real-format test key)
// with the counting RentCast mock installed, and spends exactly 0 RentCast calls. The mutation
// proof (an unseeded table, a skipped import, no key after the wipe, a deliberate spend) is in
// .planning/phases/14-carried-debt/14-05-SUMMARY.md.

test.use(RENTER_TEST_OPTIONS);

/** Registered tables and their preview labels (backup-registry.ts DEFAULT_TABLES order). */
const LABELS: Readonly<Record<BackupStore, string>> = {
	prefs: 'Settings',
	ledger: 'RentCast call history',
	savedSearches: 'Saved searches',
	searchSnapshots: 'Saved search results',
	dataPrefs: 'Data settings',
	aiArtifacts: 'AI drafts',
	renterShortlist: 'Rental shortlist',
	renterSearchMeta: 'Saved rental searches',
	deals: 'Saved deals',
	investorDraft: 'Deal analyzer draft',
	buyBoxes: 'Buy boxes',
	watchedZips: 'Watched ZIP codes',
	contacts: 'Contacts',
	tasks: 'Tasks',
	activities: 'Activity',
	agentProfile: 'Agent profile',
	studioDraft: 'Studio forms',
	snapshots: 'Market Snapshots'
};

/** support/seed.ts marks a tab as seeded with this flag so its init script does not re-seed. */
const SEEDED_FLAG = 'tran.e2e.rentcast-seeded';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Wipes this profile in place: the app database is deleted and both storages are cleared, so the
 * vault's session key is gone too. The withRentCastKey init script stays inert (its flag is set),
 * so the next page load really is keyless until addKeyNow runs.
 */
async function wipeProfile(page: Page): Promise<void> {
	await page.goto('');
	const outcome = await page.evaluate(async (flag) => {
		localStorage.clear();
		sessionStorage.clear();
		sessionStorage.setItem(flag, '1');
		return new Promise<string>((resolve, reject) => {
			let blocked = false;
			const req = indexedDB.deleteDatabase('tran');
			req.onblocked = () => (blocked = true);
			req.onsuccess = () => resolve(blocked ? 'deleted-after-block' : 'deleted');
			req.onerror = () => reject(req.error);
		});
	}, SEEDED_FLAG);
	expect(outcome).toMatch(/^deleted/);
}

/** Puts the test key back into this tab's vault session store, then reloads. */
async function addKeyNow(page: Page): Promise<void> {
	await page.evaluate(
		({ storeKey, key }) => sessionStorage.setItem(storeKey, JSON.stringify({ rentcast: key })),
		{ storeKey: VAULT_SESSION_KEY, key: TEST_RENTCAST_KEY }
	);
	await page.reload();
}

test('every backup table survives a Settings export, wipe and import, at 0 RentCast calls', async ({
	page,
	net
}, testInfo) => {
	// Timeout: measured 9.3 s for "every backup table survives a Settings export, wipe and import, at
	// 0 RentCast calls" (root, 4 workers, e2e-report 449ecc5, 2026-11-06).
	// Cause: one test seeds every backup table through the shipped UI against the RentCast mock,
	// downloads the export, wipes with confirmation, imports the file and reloads to compare each
	// table. 180 s keeps a 19.4x margin.
	test.setTimeout(180_000);
	await withRentCastKey(page);
	await mockRentCast(page, net);

	// 1. An app route opens the app database at its current version (the marketing home never
	//    opens it); the Data source bar there shows live mode. Then seed from the home page (no
	//    DataShell, so no check-on-open pass races the write).
	await page.goto('renter/');
	await expectLiveMode(page);
	await page.goto('');
	await seedAllBackupTables(page);
	expect(await expectEveryTableSeeded(page)).toEqual(SEEDED_COUNTS);
	await page.reload();

	// 2. Export through the Settings UI, still in live mode.
	await page.goto('renter/');
	await expectLiveMode(page);
	await page.goto('settings/');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download backup' }).click()
	]);
	const saved = testInfo.outputPath(download.suggestedFilename());
	await download.saveAs(saved);
	const file = JSON.parse(await readFile(saved, 'utf8')) as {
		format: string;
		tables: Record<string, unknown[]>;
	};
	expect(file.format).toBe('tran-backup-v1');
	expect(Object.keys(file.tables).sort()).toEqual([...BACKUP_STORES].sort());
	// A table registered later but not seeded here turns this red, by name.
	for (const [name, rows] of Object.entries(file.tables)) {
		expect(rows.length, name).toBeGreaterThan(0);
	}
	const memoRow = file.tables.aiArtifacts?.[0] as { meta?: Record<string, string> } | undefined;
	expect(memoRow?.meta?.notesNumbers).toBe('19');

	// 3. Wipe the profile in place (the net fixture's deny-all stays on this page).
	await wipeProfile(page);
	expect(await expectEveryTableSeeded(page)).toEqual(
		Object.fromEntries(BACKUP_STORES.map((s) => [s, 0]))
	);
	// A fresh profile: no key (sample mode) and nothing stored.
	await page.goto('renter/');
	await expectSampleMode(page);
	await addKeyNow(page);
	await expectLiveMode(page);
	await page.goto('settings/');
	await expect(page.getByText('Nothing to back up yet.', { exact: false })).toBeVisible();

	// 4. Import through the preview: every table label with its added count.
	await page.locator('#backup-file').setInputFiles(saved);
	await expect(page.getByRole('heading', { name: 'Review this backup' })).toBeVisible();
	await expect(page.getByText('Changes if you merge', { exact: true })).toBeVisible();
	for (const store of BACKUP_STORES) {
		const label = LABELS[store];
		await expect(
			page.getByRole('row', { name: new RegExp(`^${escapeRe(label)}\\s`) }).locator('th, td'),
			label
		).toHaveText([label, String(SEEDED_COUNTS[store]), '0', '0']);
	}
	const total = Object.values(SEEDED_COUNTS).reduce((a, b) => a + b, 0);
	await page.getByRole('button', { name: 'Import backup' }).click();
	await expect(page.getByTestId('import-result')).toHaveText(
		`Import complete. ${total} added, 0 updated, 0 unchanged.`
	);
	expect(await expectEveryTableSeeded(page)).toEqual(SEEDED_COUNTS);

	// 5. Every portal shows its row again.
	await page.goto('renter/shortlist/');
	await expect(page.getByText(SEEDED.shortlistStreet).first()).toBeVisible();

	await page.goto('renter/');
	await expectLiveMode(page);
	await expect(page.getByText(SEEDED.savedSearchName).first()).toBeVisible();

	await page.goto('investor/deals/');
	await expect(page.getByRole('heading', { name: SEEDED.dealName })).toBeVisible();

	await page.goto('investor/buy-boxes/');
	await expect(page.getByText(SEEDED.buyBoxName).first()).toBeVisible();

	await page.goto('investor/markets/');
	await expect(page.getByRole('heading', { name: `ZIP ${SEEDED.watchedZip}` })).toBeVisible();

	await page.goto('agent/contacts/');
	await expect(page.getByText(SEEDED.contactName).first()).toBeVisible();

	await page.goto('agent/today/');
	await expect(page.getByText(SEEDED.taskTitle).first()).toBeVisible();

	await page.goto('agent/profile/');
	await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(SEEDED.profileName);

	await page.goto('agent/studio/social/');
	await expect(page.locator('#social-brief')).toHaveValue(SEEDED.socialBrief);

	await page.goto('agent/studio/snapshot/');
	await expect(page.locator(`[data-snapshot-row="${SEEDED.snapshotId}"]`)).toContainText(
		SEEDED.snapshotTitle
	);

	await page.goto(`investor/memo/?id=${SEEDED.dealId}`);
	await expect(page.getByText(SEEDED.memoText).first()).toBeVisible();

	// The memo quotes a number found only in its notes: it prints only if the meta survived.
	await page.goto(`print/memo/?id=${SEEDED.dealId}&memo=${SEEDED.artifactId}`);
	await expect(page.locator('[data-ready]')).toBeAttached();
	await expect(page.locator('article.print-sheet').getByText(SEEDED.memoText)).toBeVisible();

	// 6. Live mode end to end, the counting mock installed, nothing spent.
	expect(rentcastCalls(net)).toBe(0);
});
