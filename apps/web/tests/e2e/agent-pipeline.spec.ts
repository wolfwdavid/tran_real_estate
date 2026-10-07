import { test, expect, type Page } from '@playwright/test';
import {
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// The pipeline board (08-19; AGT-04, success criterion 3) on the real built site, both bases:
// every move has a keyboard and single-tap path (the Move menu, WCAG 2.5.7), pointer drag works
// at 1280px, Undo reverses a move, the Show filter narrows each column, the stacked view keeps
// jump links, and axe is clean in every layout. Each test starts in a fresh browser context,
// seeds the 12 sample contacts (New 4 / Contacted 3 / Touring 2 / Offer 2 / Closed 1) and must
// make zero RentCast requests.

const STAGE_IDS = {
	New: 'new',
	Contacted: 'contacted',
	Touring: 'touring',
	Offer: 'offer',
	Closed: 'closed'
};
const STAGE_NAMES = ['New', 'Contacted', 'Touring', 'Offer', 'Closed'] as const;
type StageName = (typeof STAGE_NAMES)[number];

const section = (page: Page, stage: StageName) => page.locator(`#stage-${STAGE_IDS[stage]}`);
const cardIn = (page: Page, stage: StageName, name: string) =>
	section(page, stage).getByRole('article', { name });
const moveButton = (page: Page, name: string) => page.getByRole('button', { name: `Move ${name}` });
const stageCount = (page: Page, stage: StageName) =>
	section(page, stage).locator('[data-stage-count]');

async function openPipeline(page: Page) {
	await loadSampleContacts(page);
	await page.goto('agent/pipeline/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Pipeline' })).toBeVisible();
	await expect(section(page, 'New')).toBeVisible();
}

/** Opens the Move menu with Enter, arrows to `target` and selects it with Enter. */
async function moveByKeyboard(page: Page, name: string, target: StageName) {
	const trigger = moveButton(page, name);
	await trigger.focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('menu');
	await expect(menu).toBeVisible();
	const item = page.getByRole('menuitemradio', { name: target });
	await expect(item).toBeVisible();
	// bits-ui focuses the content (or its first item) on open; arrow until the target is focused.
	for (let i = 0; i < 6; i++) {
		if (await item.evaluate((el) => el === document.activeElement)) break;
		await page.keyboard.press('ArrowDown');
	}
	await expect(item).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(menu).toHaveCount(0);
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('shows the five stages in order with counts and no horizontal scroll', async ({ page }) => {
	await openPipeline(page);
	const headings = page.locator('[data-stage-board] h2');
	await expect(headings).toHaveText([
		/^New, 4 contacts$/,
		/^Contacted, 3 contacts$/,
		/^Touring, 2 contacts$/,
		/^Offer, 2 contacts$/,
		/^Closed, 1 contact$/
	]);
	await expect(stageCount(page, 'New')).toHaveText('4');
	await expect(stageCount(page, 'Closed')).toHaveText('1');
	await expectNoHorizontalScroll(page);
});

test('keyboard-only: moves a card through all five stages', async ({ page }) => {
	await openPipeline(page);
	const name = 'Jordan Example';
	await expect(cardIn(page, 'New', name)).toBeVisible();
	const path: StageName[] = ['Contacted', 'Touring', 'Offer', 'Closed', 'New'];
	for (const target of path) {
		await moveByKeyboard(page, name, target);
		await expect(cardIn(page, target, name)).toBeVisible();
		await expect(announcer(page)).toHaveText(`Moved ${name} to ${target}.`);
		await expect(moveButton(page, name)).toBeFocused();
		await expect(page.locator('#board-undo')).toContainText(`Moved ${name} to ${target}.`);
		await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
	}
	// Every stage was visited, and the card is back where it started.
	expect(path).toEqual(expect.arrayContaining([...STAGE_NAMES]));
	await expect(stageCount(page, 'New')).toHaveText('4');
});

test('selecting the current stage changes nothing', async ({ page }) => {
	await openPipeline(page);
	const name = 'Casey Placeholder';
	await moveByKeyboard(page, name, 'New');
	await expect(cardIn(page, 'New', name)).toBeVisible();
	await expect(announcer(page)).not.toHaveText(/Moved/);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(moveButton(page, name)).toBeFocused();
});

test('pointer drag at 1280px moves a card and shows the drop hint', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openPipeline(page);
	const name = 'Riley Sample';
	const card = cardIn(page, 'New', name);
	await expect(card).toBeVisible();
	// The grip handle only renders when the drag media query matches.
	await expect(card.locator('..').locator('svg.lucide-grip-vertical')).toBeVisible();

	// A manual drag, held mid-flight: the target column shows "Drop to move to Touring".
	// Let the freshly navigated page settle (fonts, hydration, the first live query) before a
	// raw press: on a busy renderer the press-and-move that starts a native drag can be missed.
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(300);
	// Measure only after settling: raw mouse coordinates must match the layout being pressed.
	const from = await card.boundingBox();
	const to = await section(page, 'Touring').boundingBox();
	if (!from || !to) throw new Error('board not laid out');
	// Press on the card's top padding, then one move large enough to pass Chromium's drag
	// threshold (so Playwright intercepts the drag), then glide over the target column.
	await page.mouse.move(from.x + from.width / 2, from.y + 12);
	await page.mouse.down();
	await page.mouse.move(from.x + from.width / 2 + 40, from.y + 40);
	await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 8 });
	await expect(section(page, 'Touring').getByText('Drop to move to Touring')).toBeVisible();
	await expect(section(page, 'New').getByText('Moving')).toBeVisible();
	await page.mouse.up();

	await expect(cardIn(page, 'Touring', name)).toBeVisible();
	await expect(announcer(page)).toHaveText(`Moved ${name} to Touring.`);
	await expect(stageCount(page, 'Touring')).toHaveText('3');
	await expect(stageCount(page, 'New')).toHaveText('3');
	await expect(page.getByText('Drop to move to')).toHaveCount(0);

	// And Playwright's own dragTo (native HTML5 DnD) moves it on again. The drop lands on the
	// column heading, which is always in view: dragTo scrolls its target into view after the
	// press, and a column taller than the viewport would shift the page under the held pointer.
	await cardIn(page, 'Touring', name).dragTo(section(page, 'Offer').locator('h2'));
	await expect(cardIn(page, 'Offer', name)).toBeVisible();
	await expect(announcer(page)).toHaveText(`Moved ${name} to Offer.`);
});

test('undo restores the stage and removes the activity', async ({ page }) => {
	await openPipeline(page);
	const name = 'Jordan Example';
	await moveByKeyboard(page, name, 'Touring');
	await expect(cardIn(page, 'Touring', name)).toBeVisible();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(cardIn(page, 'New', name)).toBeVisible();
	await expect(announcer(page)).toHaveText(`Moved ${name} back to New.`);
	await expect(page.locator('#board-undo')).toContainText(`Moved ${name} back to New.`);
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await expect(moveButton(page, name)).toBeFocused();
	// The move's activity is gone: a reload shows the card in New with the original counts.
	await page.reload();
	await expect(cardIn(page, 'New', name)).toBeVisible();
	await expect(stageCount(page, 'New')).toHaveText('4');
	await expect(stageCount(page, 'Touring')).toHaveText('2');
});

test('filter counts read shown of total and the URL carries ?list=', async ({ page }) => {
	await openPipeline(page);
	await page.getByRole('button', { name: 'Due today (5)' }).click();
	await expect(stageCount(page, 'New')).toHaveText(/^\d+ of 4$/);
	await expect(stageCount(page, 'New')).toHaveText('2 of 4');
	await expect(page.locator('[data-stage-board] h2').first()).toHaveText('New, 2 of 4 contacts');
	await expect(page).toHaveURL(/\?list=due-today$/);
	await expect(announcer(page)).toHaveText('Showing Due today: 5 contacts.');
	// Reload restores the filter from the URL.
	await page.reload();
	await expect(page.getByRole('button', { name: 'Due today (5)' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(stageCount(page, 'New')).toHaveText('2 of 4');
	await page.getByRole('button', { name: 'All (12)' }).click();
	await expect(stageCount(page, 'New')).toHaveText('4');
	await expect(page).not.toHaveURL(/list=/);
});

test('stacked view below 1280 has jump links and no horizontal scroll', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await openPipeline(page);
	await expect(page.getByText('Jump to', { exact: true })).toBeVisible();
	const offerLink = page.getByRole('link', { name: 'Offer 2' });
	await expect(offerLink).toBeVisible();
	await offerLink.click();
	await expect(page).toHaveURL(/#stage-offer$/);
	await expect(section(page, 'Offer')).toBeInViewport();
	// No drag affordance on a narrow viewport: cards are not draggable.
	await expect(page.locator('[data-stage-board] li[draggable="true"]')).toHaveCount(0);
	await expectNoHorizontalScroll(page);
	// The Move menu still works with a single tap.
	await moveButton(page, 'Rowan Specimen').click();
	await page.getByRole('menuitemradio', { name: 'Closed' }).click();
	await expect(cardIn(page, 'Closed', 'Rowan Specimen')).toBeVisible();
	await expect(announcer(page)).toHaveText('Moved Rowan Specimen to Closed.');
	await expectNoHorizontalScroll(page);
});

test('deep link #stage-closed scrolls that section into view', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await loadSampleContacts(page);
	await page.goto('agent/pipeline/#stage-closed');
	await expect(section(page, 'Closed')).toBeVisible();
	await expect(section(page, 'Closed')).toBeInViewport();
});

test('axe: board at 1280, stacked at 1024 and 375, and with the Move menu open', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openPipeline(page);
	await expectAxeClean(page, 'pipeline board 1280');

	await page.setViewportSize({ width: 1024, height: 900 });
	await expect(page.getByText('Jump to', { exact: true })).toBeVisible();
	await expectAxeClean(page, 'pipeline stacked 1024');

	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
	await expectAxeClean(page, 'pipeline stacked 375');

	await moveButton(page, 'Jordan Example').click();
	await expect(page.getByRole('menu')).toBeVisible();
	await expect(page.getByRole('menuitemradio', { name: 'New' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expectAxeClean(page, 'pipeline with the Move menu open');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(moveButton(page, 'Jordan Example')).toBeFocused();
});
