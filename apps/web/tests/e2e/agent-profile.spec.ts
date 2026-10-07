import { test, expect, type Page } from '@playwright/test';
import { expectAxeClean, expectNoHorizontalScroll, rentcastTripwire } from './agent-helpers';

// The agent profile page, details part (AGT-01, plan 08-16): the live disclosure preview against
// the core composer, save and reload through IndexedDB, validation focus, the dirty status line
// and axe at desktop and phone widths. Logo, brand colors and the share link are later plans.

const SEP = ' · ';
const TX_LINE = [
	'Example Realty',
	'Sample Agent, Real Estate Salesperson',
	'Lic. #SAMPLE-0001 (TX)',
	'(555) 555-0100'
].join(SEP);

async function open(page: Page) {
	await page.goto('agent/profile/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your profile');
	await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const lines = (page: Page) => page.getByTestId('disclosure-lines');
const status = (page: Page) => page.getByTestId('profile-status');
const save = (page: Page) => page.getByRole('button', { name: 'Save profile' }).click();

async function fillDetails(page: Page) {
	await field(page, 'Full name').fill('Sample Agent');
	await field(page, 'Brokerage').fill('Example Realty');
	await field(page, 'License type').selectOption('salesperson');
	await field(page, 'License number').fill('SAMPLE-0001');
	await field(page, 'License state').selectOption('TX');
	await field(page, 'Brokerage phone').fill('(555) 555-0100');
}

async function fillAddress(page: Page) {
	await field(page, 'Street address').fill('12 Sample Lane');
	await field(page, 'Address line 2 (optional)').fill('Suite 4');
	await field(page, 'City').fill('Austin');
	await field(page, 'State').selectOption('TX');
	await field(page, 'ZIP code').fill('78701');
}

test('saves details and shows the TX disclosure', async ({ page }) => {
	const rentcast = await rentcastTripwire(page);
	await open(page);
	// Empty profile: the preview shows what is missing with placeholders.
	await expect(lines(page)).toContainText('[Brokerage]');
	await expect(lines(page)).toContainText('[Full name]');
	await expect(page.getByText('Incomplete: add your full name and brokerage.')).toBeVisible();

	await fillDetails(page);
	await fillAddress(page);
	await expect(lines(page).locator('p').first()).toHaveText(TX_LINE);
	await expect(lines(page)).toContainText(
		'Texas Real Estate Commission Consumer Protection Notice'
	);
	await expect(page.getByText('Texas rule included.')).toBeVisible();
	await expect(page.getByText(/^Incomplete: add your/)).toHaveCount(0);

	await save(page);
	await expect(status(page)).toHaveText('Saved.');
	await expect(page.getByRole('button', { name: 'Save profile' })).toBeFocused();

	await page.reload();
	await open(page);
	await expect(field(page, 'Full name')).toHaveValue('Sample Agent');
	await expect(field(page, 'Brokerage')).toHaveValue('Example Realty');
	await expect(field(page, 'License type')).toHaveValue('salesperson');
	await expect(field(page, 'License number')).toHaveValue('SAMPLE-0001');
	await expect(field(page, 'License state')).toHaveValue('TX');
	await expect(field(page, 'Brokerage phone')).toHaveValue('(555) 555-0100');
	await expect(field(page, 'Street address')).toHaveValue('12 Sample Lane');
	await expect(field(page, 'City')).toHaveValue('Austin');
	await expect(field(page, 'State')).toHaveValue('TX');
	await expect(field(page, 'ZIP code')).toHaveValue('78701');
	await expect(lines(page).locator('p').first()).toHaveText(TX_LINE);
	await expect(status(page)).toHaveText('');
	expect(rentcast).toEqual([]);
});

test('NY shows licensed title and requires brokerage phone', async ({ page }) => {
	await open(page);
	await fillDetails(page);
	await field(page, 'License state').selectOption('NY');
	await expect(lines(page)).toContainText('Licensed Real Estate Salesperson');
	await expect(page.getByText('New York rule included.')).toBeVisible();

	await field(page, 'Brokerage phone').fill('');
	await expect(page.getByText('Incomplete: add your brokerage phone.')).toBeVisible();
	await expect(lines(page)).toContainText('[Brokerage phone]');
	await expect(lines(page).locator('p').first()).toHaveText(
		[
			'Example Realty',
			'Sample Agent, Licensed Real Estate Salesperson',
			'Lic. #SAMPLE-0001 (NY)',
			'[Brokerage phone]'
		].join(SEP)
	);

	// New York has no allowed title for "sales associate".
	await field(page, 'License type').selectOption('sales-associate');
	await expect(page.getByText(/New York doesn't allow the title/)).toBeVisible();
});

test('invalid ZIP focuses the ZIP field', async ({ page }) => {
	await open(page);
	await field(page, 'Full name').fill('Sample Agent');
	await field(page, 'ZIP code').fill('1234');
	await save(page);
	await expect(page.getByText('Enter a 5-digit ZIP code, or ZIP+4.')).toBeVisible();
	await expect(field(page, 'ZIP code')).toBeFocused();
	await expect(field(page, 'ZIP code')).toHaveAttribute('aria-invalid', 'true');
	await expect(status(page)).not.toHaveText('Saved.');

	await field(page, 'ZIP code').fill('78701-1234');
	await save(page);
	await expect(status(page)).toHaveText('Saved.');
});

test('dirty state and Enter in a text field', async ({ page }) => {
	await open(page);
	await expect(status(page)).toHaveText('');
	await field(page, 'Full name').fill('Sample Agent');
	await expect(status(page)).toHaveText('You have unsaved changes.');
	// Enter inside a text field does not submit; only the button does.
	await field(page, 'Full name').press('Enter');
	await expect(status(page)).toHaveText('You have unsaved changes.');
	await save(page);
	await expect(status(page)).toHaveText('Saved.');
	await field(page, 'Brokerage').fill('Example Realty');
	await expect(status(page)).toHaveText('You have unsaved changes.');
});

test('axe clean and no horizontal scroll at 1280 and 375', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page);
	await fillDetails(page);
	await field(page, 'ZIP code').fill('1234');
	await save(page);
	await expect(page.getByText('Enter a 5-digit ZIP code, or ZIP+4.')).toBeVisible();
	await expectAxeClean(page, 'agent/profile/ at 1280 with a field error');
	await expectNoHorizontalScroll(page);

	await page.setViewportSize({ width: 375, height: 812 });
	await expectAxeClean(page, 'agent/profile/ at 375');
	await expectNoHorizontalScroll(page);
});
