import { test, expect, type Page } from '@playwright/test';
import {
	addLeadByHand,
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// The Contacts list (08-18) on the real built site, both bases: the sample contacts newest first
// with their chips (table at 1280, cards at 375), in-memory search by name / email / phone digits
// mirrored into ?q=, the smart lists with their counts, announcement and ?list=, the two no-match
// states, deep links, and axe at both widths. Zero RentCast requests throughout.
//
// Sample fixture facts the assertions rely on (features/agent/fixtures/sample-contacts.ts):
// created 1d Jordan, 2d Morgan, 3d Riley, 9d Casey, 12d Taylor, 15d Harper, 20d Quinn, 25d Drew,
// 30d Sydney, 40d Rowan, 45d Emerson (opted out), 60d Logan (Closed). Open tasks: Riley -2d,
// Quinn -1d, Jordan / Drew / Rowan today, then four upcoming. Last contact: Taylor 2d, Quinn 10d,
// Harper 8d, Drew 1d, Sydney 4d, Rowan 3d, Emerson 6d, Logan 14d; the rest never.

const table = (page: Page) => page.locator('[data-contacts-table]');
const rows = (page: Page) => table(page).locator('tbody tr');
const cards = (page: Page) => page.locator('[data-contacts-view] ul li');
const search = (page: Page) => page.getByLabel('Search contacts');
const listButton = (page: Page, name: string | RegExp) =>
	page.getByRole('group', { name: 'Show' }).getByRole('button', { name });

const NEWEST_FIRST = [
	'Jordan Example',
	'Morgan Demo',
	'Riley Sample',
	'Casey Placeholder',
	'Taylor Mockridge',
	'Harper Fixture',
	'Quinn Sampleton',
	'Drew Exampleton',
	'Sydney Testa',
	'Rowan Specimen',
	'Emerson Draft',
	'Logan Pilot'
];

async function expectRowNames(page: Page, names: string[]) {
	await expect(rows(page)).toHaveCount(names.length);
	for (const name of names) await expect(rows(page).filter({ hasText: name })).toHaveCount(1);
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('samples list newest first with chips', async ({ page }) => {
	await loadSampleContacts(page);
	await expect(page.getByText('Loading your contacts')).toHaveCount(0);

	// 1280: the table inside its labelled, focusable scroll region.
	await expect(table(page).locator('caption')).toHaveText('12 contacts');
	await expect(page.getByRole('region', { name: '12 contacts' })).toHaveAttribute('tabindex', '0');
	await expect(table(page).getByRole('columnheader')).toHaveText([
		'Name',
		'Stage',
		'Next task',
		'Last contact',
		'Added'
	]);
	await expect(rows(page)).toHaveCount(12);
	for (let i = 0; i < NEWEST_FIRST.length; i += 1) {
		await expect(rows(page).nth(i)).toContainText(NEWEST_FIRST[i]);
		await expect(rows(page).nth(i)).toContainText('Sample data');
	}
	const jordan = rows(page).first();
	await expect(jordan).toContainText('New');
	await expect(jordan).toContainText('Due today');
	await expect(jordan).toContainText('Never');
	const morgan = rows(page).nth(1);
	await expect(morgan).toContainText('None');
	await expect(rows(page).nth(2)).toContainText('Overdue');
	await expect(rows(page).nth(4)).toContainText('2 days ago');
	await expect(rows(page).last()).toContainText('Closed');
	// Name cells link to the contact detail by id.
	expect(await jordan.getByRole('link').getAttribute('href')).toMatch(/agent\/contact\/\?id=/);
	await expect(page.getByRole('button', { name: 'Show more contacts' })).toHaveCount(0);

	// 375: the same list as cards.
	await page.setViewportSize({ width: 375, height: 812 });
	await expect(table(page)).toHaveCount(0);
	await expect(page.getByText('12 contacts')).toBeVisible();
	await expect(cards(page)).toHaveCount(12);
	await expect(cards(page).first()).toContainText('Jordan Example');
	const emerson = cards(page).filter({ hasText: 'Emerson Draft' });
	await expect(emerson).toContainText('No emails');
	await expect(emerson).toContainText('Sample data');
	await expect(emerson).toContainText('Last contact 6 days ago');
});

test('search by name, email and phone digits', async ({ page }) => {
	await loadSampleContacts(page);

	await search(page).fill('riley');
	await expectRowNames(page, ['Riley Sample']);
	await expect(table(page).locator('caption')).toHaveText('1 contact');

	await search(page).fill('harper@');
	await expectRowNames(page, ['Harper Fixture']);

	await search(page).fill('0105');
	await expectRowNames(page, ['Taylor Mockridge']);
	await expect(page).toHaveURL(/\/agent\/contacts\/\?q=0105$/);

	// Reload keeps the search (read from ?q= on mount).
	await page.reload();
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(search(page)).toHaveValue('0105');
	await expectRowNames(page, ['Taylor Mockridge']);

	await search(page).fill('');
	await expect(rows(page)).toHaveCount(12);
	await expect(page).toHaveURL(/\/agent\/contacts\/$/);
});

test('smart lists filter and announce', async ({ page }) => {
	await loadSampleContacts(page);
	await expect(listButton(page, 'All (12)')).toHaveAttribute('aria-pressed', 'true');

	// Due today = open task due today or overdue: 2 overdue + 3 due today contacts.
	await listButton(page, 'Due today (5)').click();
	await expectRowNames(page, [
		'Jordan Example',
		'Riley Sample',
		'Quinn Sampleton',
		'Drew Exampleton',
		'Rowan Specimen'
	]);
	await expect(announcer(page)).toHaveText('Showing Due today: 5 contacts.');
	await expect(page).toHaveURL(/\?list=due-today$/);
	await expect(listButton(page, 'Due today (5)')).toHaveAttribute('aria-pressed', 'true');

	// New this week: created in the last 7 days (Jordan 1d, Morgan 2d, Riley 3d; Casey is 9d).
	await listButton(page, 'New this week (3)').click();
	await expectRowNames(page, ['Jordan Example', 'Morgan Demo', 'Riley Sample']);
	await expect(announcer(page)).toHaveText('Showing New this week: 3 contacts.');
	await expect(page).toHaveURL(/\?list=new-this-week$/);

	// No contact in 7 days excludes Closed Logan (14d) and anyone newer than 7 days.
	await listButton(page, 'No contact in 7 days (3)').click();
	await expectRowNames(page, ['Casey Placeholder', 'Harper Fixture', 'Quinn Sampleton']);
	await expect(rows(page).filter({ hasText: 'Logan Pilot' })).toHaveCount(0);
	await expect(page).toHaveURL(/\?list=no-contact-7d$/);

	// Reload keeps the list; All clears the param.
	await page.reload();
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(listButton(page, 'No contact in 7 days (3)')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expectRowNames(page, ['Casey Placeholder', 'Harper Fixture', 'Quinn Sampleton']);
	await listButton(page, 'All (12)').click();
	await expect(rows(page)).toHaveCount(12);
	await expect(announcer(page)).toHaveText('Showing All: 12 contacts.');
	await expect(page).toHaveURL(/\/agent\/contacts\/$/);

	// Search and list combine, and a deep link restores both.
	await page.goto('agent/contacts/?list=due-today&q=jordan');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expectRowNames(page, ['Jordan Example']);
	await expect(search(page)).toHaveValue('jordan');
	await expect(listButton(page, 'Due today (5)')).toHaveAttribute('aria-pressed', 'true');
});

test('no-match states', async ({ page }) => {
	await loadSampleContacts(page);

	await search(page).fill('zzz');
	await expect(page.getByText('No contacts match "zzz".')).toBeVisible();
	await expect(table(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\?q=zzz$/);
	await page.getByRole('button', { name: 'Clear search' }).click();
	await expect(search(page)).toHaveValue('');
	await expect(search(page)).toBeFocused();
	await expect(rows(page)).toHaveCount(12);
	await expect(page).toHaveURL(/\/agent\/contacts\/$/);
	await expect(page.getByText('No contacts match')).toHaveCount(0);

	// A smart list with no contacts: the search message takes precedence only when a search is set.
	await search(page).fill('logan');
	await listButton(page, 'Due today (5)').click();
	await expect(page.getByText('No contacts match "logan".')).toBeVisible();
	await page.getByRole('button', { name: 'Clear search' }).click();
	await expectRowNames(page, [
		'Jordan Example',
		'Riley Sample',
		'Quinn Sampleton',
		'Drew Exampleton',
		'Rowan Specimen'
	]);
});

test('smart list with no matches offers Show all contacts', async ({ page }) => {
	// One real lead with no tasks: Due today is empty.
	await addLeadByHand(page, { name: 'Jordan Real', email: 'jordan.real@example.com' });
	await expectRowNames(page, ['Jordan Real']);
	await expect(rows(page).first()).not.toContainText('Sample data');

	await listButton(page, 'Due today (0)').click();
	await expect(page.getByText('No contacts match Due today right now.')).toBeVisible();
	await expect(announcer(page)).toHaveText('Showing Due today: 0 contacts.');
	await expect(table(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Show all contacts' }).click();
	await expectRowNames(page, ['Jordan Real']);
	await expect(listButton(page, 'All (1)')).toHaveAttribute('aria-pressed', 'true');
	await expect(announcer(page)).toHaveText('Showing All: 1 contact.');
	await expect(page).toHaveURL(/\/agent\/contacts\/$/);
});

test('quick add from the list focuses the new contact', async ({ page }) => {
	await loadSampleContacts(page);
	await addLeadByHand(page, { name: 'Jordan Real', email: 'jordan.real@example.com' });
	// Newest first, so the new contact is the first row and its name link takes focus.
	await expect(rows(page)).toHaveCount(13);
	await expect(rows(page).first()).toContainText('Jordan Real');
	await expect(rows(page).first().getByRole('link', { name: 'Jordan Real' })).toBeFocused();
	// Only the list's own Add a lead remains once contacts exist.
	await expect(page.getByRole('button', { name: 'Add a lead' })).toHaveCount(1);
});

test('axe clean at 1280 (table) and 375 (cards) with no horizontal scroll', async ({ page }) => {
	await loadSampleContacts(page);
	await expect(rows(page)).toHaveCount(12);
	await expectAxeClean(page, 'contacts table at 1280');

	await page.setViewportSize({ width: 375, height: 812 });
	await expect(cards(page)).toHaveCount(12);
	await expectAxeClean(page, 'contacts cards at 375');
	await expectNoHorizontalScroll(page);
});
