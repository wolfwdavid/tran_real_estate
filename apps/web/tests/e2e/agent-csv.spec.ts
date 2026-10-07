import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { addLeadByHand, announcer, loadSampleContacts, rentcastTripwire } from './agent-helpers';

// CSV export (08-18, AGT-07 export half) on the real built site, both bases: with only samples
// nothing downloads and the empty line is shown and announced; with a real contact the download's
// exact bytes are checked: UTF-8 BOM (EF BB BF), CRLF line endings, exactly one header row (no
// disclosure row, UI-SPEC Planner Note 6), sample contacts excluded, and a formula cell
// neutralized with a leading apostrophe. Zero RentCast requests throughout.

const EMPTY = 'There are no contacts of yours to export yet.';
const HEADER =
	'"name","email","phone","stage","source","property_of_interest","notes","consent_source","email_opt_out_at","added_at","last_contacted_at","id"';
const SAMPLE_EMAILS = [
	'jordan@example.com',
	'riley@example.com',
	'casey@example.com',
	'taylor@example.com',
	'logan@example.com'
];

const exportButton = (page: Page) => page.getByRole('button', { name: 'Export contacts (CSV)' });

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('export with only samples downloads nothing', async ({ page }) => {
	await loadSampleContacts(page);
	let downloads = 0;
	page.on('download', () => {
		downloads += 1;
	});
	await expect(exportButton(page)).toBeVisible();
	await expect(
		page.getByText(
			"Includes contact details, stage, and notes. Tasks and activity are in your Tran backup. Sample contacts aren't included."
		)
	).toBeVisible();

	await exportButton(page).click();
	await expect(page.locator('[data-csv-export-empty]')).toHaveText(EMPTY);
	await expect(announcer(page)).toHaveText(EMPTY);
	// Nothing downloads: no download event within a second of the click.
	await page.waitForTimeout(1000);
	expect(downloads).toBe(0);
});

test('export bytes are Excel-safe and injection-safe', async ({ page }) => {
	// Samples present but excluded; one real contact with a formula in its notes.
	await loadSampleContacts(page);
	await addLeadByHand(page, {
		name: 'Jordan Real',
		email: 'jordan.real@example.com',
		notes: '=HYPERLINK("http://evil.test","x")'
	});

	const [dl] = await Promise.all([page.waitForEvent('download'), exportButton(page).click()]);
	const filename = dl.suggestedFilename();
	expect(filename).toMatch(/^tran-contacts-\d{4}-\d{2}-\d{2}\.csv$/);

	const bytes = readFileSync(await dl.path());
	// UTF-8 BOM so Excel opens it as UTF-8: EF BB BF.
	expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
	const text = bytes.subarray(3).toString('utf8');
	expect(text).toContain('\r\n');
	expect(text, 'every line ending is CRLF').not.toMatch(/[^\r]\n/);
	expect(text.endsWith('\r\n')).toBe(true);

	const lines = text.split('\r\n');
	expect(lines.filter((l) => l.startsWith('"name","email"'))).toHaveLength(1);
	expect(lines[0]).toBe(HEADER);
	// Header plus one data row (the real contact), nothing else: no disclosure row, no samples.
	expect(lines.filter((l) => l !== '')).toHaveLength(2);
	expect(lines[1].startsWith('"Jordan Real","jordan.real@example.com",""')).toBe(true);
	expect(text).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
	expect(text).not.toContain(',"=HYPERLINK(');
	for (const email of SAMPLE_EMAILS) expect(text).not.toContain(email);
	expect(text).not.toContain('Sample');

	await expect(announcer(page)).toHaveText(`Downloaded ${filename}.`);
	await expect(page.locator('[data-csv-export-empty]')).toHaveCount(0);
});
