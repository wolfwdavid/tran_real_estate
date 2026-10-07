import { test, expect, type Locator, type Page } from '@playwright/test';
import {
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// The contact detail page (08-23; AGT-04, AGT-05) on the real built site, both bases: the record
// opens from the pipeline, the Stage select moves through the same path as the board (activity,
// Undo, announcement), tasks can be added with a quick-set date, completed and deleted with Undo,
// a logged call updates the last-contact meta, editing re-checks duplicates and records the
// opt-out, notes save on blur, Delete contact asks first and cascades, and an unknown id shows
// the not-found block. Every test starts in a fresh browser context, seeds the 12 sample
// contacts and must make zero RentCast requests. Jordan Example (sample row 0) has one open task
// ("Reply to the Saturday tour question", due today) and two activities.

const NAME = 'Jordan Example';
const TASK = 'Call about the Oak Street tour';
const SECOND_TASK = 'Send the parking details';
// Built from its code point so this file stays ASCII (the formatter rewrites \u escapes).
const MIDDOT = String.fromCharCode(0xb7);

const header = (page: Page) => page.locator('[data-contact-header]');
const activity = (page: Page) => page.locator('[data-activity-list]');
const openTasks = (page: Page) => page.locator('[data-open-tasks]');
const taskRow = (page: Page, title: string) =>
	page.locator('li[data-task-id]').filter({ has: page.locator('label', { hasText: title }) });
const checkbox = (row: Locator) => row.locator('[data-task-checkbox]');
const editDetails = (page: Page) => page.getByRole('button', { name: 'Edit details' });
const saveDetails = (page: Page) => page.getByRole('button', { name: 'Save details' });
const optOutBox = (page: Page) =>
	page.getByRole('checkbox', { name: `${NAME} asked not to get emails from me` });

async function expectHydrated(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
}

/** Seeds the samples, opens the pipeline and follows Jordan's card link to the detail page. */
async function openJordan(page: Page) {
	await loadSampleContacts(page);
	await page.goto('agent/pipeline/');
	await expectHydrated(page);
	await page.getByRole('link', { name: NAME }).click();
	await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
	await expect(activity(page)).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
}

async function addTask(page: Page, title: string) {
	await page.getByLabel('Task', { exact: true }).fill(title);
	await page.getByRole('button', { name: 'Add task' }).click();
	await expect(announcer(page)).toHaveText(new RegExp(`^Task added for ${NAME}, due `));
	await expect(taskRow(page, title)).toBeVisible();
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('opens from the pipeline and shows the record', async ({ page }) => {
	await openJordan(page);
	await expect(page).toHaveURL(/agent\/contact\/\?id=/);
	await expect(page).toHaveTitle(`${NAME}: Agent portal ${MIDDOT} Tran Real Estate Tools`);
	const h = header(page);
	await expect(h.locator('[data-stage="new"]')).toHaveText('New');
	await expect(h.locator('[data-sample-chip]')).toHaveText('Sample data');
	await expect(h.locator('[data-no-emails]')).toHaveCount(0);
	await expect(h.locator('[data-added-meta]')).toHaveText(
		new RegExp(`^Added [A-Z][a-z]{2} \\d{1,2}, \\d{4} ${MIDDOT} Inquiry page$`)
	);
	await expect(page.getByLabel('Stage')).toHaveValue('new');

	// Contact info: mailto and tel links, property and source.
	const info = page.locator('[data-contact-info]');
	await expect(info.getByRole('link', { name: 'jordan@example.com' })).toHaveAttribute(
		'href',
		'mailto:jordan@example.com'
	);
	await expect(info.getByRole('link', { name: '(555) 555-0101' })).toHaveAttribute(
		'href',
		'tel:+15555550101'
	);
	await expect(info).toContainText('12 Sample Lane, Harlow Springs');
	await expect(info).toContainText('Inquiry page');

	// Tasks, notes and the follow-up slot.
	await expect(openTasks(page).locator('li[data-task-id]')).toHaveCount(1);
	await expect(taskRow(page, 'Reply to the Saturday tour question')).toBeVisible();
	await expect(page.getByLabel('Notes about Jordan')).toHaveValue(
		'Prefers email. Looking for a 2-bedroom near the park.'
	);
	await expect(page.locator('#follow-up h2')).toHaveText('Follow-up email');

	// Activity, newest first.
	const items = activity(page).locator('li');
	await expect(items).toHaveCount(2);
	await expect(activity(page)).toContainText('Loaded as a sample contact');
	await expect(activity(page)).toContainText(
		'Inquiry received: "Could we tour on Saturday morning?"'
	);
	await expect(items.first().locator('time')).toHaveAttribute('datetime', /T/);
});

test('stage select logs, announces and undoes', async ({ page }) => {
	await openJordan(page);
	await page.getByLabel('Stage').selectOption('contacted');
	await expect(announcer(page)).toHaveText(`Moved ${NAME} to Contacted.`);
	await expect(header(page).locator('[data-stage="contacted"]')).toHaveText('Contacted');
	await expect(page.locator('#board-undo')).toContainText(`Moved ${NAME} to Contacted.`);
	await expect(activity(page).locator('li').first()).toContainText('Moved from New to Contacted');
	await expect(activity(page).locator('li')).toHaveCount(3);

	await page.locator('#board-undo').getByRole('button', { name: 'Undo' }).click();
	await expect(announcer(page)).toHaveText(`Moved ${NAME} back to New.`);
	await expect(header(page).locator('[data-stage="new"]')).toHaveText('New');
	await expect(page.getByLabel('Stage')).toHaveValue('new');
	await expect(activity(page)).not.toContainText('Moved from New to Contacted');
	await expect(activity(page).locator('li')).toHaveCount(2);
	await expect(page.locator('#board-undo')).toBeFocused();
	await expect(page.locator('#board-undo').getByRole('button', { name: 'Undo' })).toHaveCount(0);

	// The move is gone after a reload too (the activity was removed, not hidden).
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
	await expect(header(page).locator('[data-stage="new"]')).toHaveText('New');
	await expect(activity(page).locator('li')).toHaveCount(2);
});

test('tasks: add with quick-set, complete, delete with undo', async ({ page }) => {
	await openJordan(page);

	// Add with Tomorrow: the quick-set changes the date only, Add task submits.
	await page.getByLabel('Task', { exact: true }).fill(TASK);
	const due = page.getByLabel('Due');
	const before = await due.inputValue();
	await page.getByRole('button', { name: 'Tomorrow' }).click();
	await expect(due).not.toHaveValue(before);
	await expect(taskRow(page, TASK)).toHaveCount(0);
	await page.getByRole('button', { name: 'Add task' }).click();
	await expect(announcer(page)).toHaveText(new RegExp(`^Task added for ${NAME}, due `));
	const row = taskRow(page, TASK);
	await expect(row).toBeVisible();
	await expect(checkbox(row)).toBeFocused();
	await expect(page.getByLabel('Task', { exact: true })).toHaveValue('');
	await expect(openTasks(page).locator('li[data-task-id]')).toHaveCount(2);

	// Complete: announced, logged, moved under Done (1).
	await checkbox(row).click();
	await expect(announcer(page)).toHaveText(`Done: ${TASK}.`);
	await expect(activity(page).locator('li').first()).toContainText(
		'Task done: Call about the Oak Street tour'
	);
	await expect(openTasks(page).locator('li[data-task-id]')).toHaveCount(1);
	const done = page.locator('[data-done-tasks]');
	await expect(done.locator('summary')).toHaveText('Done (1)');
	await expect(done).not.toHaveAttribute('open');
	await expect(checkbox(taskRow(page, 'Reply to the Saturday tour question'))).toBeFocused();

	// Delete with Undo.
	await addTask(page, SECOND_TASK);
	await taskRow(page, SECOND_TASK).getByRole('button', { name: 'Delete' }).click();
	await expect(announcer(page)).toHaveText(`Deleted task ${SECOND_TASK}.`);
	await expect(taskRow(page, SECOND_TASK)).toHaveCount(0);
	await expect(page.locator('#tasks-undo')).toContainText(`Deleted task "${SECOND_TASK}".`);
	await expect(page.locator('#tasks-undo')).toBeFocused();
	await page.locator('#tasks-undo').getByRole('button', { name: 'Undo' }).click();
	await expect(announcer(page)).toHaveText('Task restored.');
	await expect(taskRow(page, SECOND_TASK)).toBeVisible();
	await expect(checkbox(taskRow(page, SECOND_TASK))).toBeFocused();
	await expect(page.locator('#tasks-undo')).toContainText('Task restored.');
	await expect(page.locator('#tasks-undo').getByRole('button', { name: 'Undo' })).toHaveCount(0);

	// Validation copy for an empty title.
	await page.getByRole('button', { name: 'Add task' }).click();
	await expect(
		page.getByText('Describe the task, like "Call about the Oak Street tour".')
	).toBeVisible();
	await expect(page.getByLabel('Task', { exact: true })).toBeFocused();
	await expect(page.getByLabel('Task', { exact: true })).toHaveAttribute('aria-invalid', 'true');
});

test('log a call updates last contact', async ({ page }) => {
	await openJordan(page);
	await page.getByLabel('Type').selectOption('call');
	await page.getByLabel('Details (optional)').fill('Asked about Saturday');
	await page.getByRole('button', { name: 'Log it' }).click();
	await expect(announcer(page)).toHaveText(`Logged call for ${NAME}.`);
	await expect(activity(page).locator('li').first()).toContainText(
		'Logged a call: Asked about Saturday'
	);
	await expect(activity(page).locator('li').first()).toHaveAttribute('data-activity-type', 'call');
	await expect(page.getByLabel('Details (optional)')).toHaveValue('');

	await page.goto('agent/pipeline/');
	await expectHydrated(page);
	await expect(page.getByRole('article', { name: NAME })).toContainText('Last contact today');
});

test('edit details catches duplicates and records opt-out', async ({ page }) => {
	await openJordan(page);
	await editDetails(page).click();
	const form = page.locator('[data-contact-edit]');
	await expect(form).toBeVisible();
	await expect(form.getByLabel('Name', { exact: true })).toBeFocused();
	await expect(form.getByLabel('Name', { exact: true })).toHaveValue(NAME);
	await expect(form.getByLabel('Source')).toHaveValue('inquiry');

	// Riley Sample already has riley@example.com.
	await form.getByLabel('Email', { exact: true }).fill('riley@example.com');
	await saveDetails(page).click();
	const alert = form.locator('[data-duplicate-alert]');
	await expect(alert).toBeVisible();
	await expect(alert).toContainText('Riley Sample is already in your contacts');
	await expect(alert).toContainText('Same email address.');
	await expect(alert.locator('p').first()).toBeFocused();
	await expect(announcer(page)).toHaveText('Riley Sample is already in your contacts.');
	await expect(alert.getByRole('link', { name: 'Open Riley' })).toHaveAttribute(
		'href',
		/agent\/contact\/\?id=/
	);
	await expect(alert.getByRole('button', { name: 'Save anyway' })).toBeVisible();

	// Cancel: nothing changed and focus returns to Edit details.
	await form.getByRole('button', { name: 'Cancel' }).click();
	await expect(form).toHaveCount(0);
	await expect(editDetails(page)).toBeFocused();
	await expect(
		page.locator('[data-contact-info]').getByRole('link', { name: 'jordan@example.com' })
	).toBeVisible();
	await expect(activity(page)).not.toContainText('Details updated');

	// Opt-out: the checkbox records the activity and shows the chip.
	await editDetails(page).click();
	await optOutBox(page).click();
	await expect(optOutBox(page)).toBeChecked();
	await saveDetails(page).click();
	await expect(announcer(page)).toHaveText(`${NAME} won't get follow-up drafts.`);
	await expect(header(page).locator('[data-no-emails]')).toHaveText('No emails');
	await expect(activity(page).locator('li').first()).toContainText('Asked not to get emails');
	await expect(editDetails(page)).toBeFocused();

	// A real detail change logs "Details updated"; clearing the box logs the removal.
	await editDetails(page).click();
	await page
		.locator('[data-contact-edit]')
		.getByLabel('Property of interest')
		.fill('14 Sample Lane');
	await optOutBox(page).click();
	await saveDetails(page).click();
	await expect(announcer(page)).toHaveText(`Follow-up drafts turned back on for ${NAME}.`);
	await expect(header(page).locator('[data-no-emails]')).toHaveCount(0);
	await expect(page.locator('[data-contact-info]')).toContainText('14 Sample Lane');
	await expect(activity(page)).toContainText('Details updated');
	await expect(activity(page)).toContainText('Email opt-out removed');
});

test('notes save on blur', async ({ page }) => {
	await openJordan(page);
	const notes = page.getByLabel('Notes about Jordan');
	await notes.fill('Wants a tour on Saturday. Budget is flexible.');
	await page.keyboard.press('Tab');
	await expect(page.locator('#notes-status')).toContainText('Notes saved.');
	await expect(announcer(page)).toHaveText('Notes saved.');
	// Notes never log activity.
	await expect(activity(page).locator('li')).toHaveCount(2);

	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
	await expect(page.getByLabel('Notes about Jordan')).toHaveValue(
		'Wants a tour on Saturday. Budget is flexible.'
	);
});

test('delete asks first and cascades', async ({ page }) => {
	await openJordan(page);
	const detailUrl = page.url();
	await page.getByRole('button', { name: 'Delete contact' }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Delete Jordan Example?' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText(
		`This removes ${NAME}, their 1 task, and their activity from this browser.`
	);
	await expect(dialog.getByRole('button', { name: 'Keep contact' })).toBeFocused();

	// Keep contact closes without a change.
	await dialog.getByRole('button', { name: 'Keep contact' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();

	await page.getByRole('button', { name: 'Delete contact' }).click();
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Delete contact' }).click();
	await expect(page).toHaveURL(/agent\/contacts\/$/);
	await expect(page.locator('#contacts-flash')).toContainText(`Deleted ${NAME}.`);
	await expect(page.locator('#contacts-flash')).toBeFocused();
	await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none');
	await expect(page.getByRole('link', { name: NAME })).toHaveCount(0);
	await expect(page.locator('[data-contacts-view]')).toContainText('11 contacts');

	// The cascade removed the task from Today as well.
	await page.goto('agent/today/');
	await expectHydrated(page);
	await expect(page.locator('[data-queue-empty], [data-group]').first()).toBeVisible();
	await expect(page.getByText('Reply to the Saturday tour question')).toHaveCount(0);

	// The old link now shows the not-found block with focus on its heading.
	await page.goto(detailUrl);
	const h1 = page.getByRole('heading', { level: 1, name: "This contact isn't here" });
	await expect(h1).toBeVisible();
	await expect(h1).toBeFocused();
	await expect(page.getByRole('link', { name: 'Go to contacts' })).toHaveAttribute(
		'href',
		/agent\/contacts\/$/
	);
});

test('unknown and missing ids show the not-found block', async ({ page }) => {
	await page.goto('agent/contact/?id=not-a-contact');
	await expectHydrated(page);
	const h1 = page.getByRole('heading', { level: 1, name: "This contact isn't here" });
	await expect(h1).toBeVisible();
	await expect(h1).toBeFocused();
	await expect(
		page.getByText('Contacts live only in the browser where you added them.')
	).toBeVisible();
	await page.getByRole('link', { name: 'Go to contacts' }).click();
	await expect(page).toHaveURL(/agent\/contacts\/$/);

	await page.goto('agent/contact/');
	await expectHydrated(page);
	await expect(
		page.getByRole('heading', { level: 1, name: "This contact isn't here" })
	).toBeVisible();
});

test('no sms links', async ({ page }) => {
	await openJordan(page);
	await expect(page.locator('a[href^="sms:"]')).toHaveCount(0);
	await expect(page.locator('a[href^="tel:"]')).toHaveCount(1);
});

for (const width of [1280, 375]) {
	test(`axe clean at ${width}px in every state`, async ({ page }) => {
		await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
		await openJordan(page);
		await addTask(page, TASK);
		await page.getByLabel('Type').selectOption('email');
		await page.getByRole('button', { name: 'Log it' }).click();
		await expect(announcer(page)).toHaveText(`Logged email for ${NAME}.`);
		if (width === 375) await expectNoHorizontalScroll(page);
		await expectAxeClean(page, `contact detail with tasks and activity at ${width}`);

		await editDetails(page).click();
		const form = page.locator('[data-contact-edit]');
		await form.getByLabel('Email', { exact: true }).fill('riley@example.com');
		await saveDetails(page).click();
		await expect(form.locator('[data-duplicate-alert]')).toBeVisible();
		if (width === 375) await expectNoHorizontalScroll(page);
		await expectAxeClean(page, `edit mode with the duplicate alert at ${width}`);
		await form.getByRole('button', { name: 'Cancel' }).click();

		await page.getByRole('button', { name: 'Delete contact' }).click();
		await expect(page.getByRole('alertdialog', { name: `Delete ${NAME}?` })).toBeVisible();
		await expectAxeClean(page, `delete dialog at ${width}`);
		await page.getByRole('button', { name: 'Keep contact' }).click();

		await page.goto('agent/contact/?id=not-a-contact');
		await expectHydrated(page);
		await expect(
			page.getByRole('heading', { level: 1, name: "This contact isn't here" })
		).toBeVisible();
		if (width === 375) await expectNoHorizontalScroll(page);
		await expectAxeClean(page, `not found at ${width}`);
	});
}
