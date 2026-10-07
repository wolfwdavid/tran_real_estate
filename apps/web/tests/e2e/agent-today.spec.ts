import { test, expect, type Locator, type Page } from '@playwright/test';
import {
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// The due-today queue "when opening the app" (08-21; AGT-05, success criterion 3) on the real
// built site, both bases: /agent/ shows overdue then due-today tasks first, the nav pill counts
// them, /agent/today/ groups tasks and completes / reopens them with announcements and focus,
// the home's pipeline counts and Get set up checklist follow the data, and an empty CRM shows the
// empty states. Every test starts in a fresh browser context (empty IndexedDB) and must make zero
// RentCast requests. Dates come from the 08-15 sample fixture, which is relative to today.

const MIDDOT = '·';
const OVERDUE = ['Call about financing pre-approval', 'Send the Oak Street listing details'];
const DUE_TODAY = [
	'Reply to the Saturday tour question',
	'Confirm the second showing time',
	'Check in on the offer response'
];
const COMING_UP = [
	'Share three new listings',
	'Follow up after the tour',
	'Ask about move-in timing',
	'Send a one-year home anniversary note'
];

const group = (page: Page, key: string) => page.locator(`[data-group="${key}"]`);
const rows = (scope: Locator) => scope.locator('li[data-task-id]');
const titles = async (scope: Locator) =>
	(await rows(scope).locator('label').allTextContents()).map((t) => t.trim());
/**
 * The Today nav link with its count pill. UI-SPEC names it "Today, 5 tasks due"; browsers compute
 * "Today , 5 tasks due" because the visually hidden suffix (Tailwind sr-only, position: absolute)
 * counts as block-level in accessible-name computation and gets a space before it. The optional
 * space is accepted here; AgentNav (08-11) owns the markup (see deferred-items.md).
 */
const pill = (page: Page, n: number) =>
	page.getByRole('link', { name: new RegExp(`^Today ?, ${n} tasks due$`) });

async function openHome(page: Page) {
	await page.goto('agent/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Agent portal' })).toBeVisible();
	// Get set up renders in both the empty and the populated state once the data has loaded.
	await expect(page.locator('[data-section="get-set-up"]')).toBeVisible();
}

/**
 * Adds the first real contact from an empty CRM. Unlike the shared addLeadByHand, this waits for
 * the contacts page to hydrate (the empty state) before clicking Add a lead: on this single-core
 * setup the toolbar button exists in the prerendered HTML before its handler is attached.
 */
async function addFirstLead(page: Page, name: string, email: string) {
	await page.goto('agent/contacts/');
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toBeVisible();
	await page.getByRole('button', { name: 'Add a lead' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Add a lead' });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel('Name', { exact: true }).fill(name);
	await dialog.getByLabel('Email', { exact: true }).fill(email);
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(announcer(page)).toHaveText(`Added ${name} to New.`);
}

async function openToday(page: Page) {
	await page.goto('agent/today/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
	await expect(page.locator('[data-queue-empty], [data-group]').first()).toBeVisible();
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('opening /agent/ shows overdue then due today first', async ({ page }) => {
	await loadSampleContacts(page);
	await openHome(page);

	// The first section after the h1 is Due today, before Pipeline and Get set up.
	await expect(page.locator('h1 ~ * h2').first()).toHaveText('Due today');
	const due = page.locator('[data-section="due-today"]');
	await expect(rows(due)).toHaveCount(5);
	expect(await titles(due)).toEqual([...OVERDUE, ...DUE_TODAY]);
	expect(await titles(group(page, 'overdue'))).toEqual(OVERDUE);
	expect(await titles(group(page, 'due-today'))).toEqual(DUE_TODAY);
	// Exactly five are due, so there is no overflow link (compactQueue's unit test covers >5).
	await expect(page.getByRole('link', { name: 'See everything due' })).toHaveCount(0);

	// Each row names its contact and carries the due, stage and sample badges.
	const first = rows(due).first();
	await expect(first.getByRole('link', { name: 'Riley Sample' })).toBeVisible();
	await expect(first.locator('[data-due="overdue"]')).toContainText('Overdue');
	await expect(first.locator('[data-stage="new"]')).toHaveText('New');
	await expect(first.locator('[data-sample-chip]')).toBeVisible();
});

test('nav pill counts due work', async ({ page }) => {
	await loadSampleContacts(page);
	await expect(pill(page, 5)).toBeVisible();
	await expect(pill(page, 5)).toContainText('5');
	await openToday(page);
	await expect(pill(page, 5)).toBeVisible();
});

test('/agent/today/ groups and completes', async ({ page }) => {
	await loadSampleContacts(page);
	await openToday(page);

	const overdue = group(page, 'overdue');
	await expect(overdue.getByRole('heading', { level: 2, name: 'Overdue' })).toBeVisible();
	await expect(overdue).toContainText('2 tasks');
	expect(await titles(overdue)).toEqual(OVERDUE);

	const dueToday = group(page, 'due-today');
	await expect(dueToday.getByRole('heading', { level: 2, name: 'Due today' })).toBeVisible();
	await expect(dueToday).toContainText('3 tasks');
	expect(await titles(dueToday)).toEqual(DUE_TODAY);

	const comingUp = group(page, 'coming-up');
	await expect(comingUp.getByRole('heading', { level: 2, name: 'Coming up' })).toBeVisible();
	await expect(comingUp).toContainText('4 tasks');
	expect(await titles(comingUp)).toEqual(COMING_UP);
	await expect(comingUp.locator('[data-due="upcoming"]').first()).toContainText('Due ');

	await expect(group(page, 'done-today')).toHaveCount(0);
	await expect(page.getByText('Nothing due today')).toHaveCount(0);

	// Checking marks the task done at once, announces it, moves it to Done today and focuses the
	// next task in the group.
	await page.getByRole('checkbox', { name: 'Reply to the Saturday tour question' }).click();
	await expect(announcer(page)).toHaveText('Done: Reply to the Saturday tour question.');
	const done = group(page, 'done-today');
	await expect(done.locator('summary')).toHaveText('Done today (1)');
	await expect(rows(dueToday)).toHaveCount(2);
	await expect(dueToday).toContainText('2 tasks');
	await expect(
		page.getByRole('checkbox', { name: 'Confirm the second showing time' })
	).toBeFocused();
	await expect(pill(page, 4)).toBeVisible();

	// Done today is closed by default; inside it the row is checked, struck through and says Done.
	await expect(rows(done)).toBeHidden();
	await done.locator('summary').click();
	const doneRow = rows(done).first();
	await expect(doneRow).toBeVisible();
	const doneBox = doneRow.getByRole('checkbox', { name: 'Reply to the Saturday tour question' });
	await expect(doneBox).toHaveAttribute('aria-checked', 'true');
	await expect(doneRow.locator('label')).toHaveClass(/line-through/);
	await expect(doneRow).toContainText('Done');
	await expect(doneRow.locator('[data-due]')).toHaveCount(0);

	// Unchecking reopens it: back in Due today, announced, focus on its checkbox, pill back to 5.
	await doneBox.click();
	await expect(announcer(page)).toHaveText('Reopened: Reply to the Saturday tour question.');
	await expect(group(page, 'done-today')).toHaveCount(0);
	await expect(rows(dueToday)).toHaveCount(3);
	expect(await titles(dueToday)).toEqual(DUE_TODAY);
	await expect(
		page.getByRole('checkbox', { name: 'Reply to the Saturday tour question' })
	).toBeFocused();
	await expect(pill(page, 5)).toBeVisible();
});

test('completing every due task shows the caught-up panel and keeps Coming up', async ({
	page
}) => {
	await loadSampleContacts(page);
	await openToday(page);
	for (const title of [...OVERDUE, ...DUE_TODAY]) {
		await page.getByRole('checkbox', { name: title }).click();
		await expect(announcer(page)).toHaveText(`Done: ${title}.`);
	}
	const empty = page.locator('[data-queue-empty]');
	await expect(empty.getByRole('heading', { level: 2, name: 'Nothing due today' })).toBeVisible();
	await expect(empty).toContainText(
		"You're caught up. Add a task from any contact to plan your next follow-up."
	);
	// The last group emptied, so focus moved to the caught-up panel's title.
	await expect(empty.getByRole('heading', { level: 2 })).toBeFocused();
	await expect(group(page, 'coming-up')).toBeVisible();
	await expect(group(page, 'done-today').locator('summary')).toHaveText('Done today (5)');
	await expect(page.getByRole('link', { name: 'Today', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: /Today, \d+ tasks? due/ })).toHaveCount(0);
});

test('pipeline counts link to stage anchors', async ({ page, baseURL }) => {
	await loadSampleContacts(page);
	await openHome(page);
	const pipeline = page.locator('[data-section="pipeline"]');
	await expect(pipeline.getByRole('heading', { level: 2, name: 'Pipeline' })).toBeVisible();
	const touring = pipeline.getByRole('link', { name: `Touring ${MIDDOT} 2` });
	await expect(touring).toBeVisible();
	const href = await touring.evaluate((a) => (a as HTMLAnchorElement).href);
	expect(href.endsWith('#stage-touring')).toBe(true);
	expect(href).toBe(new URL('agent/pipeline/#stage-touring', baseURL).href);
	expect(await pipeline.getByRole('link').allTextContents()).toEqual(
		[
			['New', 4],
			['Contacted', 3],
			['Touring', 2],
			['Offer', 2],
			['Closed', 1]
		].map(([stage, n]) => `${stage} ${MIDDOT} ${n}`)
	);
});

test('get set up reflects data', async ({ page, baseURL }) => {
	await openHome(page);
	const setup = page.locator('[data-section="get-set-up"]');
	await expect(setup.getByRole('heading', { level: 2, name: 'Get set up' })).toBeVisible();
	await expect(setup.getByRole('listitem')).toHaveCount(3);
	await expect(setup).not.toContainText('Done:');
	const details = setup.getByRole('link', {
		name: 'Add your name, license, and mailing address'
	});
	expect(await details.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
		new URL('agent/profile/', baseURL).href
	);
	const inquiry = setup.getByRole('link', { name: 'Create your inquiry link' });
	expect(await inquiry.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
		new URL('agent/profile/#inquiry-page', baseURL).href
	);
	await expect(setup.getByRole('button', { name: 'Add your first contact' })).toBeVisible();

	// Item 3 opens the Add a lead dialog; Cancel returns focus to it.
	await setup.getByRole('button', { name: 'Add your first contact' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add a lead' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(setup.getByRole('button', { name: 'Add your first contact' })).toBeFocused();

	// A real contact (not a sample) completes the third step; the row reads the same text with a
	// hidden Done prefix. The queue and pipeline replace the empty state.
	await addFirstLead(page, 'Avery Example', 'avery.example@example.com');
	await openHome(page);
	await expect(setup.getByRole('listitem').nth(2)).toHaveText('Done: Add your first contact');
	await expect(setup.getByRole('button', { name: 'Done: Add your first contact' })).toBeVisible();
	await expect(setup.getByRole('listitem').nth(0)).toHaveText(
		'Add your name, license, and mailing address'
	);
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toHaveCount(0);
	await expect(page.locator('[data-section="due-today"]')).toContainText('Nothing due today');
	await expect(page.locator('[data-section="pipeline"]')).toContainText(`New ${MIDDOT} 1`);
	const quick = page.locator('[data-section="quick-actions"]');
	await expect(quick.getByRole('button', { name: 'Add a lead' })).toBeVisible();
	await expect(quick.getByRole('link', { name: 'Import leads' })).toBeVisible();
	// No share link can be built without a profile, so there is nothing to copy yet.
	await expect(quick.getByRole('button', { name: 'Copy inquiry link' })).toHaveCount(0);
});

test('empty CRM home shows the empty state', async ({ page, baseURL }) => {
	await openHome(page);
	await expect(page.getByRole('heading', { level: 2, name: 'No contacts yet' })).toBeVisible();
	await expect(page.locator('[data-section="due-today"]')).toHaveCount(0);
	await expect(page.locator('[data-section="pipeline"]')).toHaveCount(0);
	await expect(page.locator('[data-section="get-set-up"]')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Today', exact: true })).toBeVisible();

	await openToday(page);
	await expect(page.getByRole('heading', { level: 2, name: 'Nothing due today' })).toBeVisible();
	await expect(
		page.getByText("You're caught up. Add a task from any contact to plan your next follow-up.")
	).toBeVisible();
	const open = page.getByRole('link', { name: 'Open your pipeline' });
	expect(await open.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
		new URL('agent/pipeline/', baseURL).href
	);
	await expect(page.locator('[data-group]')).toHaveCount(0);
});

test('axe clean on the home and Today, empty and with samples', async ({ page }) => {
	await openHome(page);
	await expectAxeClean(page, 'empty home');
	await openToday(page);
	await expectAxeClean(page, 'empty Today');

	await loadSampleContacts(page);
	await openHome(page);
	await expectAxeClean(page, 'home with samples');
	await openToday(page);
	await expectAxeClean(page, 'Today with samples');
	await page.getByRole('checkbox', { name: 'Reply to the Saturday tour question' }).click();
	await expect(group(page, 'done-today').locator('summary')).toHaveText('Done today (1)');
	await group(page, 'done-today').locator('summary').click();
	await expectAxeClean(page, 'Today with Done today open');
});

test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('no horizontal scroll and axe clean, empty and with samples', async ({ page }) => {
		await openHome(page);
		await expectNoHorizontalScroll(page);
		await expectAxeClean(page, 'empty home at 375px');
		await openToday(page);
		await expectNoHorizontalScroll(page);
		await expectAxeClean(page, 'empty Today at 375px');

		await loadSampleContacts(page);
		await openHome(page);
		await expectNoHorizontalScroll(page);
		await expectAxeClean(page, 'home with samples at 375px');
		await openToday(page);
		await expectNoHorizontalScroll(page);
		await expectAxeClean(page, 'Today with samples at 375px');
	});
});
