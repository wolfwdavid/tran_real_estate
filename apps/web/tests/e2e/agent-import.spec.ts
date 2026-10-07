import { test, expect, type Page } from '@playwright/test';
import {
	addLeadByHand,
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	rentcastTripwire
} from './agent-helpers';

// Paste and CSV import on the real built site, both bases (08-20; AGT-03, AGT-07): TRAN-LEAD
// blocks in clean, collapsed and quoted form, free-form pattern leads, duplicate / update
// detection that never overwrites, CSV mapping, invalid rows, caps and encodings. Every test
// starts in a fresh browser context (empty IndexedDB) and must make zero RentCast requests.
// All inputs are built inline from fictional data (@example.com, 555-01xx).

const BLOCK = [
	'You have a new submission from your inquiry page.',
	'',
	'TRAN-LEAD v1',
	'name: Jordan Paste',
	'email: jordan.paste@example.com',
	'phone: (555) 555-0130',
	'property: 12 Sample Lane',
	'consent: yes',
	'submitted: 2026-10-04T15:04:05Z',
	'message: Could we tour Saturday?',
	'END TRAN-LEAD',
	'',
	'Sent by Web3Forms'
].join('\n');

/** The same lead with no inquiry message: nothing new, so a re-paste is a plain duplicate. */
const BLOCK_NO_MESSAGE = BLOCK.replace('message: Could we tour Saturday?', 'message: ');

const rileyBlock = (phone: string) =>
	[
		'TRAN-LEAD v1',
		'name: Riley Update',
		'email: riley.update@example.com',
		`phone: ${phone}`,
		'property: ',
		'consent: yes',
		'submitted: 2026-10-05T09:30:00Z',
		'message: Is the condo still available?',
		'END TRAN-LEAD'
	].join('\n');

const FREEFORM = 'From: "Casey Free" <casey.free@example.com>\nHi, call me at 555-555-0132';

const CSV =
	'﻿' +
	'Full Name,E-mail,Mobile,Status,Notes\r\n' +
	'"Quinn, CSV",quinn.csv@example.com,555-555-0133,Touring,"Line one\r\nline two"\r\n' +
	'No Contact,,,New,\r\n' +
	'Bad Email,not-an-email,,New,\r\n' +
	'Stage Odd,odd@example.com,,Prospect,\r\n';

const csvFile = (buffer: Buffer, name = 'contacts.csv') => ({
	name,
	mimeType: 'text/csv',
	buffer
});

const paste = (page: Page) => page.locator('#paste');
const csv = (page: Page) => page.locator('#csv');
const review = (page: Page) => page.getByTestId('import-review');
const result = (page: Page) => page.getByTestId('import-result');
const reviewHeading = (page: Page) =>
	page.getByRole('heading', { level: 3, name: 'Review before adding' });
const resultHeading = (page: Page) =>
	page.getByRole('heading', { level: 3, name: 'Import complete' });

async function openImport(page: Page) {
	await page.goto('agent/import/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Import leads' })).toBeVisible();
}

async function checkPaste(page: Page, text: string) {
	await paste(page).getByLabel('Lead email text').fill(text);
	await paste(page).getByRole('button', { name: 'Check pasted text' }).click();
}

/** Pastes, checks and adds every selected lead; waits for the result panel. */
async function importPaste(page: Page, text: string) {
	await checkPaste(page, text);
	await expect(reviewHeading(page)).toBeVisible();
	await review(page)
		.getByRole('button', { name: /^Add \d+ leads$/ })
		.click();
	await expect(resultHeading(page)).toBeVisible();
}

async function chooseCsv(page: Page, buffer: Buffer, name?: string) {
	await csv(page).getByLabel('Choose CSV file').setInputFiles(csvFile(buffer, name));
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('pasting a Web3Forms email with a TRAN-LEAD block adds the lead', async ({ page }) => {
	await openImport(page);
	await checkPaste(page, BLOCK);

	await expect(reviewHeading(page)).toBeFocused();
	await expect(announcer(page)).toHaveText(
		'Checked. 1 new, 0 updates, 0 already in contacts. Review before adding.'
	);
	await expect(review(page).getByText('New contact', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Jordan Paste', { exact: true })).toBeVisible();
	await expect(review(page).getByText('jordan.paste@example.com')).toBeVisible();
	await expect(review(page).getByRole('checkbox', { name: 'Include Jordan Paste' })).toBeChecked();
	// Paste reviews have no "Can't import" term unless there is a conflict.
	await expect(review(page).getByText("Can't import")).toHaveCount(0);

	await review(page).getByRole('button', { name: 'Add 1 leads' }).click();
	await expect(resultHeading(page)).toBeFocused();
	await expect(result(page)).toContainText('1 added, 0 updated, 0 skipped.');
	await expect(announcer(page)).toHaveText('Import complete. 1 added, 0 updated, 0 skipped.');
	await expect(review(page)).toHaveCount(0);
	// The pasted text is cleared; nothing of it is kept.
	await expect(paste(page).getByLabel('Lead email text')).toHaveValue('');
	await expect(result(page).getByRole('link', { name: 'Open your pipeline' })).toBeVisible();

	await result(page).getByRole('button', { name: 'Import more' }).click();
	await expect(result(page)).toHaveCount(0);
	await expect(paste(page).getByLabel('Lead email text')).toBeFocused();
});

test('re-pasting shows Already in contacts and adds nothing', async ({ page }) => {
	await openImport(page);
	await importPaste(page, BLOCK);
	await result(page).getByRole('button', { name: 'Import more' }).click();

	// The full email again: the contact is known, but diffLeads treats its inquiry message as
	// new information, so it is offered as an update that only logs the message (no field changes).
	await checkPaste(page, BLOCK);
	await expect(announcer(page)).toHaveText(
		'Checked. 0 new, 1 updates, 0 already in contacts. Review before adding.'
	);
	await expect(review(page).getByText('Updates Jordan Paste', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Logs the inquiry message.', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Adds ')).toHaveCount(0);

	// The same lead without a message has nothing new: Already in contacts, nothing selectable.
	await checkPaste(page, BLOCK_NO_MESSAGE);
	await expect(announcer(page)).toHaveText(
		'Checked. 0 new, 0 updates, 1 already in contacts. Review before adding.'
	);
	await expect(review(page).getByText('Already in contacts', { exact: true })).toHaveCount(2); // term + badge
	await expect(review(page).getByText('Matches Jordan Paste. Nothing new to add.')).toBeVisible();
	await expect(review(page).getByRole('checkbox')).toHaveCount(0);

	// Nothing is selectable, so the commit button explains instead of writing.
	await review(page).getByRole('button', { name: 'Add 0 leads' }).click();
	await expect(review(page).getByText('Choose at least one lead to add.')).toBeVisible();
	await expect(result(page)).toHaveCount(0);

	await review(page).getByRole('button', { name: 'Cancel' }).click();
	await expect(announcer(page)).toHaveText('Import canceled. Nothing changed.');
	await expect(review(page)).toHaveCount(0);
});

test('collapsed and quoted variants of the same block parse in the browser', async ({ page }) => {
	await openImport(page);
	await importPaste(page, BLOCK);
	await result(page).getByRole('button', { name: 'Import more' }).click();

	// Every newline collapsed to a space (HTML mail turned to text).
	await checkPaste(page, BLOCK_NO_MESSAGE.replace(/\n/g, ' '));
	await expect(review(page).getByText('Matches Jordan Paste. Nothing new to add.')).toBeVisible();

	// Forwarded: every line quoted with "> ", CRLF endings.
	const quoted = BLOCK_NO_MESSAGE.split('\n')
		.map((line) => `> ${line}`)
		.join('\r\n');
	await checkPaste(page, quoted);
	await expect(review(page).getByText('Matches Jordan Paste. Nothing new to add.')).toBeVisible();
	await expect(announcer(page)).toHaveText(
		'Checked. 0 new, 0 updates, 1 already in contacts. Review before adding.'
	);
});

test('a lead adding a phone is an update that never overwrites', async ({ page }) => {
	await addLeadByHand(page, { name: 'Riley Update', email: 'riley.update@example.com' });
	await openImport(page);

	await checkPaste(page, rileyBlock('(555) 555-0131'));
	await expect(announcer(page)).toHaveText(
		'Checked. 0 new, 1 updates, 0 already in contacts. Review before adding.'
	);
	await expect(review(page).getByText('Updates Riley Update', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Adds phone. Logs the inquiry message.')).toBeVisible();
	await expect(review(page).getByRole('checkbox', { name: 'Include Riley Update' })).toBeChecked();
	await review(page).getByRole('button', { name: 'Add 1 leads' }).click();
	await expect(result(page)).toContainText('0 added, 1 updated, 0 skipped.');
	await result(page).getByRole('button', { name: 'Import more' }).click();

	// A different phone for the same person is kept as it is, never overwritten.
	await checkPaste(page, rileyBlock('(555) 555-0199'));
	await expect(review(page).getByText('Updates Riley Update', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Logs the inquiry message.', { exact: true })).toBeVisible();
	await expect(
		review(page).getByText('Keeps phone (555) 555-0131 (pasted email has (555) 555-0199).')
	).toBeVisible();
	await expect(review(page).getByText('Adds phone')).toHaveCount(0);
});

test('free-form paste is editable and validated before adding', async ({ page }) => {
	await openImport(page);
	await checkPaste(page, FREEFORM);

	await expect(reviewHeading(page)).toBeFocused();
	await expect(
		review(page).getByText('Found by pattern. Check these details before adding.')
	).toBeVisible();
	const name = review(page).getByLabel('Name', { exact: true });
	await expect(name).toHaveValue('Casey Free');
	await expect(review(page).getByLabel('Email', { exact: true })).toHaveValue(
		'casey.free@example.com'
	);
	await expect(review(page).getByLabel('Phone', { exact: true })).toHaveValue('(555) 555-0132');

	// A blank name cannot be added: the row's own error, focus on the field, nothing written.
	await name.fill('');
	await review(page).getByRole('button', { name: 'Add 1 leads' }).click();
	await expect(review(page).getByText('Add a name.')).toBeVisible();
	await expect(name).toBeFocused();
	await expect(result(page)).toHaveCount(0);

	await name.fill('Casey Freeman');
	await review(page).getByRole('button', { name: 'Add 1 leads' }).click();
	await expect(result(page)).toContainText('1 added, 0 updated, 0 skipped.');

	// The edited name is what was saved.
	await result(page).getByRole('button', { name: 'Import more' }).click();
	await checkPaste(page, FREEFORM);
	await expect(review(page).getByText('Matches Casey Freeman. Nothing new to add.')).toBeVisible();
});

test('nothing found offers the quick-add dialog; empty text is refused', async ({ page }) => {
	await openImport(page);

	await paste(page).getByRole('button', { name: 'Check pasted text' }).click();
	await expect(paste(page).getByText('Paste an email before checking.')).toBeVisible();
	await expect(paste(page).getByLabel('Lead email text')).toBeFocused();
	await expect(paste(page).getByLabel('Lead email text')).toHaveAttribute('aria-invalid', 'true');

	await checkPaste(page, 'hello there');
	const notFound = page.getByTestId('paste-not-found');
	await expect(notFound).toBeVisible();
	await expect(notFound.getByText('No lead details found')).toBeFocused();
	await expect(review(page)).toHaveCount(0);
	await notFound.getByRole('button', { name: 'Add one lead by hand' }).click();
	await expect(page.getByRole('dialog', { name: 'Add a lead' })).toBeVisible();
});

test('CSV import maps headers, flags invalid rows and imports in one go', async ({ page }) => {
	await openImport(page);
	await chooseCsv(page, Buffer.from(CSV, 'utf8'));

	await expect(
		csv(page).getByRole('heading', { level: 3, name: 'Match your columns' })
	).toBeVisible();
	await expect(csv(page).getByText('contacts.csv: 5 columns, 4 rows.')).toBeVisible();
	await expect(csv(page).getByLabel('Import "Full Name" as')).toHaveValue('name');
	await expect(csv(page).getByLabel('Import "E-mail" as')).toHaveValue('email');
	await expect(csv(page).getByLabel('Import "Mobile" as')).toHaveValue('phone');
	await expect(csv(page).getByLabel('Import "Status" as')).toHaveValue('stage');
	await expect(csv(page).getByLabel('Import "Notes" as')).toHaveValue('notes');
	await expect(csv(page).getByText('e.g. Quinn, CSV')).toBeVisible();

	// Mapping rules are enforced before any row is read.
	await csv(page).getByLabel('Import "Full Name" as').selectOption('skip');
	await csv(page).getByRole('button', { name: 'Check file' }).click();
	await expect(
		csv(page).getByText('Match a column to Name, or to First name and Last name.')
	).toBeVisible();
	await expect(review(page)).toHaveCount(0);
	await csv(page).getByLabel('Import "Full Name" as').selectOption('name');

	await csv(page).getByRole('button', { name: 'Check file' }).click();
	await expect(reviewHeading(page)).toBeFocused();
	await expect(announcer(page)).toHaveText(
		"Checked. 2 new, 0 updates, 0 already in contacts, 2 can't be imported. Review before adding."
	);
	// 1280px wide: CSV rows render as tables inside labelled scroll regions.
	await expect(review(page).getByRole('region', { name: 'New contacts' })).toBeVisible();
	await expect(review(page).getByRole('region', { name: "Can't import" })).toBeVisible();
	await expect(review(page).getByText('Quinn, CSV', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Row 3: no email or phone')).toBeVisible();
	await expect(review(page).getByText('Row 4: email address looks incomplete')).toBeVisible();
	await expect(
		review(page).getByText('stage "Prospect" isn\'t a Tran stage, so it will start in New')
	).toBeVisible();
	await expect(review(page).getByRole('checkbox')).toHaveCount(2);

	await review(page).getByRole('button', { name: 'Import 2 contacts' }).click();
	await expect(resultHeading(page)).toBeFocused();
	await expect(result(page)).toContainText('2 added, 0 updated, 0 skipped.');
	await expect(announcer(page)).toHaveText('Import complete. 2 added, 0 updated, 0 skipped.');

	// The imported contacts are in the CRM: pasting Quinn again is a duplicate.
	await result(page).getByRole('button', { name: 'Import more' }).click();
	await expect(csv(page).getByText('Match your columns')).toHaveCount(0);
	await checkPaste(page, 'Name: Quinn Again\nquinn.csv@example.com');
	await expect(review(page).getByText('Matches Quinn, CSV. Nothing new to add.')).toBeVisible();
});

test('semicolon and windows-1252 files decode', async ({ page }) => {
	await openImport(page);
	await chooseCsv(
		page,
		Buffer.from('Name;Email\r\nJos\xE9 Example;jose@example.com\r\n', 'latin1'),
		'excel.csv'
	);
	await expect(csv(page).getByLabel('Import "Name" as')).toHaveValue('name');
	await expect(csv(page).getByLabel('Import "Email" as')).toHaveValue('email');
	await expect(csv(page).getByText('e.g. José Example')).toBeVisible();
	await csv(page).getByRole('button', { name: 'Check file' }).click();
	await expect(review(page).getByText('José Example', { exact: true })).toBeVisible();
	await expect(review(page).getByText('New contact', { exact: true })).toBeVisible();
});

test('oversized files are rejected before anything is read into rows', async ({ page }) => {
	await openImport(page);

	const rows = ['Name,Email'];
	for (let i = 1; i <= 5001; i++) rows.push(`Person ${i},person${i}@example.com`);
	await chooseCsv(page, Buffer.from(rows.join('\r\n') + '\r\n', 'utf8'), 'many.csv');
	await expect(csv(page).getByText('This file has more than 5,000 contacts')).toBeVisible();
	await expect(csv(page).getByText('Import it in parts of 5,000 rows or fewer.')).toBeVisible();
	await expect(csv(page).getByText('Match your columns')).toHaveCount(0);

	await chooseCsv(page, Buffer.alloc(5 * 1024 * 1024 + 1, 0x61), 'huge.csv');
	await expect(csv(page).getByText('This file is too large')).toBeVisible();
	await expect(
		csv(page).getByText(
			'Tran imports CSV files up to 5 MB. Split the file, or export fewer columns.'
		)
	).toBeVisible();

	// An unterminated quote is not CSV; a header-only file has no contacts.
	await chooseCsv(page, Buffer.from('Name,Email\r\n"Broken,x@example.com\r\n', 'utf8'), 'bad.csv');
	await expect(csv(page).getByText("This file can't be read as CSV")).toBeVisible();
	await chooseCsv(page, Buffer.from('Name,Email\r\n', 'utf8'), 'empty.csv');
	await expect(csv(page).getByText('This file has no contacts')).toBeVisible();
});

/**
 * A CSV that produces every review status: new (row 2), update of Riley (row 3), duplicate of
 * Jordan (row 4), invalid (row 5), same person as row 2 (row 6) and a conflict (row 7: Morgan's
 * email with Taylor's phone; both keys appear nowhere else in the file, since rows sharing a key
 * merge in-batch before classification).
 */
const EVERY_STATUS_CSV =
	'Name,Email,Phone\r\n' +
	'Avery New,avery.new@example.com,\r\n' +
	'Riley Update,riley.update@example.com,555-555-0131\r\n' +
	'Jordan Paste,jordan.paste@example.com,555-555-0130\r\n' +
	'No Contact,,\r\n' +
	'Avery Twice,avery.new@example.com,555-555-0134\r\n' +
	'Mixed Up,morgan.seed@example.com,555-555-0136\r\n';

const seedBlock = (name: string, email: string, phone: string) =>
	[
		'TRAN-LEAD v1',
		`name: ${name}`,
		`email: ${email}`,
		`phone: ${phone}`,
		'property: ',
		'consent: yes',
		'submitted: 2026-10-05T09:30:00Z',
		'message: ',
		'END TRAN-LEAD'
	].join('\n');

/** Four inquiry emails pasted together: Riley (email only), Jordan, Morgan and Taylor. */
const SEED_PASTE = [
	seedBlock('Riley Update', 'riley.update@example.com', ''),
	seedBlock('Jordan Paste', 'jordan.paste@example.com', '(555) 555-0130'),
	seedBlock('Morgan Seed', 'morgan.seed@example.com', '(555) 555-0135'),
	seedBlock('Taylor Seed', 'taylor.seed@example.com', '(555) 555-0136')
].join('\n\nSent by Web3Forms\n\n');

/** Seeds the four contacts through one multi-block paste (deterministic on this page). */
async function seedForEveryStatus(page: Page) {
	await openImport(page);
	await importPaste(page, SEED_PASTE);
	await expect(result(page)).toContainText('4 added, 0 updated, 0 skipped.');
}

async function expectEveryStatus(page: Page) {
	await expect(review(page).getByText('New contact', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Updates Riley Update', { exact: true })).toBeVisible();
	await expect(review(page).getByText('Matches Jordan Paste. Nothing new to add.')).toBeVisible();
	await expect(review(page).getByText('Row 5: no email or phone')).toBeVisible();
	await expect(review(page).getByText('Same person as row 2', { exact: true })).toBeVisible();
	await expect(
		review(page).getByText(
			'Row 7: matches Morgan Seed by email and Taylor Seed by phone, so add it by hand if needed'
		)
	).toBeVisible();
}

test('axe clean at 1280: paste reviews, CSV mapping, CSV review with every status, result', async ({
	page
}) => {
	await seedForEveryStatus(page);
	await openImport(page);
	await expectAxeClean(page, 'import page');

	await checkPaste(page, BLOCK);
	await expect(reviewHeading(page)).toBeVisible();
	await expectAxeClean(page, 'paste review (block)');
	await review(page).getByRole('button', { name: 'Cancel' }).click();

	await checkPaste(page, FREEFORM);
	await expect(reviewHeading(page)).toBeVisible();
	await expectAxeClean(page, 'paste review (free-form)');
	await review(page).getByRole('button', { name: 'Cancel' }).click();

	await checkPaste(page, 'hello there');
	await expectAxeClean(page, 'paste nothing found');

	await chooseCsv(page, Buffer.from(EVERY_STATUS_CSV, 'utf8'));
	await expect(csv(page).getByText('Match your columns')).toBeVisible();
	await expectAxeClean(page, 'CSV mapping step');

	await csv(page).getByRole('button', { name: 'Check file' }).click();
	await expect(reviewHeading(page)).toBeVisible();
	await expectEveryStatus(page);
	await expectAxeClean(page, 'CSV review with every status (table)');

	// Duplicate, same-as-row and conflict rows are never written: they count as skipped.
	await review(page).getByRole('button', { name: 'Import 2 contacts' }).click();
	await expect(result(page)).toContainText('1 added, 1 updated, 3 skipped.');
	await expectAxeClean(page, 'import result');
});

test('axe clean and no horizontal scroll at 375', async ({ page }) => {
	// Seed at the default viewport (the shared helper is tuned for it), then go narrow.
	await seedForEveryStatus(page);
	await page.setViewportSize({ width: 375, height: 812 });
	await openImport(page);
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'import page at 375px');

	await checkPaste(page, FREEFORM);
	await expect(reviewHeading(page)).toBeVisible();
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'paste review (free-form) at 375px');
	await review(page).getByRole('button', { name: 'Cancel' }).click();

	await chooseCsv(page, Buffer.from(EVERY_STATUS_CSV, 'utf8'));
	await expect(csv(page).getByText('Match your columns')).toBeVisible();
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'CSV mapping step at 375px');

	await csv(page).getByRole('button', { name: 'Check file' }).click();
	await expect(reviewHeading(page)).toBeVisible();
	await expectEveryStatus(page);
	// Narrow: rows are cards, not tables.
	await expect(review(page).getByRole('table')).toHaveCount(0);
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'CSV review with every status (cards) at 375px');

	await review(page).getByRole('button', { name: 'Import 2 contacts' }).click();
	await expect(result(page)).toContainText('1 added, 1 updated, 3 skipped.');
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'import result at 375px');
});
