import { test, expect, type Page } from '@playwright/test';
import { AGENT_ROUTES } from './routes';
import {
	addLeadByHand,
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// The CRM's entry points (08-15; AGT-03, success criterion 5) on the real built site, both bases:
// the empty state, the keyless sample contacts (load, notice on every agent page, remove, undo),
// and Add a lead with validation and duplicate detection. Every test starts in a fresh browser
// context (empty IndexedDB) and must make zero RentCast requests.

const sampleRegion = (page: Page) => page.getByRole('region', { name: 'Sample contacts' });
const addDialog = (page: Page) => page.getByRole('dialog', { name: 'Add a lead' });
const duplicateAlert = (page: Page) => addDialog(page).locator('[data-duplicate-alert]');

/** The agent pages the notice must appear on: the home plus every sub-page except the ?id= shell. */
const NOTICE_ROUTES = ['agent/', ...AGENT_ROUTES.filter((r) => r !== 'agent/contact/')];

async function openContacts(page: Page) {
	await page.goto('agent/contacts/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
}

async function openAddDialog(page: Page) {
	await page.getByRole('button', { name: 'Add a lead' }).first().click();
	await expect(addDialog(page)).toBeVisible();
	return addDialog(page);
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('empty CRM shows the empty state with three actions', async ({ page, baseURL }) => {
	await openContacts(page);
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toBeVisible();
	await expect(
		page.getByText(
			'Add your first lead, import a list, or load sample contacts to see how the pipeline works. Everything stays in this browser.'
		)
	).toBeVisible();
	// The toolbar has an outline Add a lead; the empty state adds the primary one.
	await expect(page.getByRole('button', { name: 'Add a lead' })).toHaveCount(2);
	const importLink = page.getByRole('link', { name: 'Import leads' });
	await expect(importLink).toBeVisible();
	expect(await importLink.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
		new URL('agent/import/', baseURL).href
	);
	await expect(page.getByRole('button', { name: 'Load sample contacts' })).toBeVisible();
	await expect(sampleRegion(page)).toHaveCount(0);
	await expect(page.getByText('Loading your contacts')).toHaveCount(0);
});

test('load sample contacts, see the notice everywhere, remove and undo', async ({ page }) => {
	await loadSampleContacts(page);
	await expect(announcer(page)).toHaveText('Loaded 12 sample contacts.');
	await expect(sampleRegion(page)).toContainText(
		"Sample contacts are mixed in with yours. They're made up, and each one is marked Sample data."
	);
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toHaveCount(0);

	for (const route of NOTICE_ROUTES) {
		await page.goto(route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(sampleRegion(page), `Sample contacts notice on ${route}`).toBeVisible();
		await expect(
			sampleRegion(page).getByRole('button', { name: 'Remove sample contacts' })
		).toBeVisible();
	}

	await openContacts(page);
	await sampleRegion(page).getByRole('button', { name: 'Remove sample contacts' }).click();
	await expect(announcer(page)).toHaveText('Removed 12 sample contacts.');
	await expect(sampleRegion(page)).toHaveCount(0);
	const undoLine = page.locator('[data-undo-status]');
	await expect(undoLine).toContainText('Removed 12 sample contacts.');
	const undo = undoLine.getByRole('button', { name: 'Undo' });
	await expect(undo).toBeVisible();
	// With every sample gone the CRM is empty again.
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toBeVisible();

	await undo.click();
	await expect(announcer(page)).toHaveText('Sample contacts restored.');
	await expect(sampleRegion(page)).toBeVisible();
	await expect(undoLine).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toHaveCount(0);

	// Loading is idempotent: the samples survive a reload and a second load changes nothing.
	await page.reload();
	await expect(sampleRegion(page)).toBeVisible();
});

test('quick add validates, adds, and blocks duplicates', async ({ page, baseURL }) => {
	await openContacts(page);
	let dialog = await openAddDialog(page);
	await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
	await expect(dialog.getByText('Add an email, a phone number, or both.')).toBeVisible();

	// Empty submit: both errors, focus on the first invalid field, nothing saved.
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(dialog.getByText('Add a name.')).toBeVisible();
	await expect(dialog.getByText('Add an email or a phone number.')).toBeVisible();
	await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
	await expect(dialog.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
	await expect(dialog.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true');

	// Incomplete email and short phone each get their own message.
	await dialog.getByLabel('Name', { exact: true }).fill('Avery Example');
	await dialog.getByLabel('Email', { exact: true }).fill('avery@example');
	await dialog.getByLabel('Phone', { exact: true }).fill('555-0120');
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(
		dialog.getByText('This email address looks incomplete. Check it, like name@example.com.')
	).toBeVisible();
	await expect(dialog.getByText('Enter a phone number with area code.')).toBeVisible();
	await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused();

	// A valid lead saves, closes the dialog, announces, and moves focus to the new contact's link
	// in the list (08-18; the h1 is the fallback when the current filter hides the contact).
	await dialog.getByLabel('Email', { exact: true }).fill('avery.example@example.com');
	await dialog.getByLabel('Phone', { exact: true }).fill('');
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(announcer(page)).toHaveText('Added Avery Example to New.');
	await expect(addDialog(page)).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Avery Example' })).toBeFocused();
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toHaveCount(0);

	// Same email, different case and trailing space: blocked until the agent chooses.
	dialog = await openAddDialog(page);
	await dialog.getByLabel('Name', { exact: true }).fill('Different Person');
	await dialog.getByLabel('Email', { exact: true }).fill('AVERY.EXAMPLE@example.com ');
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(announcer(page)).toHaveText('Avery Example is already in your contacts.');
	const alert = duplicateAlert(page);
	await expect(alert).toBeVisible();
	await expect(alert).toContainText('Avery Example is already in your contacts');
	await expect(alert).toContainText('Same email address.');
	const alertTitle = alert.locator('[tabindex="-1"]');
	await expect(alertTitle).toHaveText('Avery Example is already in your contacts');
	await expect(alertTitle).toBeFocused();
	const openLink = alert.getByRole('link', { name: 'Open Avery' });
	await expect(openLink).toBeVisible();
	const href = await openLink.getAttribute('href');
	expect(href).toContain('agent/contact/?id=');
	expect(href?.startsWith(new URL('agent/contact/', baseURL).pathname)).toBe(true);
	await expect(addDialog(page)).toBeVisible();

	// Add as a separate contact saves anyway.
	await alert.getByRole('button', { name: 'Add as a separate contact' }).click();
	await expect(announcer(page)).toHaveText('Added Different Person to New.');
	await expect(addDialog(page)).toHaveCount(0);

	// Same phone in a different format, into a chosen stage.
	await addLeadByHand(page, { name: 'Blake Example', phone: '(555) 555-0120', stage: 'Touring' });
	dialog = await openAddDialog(page);
	await dialog.getByLabel('Name', { exact: true }).fill('Casey Example');
	await dialog.getByLabel('Phone', { exact: true }).fill('555.555.0120');
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(duplicateAlert(page)).toContainText('Blake Example is already in your contacts');
	await expect(duplicateAlert(page)).toContainText('Same phone number.');
	await expect(duplicateAlert(page).getByRole('link', { name: 'Open Blake' })).toBeVisible();

	// Cancel saves nothing and returns focus to the trigger.
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(addDialog(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Add a lead' }).first()).toBeFocused();
});

test('axe clean: empty state, dialog open, duplicate alert, notice', async ({ page }) => {
	await openContacts(page);
	await expectAxeClean(page, 'CRM empty state');

	let dialog = await openAddDialog(page);
	await expectAxeClean(page, 'Add a lead dialog');
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	// Samples must be loaded while the CRM is still empty (the button lives in the empty state).
	await loadSampleContacts(page);
	await expectAxeClean(page, 'Sample contacts notice');

	await addLeadByHand(page, { name: 'Avery Example', email: 'avery.example@example.com' });
	dialog = await openAddDialog(page);
	await dialog.getByLabel('Name', { exact: true }).fill('Different Person');
	await dialog.getByLabel('Email', { exact: true }).fill('avery.example@example.com');
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(duplicateAlert(page)).toBeVisible();
	await expectAxeClean(page, 'duplicate alert');
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	await page.setViewportSize({ width: 375, height: 812 });
	await openContacts(page);
	await expect(sampleRegion(page)).toBeVisible();
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'contacts with the notice at 375px');
	dialog = await openAddDialog(page);
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'Add a lead dialog at 375px');
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	await sampleRegion(page).getByRole('button', { name: 'Remove sample contacts' }).click();
	await expect(announcer(page)).toHaveText('Removed 12 sample contacts.');
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'empty state with the Undo line at 375px');
});
