import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_TAGS } from './agent-helpers';

// Reel script studio (09-22, STU-03) on the real built site, both bases, keyless: with no AI key
// the Phase 5 GenerationPanel uses the Fixture provider, whose text is built from the agent's
// beats by studio/reel.v1 sample(). Every request to a non-local host is aborted and recorded;
// RentCast and every AI provider host must stay at zero.
//
// Covered: the run control validates first; sample beats write a script whose Script at a glance
// times come from code (table at 1280px, stacked cards at 375px, 30 then 60 seconds); with Your
// results empty the notice shows and the results beat keeps the placeholder, and a typed number
// there is a Must fix that gates Copy; Copy text is the timecoded script, the B-roll list, the
// Avery Sample ad-inline disclosure and the checklist; the checklist is local and never gates;
// the Studio hub counts the draft under studio-reel; axe in the reel states at 1280px and 375px
// with no horizontal scroll.

const ROUTE = 'agent/studio/reel/';
const PROVIDER_HOSTS = [
	'api.rentcast.io',
	'api.anthropic.com',
	'api.openai.com',
	'generativelanguage.googleapis.com',
	'openrouter.ai'
];
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

const MID = String.fromCharCode(0xb7);
const PLACEHOLDER = '[Add a real result you can document]';
const RESULTS_NOTICE =
	"You haven't added results, so the script will say [Add a real result you can document] in the results beat. Fill it in with a real result before you record.";
const FOOTER_LABEL = 'Added to the end of the copied script';
const PROFILE_REASON =
	'Add your full name, brokerage, license type, license number, and license state in your profile so your disclosure can be added.';
const FOOTNOTE =
	"This checklist is a reminder, not legal advice. Check your state's and brokerage's advertising rules.";

const panel = (page: Page) => page.getByRole('region', { name: 'Reel script', exact: true });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const exits = (page: Page) => panel(page).getByTestId('generation-exits');
const copyButton = (page: Page) => exits(page).getByRole('button', { name: 'Copy text' });
const writeButton = (page: Page) =>
	page.getByRole('button', { name: 'Write reel script', exact: true });
const glance = (page: Page) => page.getByRole('region', { name: 'Script at a glance' });
const checklist = (page: Page) => page.getByRole('region', { name: 'Before you post this video' });
const resultsField = (page: Page) => page.getByLabel('Your results (optional)', { exact: true });

let external: string[];
let pageErrors: string[];

test.beforeEach(async ({ page }) => {
	external = [];
	pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(e.message));
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (LOCAL_HOSTS.has(url.hostname)) return route.fallback();
		external.push(url.href);
		return route.abort();
	});
});

test.afterEach(() => {
	const providerHits = external.filter((u) => PROVIDER_HOSTS.includes(new URL(u).hostname));
	expect(providerHits, 'the reel studio must never reach RentCast or an AI provider').toEqual([]);
	expect(external, 'no request may leave the local origin').toEqual([]);
	expect(pageErrors, 'no uncaught page errors').toEqual([]);
});

/** Opens the studio and waits until the form is interactive. */
async function openStudio(page: Page): Promise<void> {
	await page.goto(ROUTE);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toHaveText('Reel script');
	await expect(page.locator('[data-reel-studio]')).toBeVisible();
	await expect(page.getByText('Loading your studio')).toHaveCount(0);
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
}

async function fillSample(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Fill with sample beats' }).click();
	await expect(resultsField(page)).toHaveValue(
		'Answered every inquiry within an hour last spring.'
	);
	await expect(page.locator('[data-reel-studio] [data-sample-chip]')).toBeVisible();
}

/** The run control: "Write reel script" before the first draft, "Generate again" after it. */
async function writeScript(page: Page): Promise<void> {
	await panel(page)
		.getByRole('button', { name: /^(Write reel script|Generate again)$/ })
		.click();
	// The panel resolves the provider and builds the prompt before the run starts; until then the
	// previous run's "Draft ready." is still shown and no Stop exists. Wait for this run to start
	// (the keyless sample streams for several seconds), so the checks below see this run's end.
	await expect(panel(page)).toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
	await expect(panel(page).getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0, {
		timeout: 30_000
	});
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 30_000
	});
}

/** Rewrites the draft through Edit draft / Done editing. */
async function editDraft(page: Page, change: (text: string) => string): Promise<void> {
	await panel(page).getByRole('button', { name: 'Edit draft' }).click();
	const box = panel(page).getByLabel('Edit your draft');
	await expect(box).toBeVisible();
	await box.fill(change(await box.inputValue()));
	await panel(page).getByRole('button', { name: 'Done editing' }).click();
	await expect(draft(page)).toBeVisible();
}

async function expectAxe(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

async function expectNoPageScroll(page: Page, width: number): Promise<void> {
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		width
	);
}

test('Write reel script on an empty form makes no request and focuses the first invalid beat', async ({
	page
}) => {
	await openStudio(page);
	await expect(glance(page)).toContainText('The beat table appears here once a script is written.');
	await expect(page.locator('[data-reel-results-notice]')).toHaveText(RESULTS_NOTICE);
	await writeButton(page).click();
	for (const msg of [
		'Describe the manual pain.',
		'Describe the before and after.',
		'Describe your mission.',
		'Add a call to action.'
	]) {
		await expect(page.getByText(msg, { exact: true })).toBeVisible();
	}
	await expect(page.getByLabel('The manual pain', { exact: true })).toBeFocused();
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toHaveCount(0);
});

test('sample beats: timed table and cards, the placeholder rule, the copied script and the checklist', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'clipboard permissions can only be granted in Chromium');
	test.setTimeout(240_000);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.setViewportSize({ width: 1280, height: 900 });
	await openStudio(page);
	await fillSample(page);
	await expect(page.getByRole('radio', { name: '30 seconds' })).toBeFocused();
	await expect(page.locator('[data-disclosure-status="sample"]')).toBeVisible();
	await expect(page.locator('[data-reel-results-notice]')).toHaveCount(0);

	// 30 seconds: the table from 1024px, with code-owned times.
	await writeScript(page);
	await expect(panel(page).getByText('Sample output', { exact: true }).first()).toBeVisible();
	await expect(panel(page).getByText('Must fix', { exact: true })).toHaveCount(0);
	const table = glance(page).getByRole('table');
	await expect(table).toBeVisible();
	await expect(table.locator('caption')).toHaveText('30-second reel, 6 beats');
	await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('0:00 to 0:03');
	await expect(glance(page).locator('[data-reel-cards]')).toBeHidden();
	await expect(glance(page).getByRole('heading', { name: 'B-roll shot list' })).toBeVisible();
	await expectNoPageScroll(page, 1280);

	// 375px: stacked cards, no table, no horizontal page scroll.
	await page.setViewportSize({ width: 375, height: 900 });
	await expect(glance(page).getByRole('table')).toBeHidden();
	const cards = glance(page).locator('[data-reel-cards]');
	await expect(cards).toBeVisible();
	await expect(
		cards.getByRole('heading', { name: `Hook ${MID} 0:00 to 0:03`, exact: true })
	).toBeVisible();
	await expectNoPageScroll(page, 375);
	await page.setViewportSize({ width: 1280, height: 900 });

	// 60 seconds, regenerated: the caption and the last slot follow the new length.
	await page.getByRole('radio', { name: '60 seconds' }).check();
	await expect(page.locator('[data-reel-field="cta"] [data-reel-slot]')).toHaveText('0:52 to 1:00');
	await writeScript(page);
	await expect(glance(page).getByRole('table').locator('caption')).toHaveText(
		'60-second reel, 6 beats'
	);
	await expect(
		glance(page).getByRole('table').locator('tbody tr').last().locator('td').first()
	).toHaveText('0:52 to 1:00');

	// Results left empty: the notice shows and the results beat keeps the placeholder.
	await resultsField(page).fill('');
	await expect(page.locator('[data-reel-results-notice]')).toHaveText(RESULTS_NOTICE);
	await writeScript(page);
	await expect(draft(page)).toContainText(PLACEHOLDER);
	const resultsRow = glance(page).locator('tbody tr[data-beat="results"]');
	await expect(resultsRow).toContainText(PLACEHOLDER);
	await expect(resultsRow).toContainText('Replace this with a real result before you record.');
	await expect(panel(page).getByText('Must fix', { exact: true })).toHaveCount(0);
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	// A number typed into the results beat is a result the agent didn't provide: Must fix.
	await editDraft(page, (t) => t.replace(PLACEHOLDER, 'I helped 47 families.'));
	await expect(panel(page).getByText('Must fix', { exact: true }).first()).toBeVisible();
	await expect(panel(page).getByText("Result you didn't provide").first()).toBeVisible();
	await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(glance(page).locator('tbody tr[data-beat="results"]')).toContainText('47 families');

	// Restored: Copy text is the timecoded script with the B-roll list, disclosure and checklist.
	await editDraft(page, (t) => t.replace('I helped 47 families.', PLACEHOLDER));
	await expect(panel(page).getByText('Must fix', { exact: true })).toHaveCount(0);
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');
	await copyButton(page).click();
	await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();
	const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
	expect(clip.startsWith('REEL SCRIPT (')).toBe(true);
	expect(clip.startsWith('REEL SCRIPT (60 seconds)')).toBe(true);
	expect(clip).toContain('0:52 to 1:00 CALL TO ACTION');
	expect(clip).toContain('B-ROLL SHOT LIST');
	const caption = clip.slice(clip.indexOf('ADD TO YOUR POST CAPTION'));
	expect(clip).toContain('ADD TO YOUR POST CAPTION');
	expect(caption).toContain('Avery Sample');
	expect(caption).toContain('Sample Realty');
	expect(clip).toContain('BEFORE YOU POST THIS VIDEO');
	expect(clip).toContain('[ ] I wrote or edited this script myself. AI helped draft it.');
	expect(clip.indexOf('B-ROLL SHOT LIST')).toBeLessThan(clip.indexOf('ADD TO YOUR POST CAPTION'));
	expect(clip.endsWith(FOOTNOTE)).toBe(true);

	// The checklist: 8 local boxes; ticking one changes nothing else.
	const boxes = checklist(page).getByRole('checkbox');
	await expect(boxes).toHaveCount(8);
	await expect(checklist(page)).toContainText(FOOTNOTE);
	await expect(checklist(page)).not.toContainText(/compliant|approved/i);
	const before = await copyButton(page).getAttribute('aria-disabled');
	await boxes.first().check();
	await expect(boxes.first()).toBeChecked();
	expect(await copyButton(page).getAttribute('aria-disabled')).toBe(before);
	await page.reload();
	await expect(page.locator('[data-reel-studio]')).toBeVisible();
	await expect(checklist(page).getByRole('checkbox').first()).not.toBeChecked();
});

test('the Studio hub counts the reel draft under studio-reel', async ({ page }) => {
	test.setTimeout(120_000);
	await openStudio(page);
	await fillSample(page);
	await writeScript(page);
	await expect(
		page.getByRole('region', { name: 'Draft history' }).getByText('1 saved in this browser')
	).toBeVisible();
	await page.goto('agent/studio/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	const tool = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Reel script' }) });
	await expect(tool).toContainText('1 draft saved');
});

test("the agent's own beats with no profile: no disclosure shown, every exit gated", async ({
	page
}) => {
	test.setTimeout(120_000);
	await openStudio(page);
	await fillSample(page);
	await writeScript(page);
	// Sample beats: the Avery Sample disclosure is previewed and Copy is open.
	await expect(panel(page).locator('p', { hasText: `${FOOTER_LABEL}:` })).toContainText(
		'Avery Sample'
	);
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	// Editing a beat makes them the agent's own: no disclosure, and the profile reason gates.
	await page.getByLabel('Your mission', { exact: true }).fill('I want every buyer to feel heard.');
	await expect(page.locator('[data-reel-studio] [data-sample-chip]')).toHaveCount(0);
	await expect(page.locator('[data-disclosure-status="incomplete"]')).toBeVisible();
	await expect(panel(page).locator('p', { hasText: `${FOOTER_LABEL}:` })).toHaveCount(0);
	await expect(panel(page)).not.toContainText('Avery Sample');
	await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(panel(page).getByText(PROFILE_REASON, { exact: true })).toBeVisible();
	await expect(exits(page).getByRole('link', { name: 'Open in email app' })).toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await expect(exits(page).getByRole('button', { name: 'Mark as sent' })).toHaveAttribute(
		'aria-disabled',
		'true'
	);
});

test('Clear beats asks first and focuses the first field', async ({ page }) => {
	await openStudio(page);
	await fillSample(page);
	await page.getByRole('button', { name: 'Clear beats' }).click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog.getByRole('heading', { name: 'Clear these beats?' })).toBeVisible();
	await expect(dialog).toContainText(
		"This empties the form. Drafts in Draft history aren't affected."
	);
	await expect(dialog.getByRole('button', { name: 'Keep them' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Clear beats' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByLabel('The manual pain', { exact: true })).toHaveValue('');
	await expect(page.getByRole('radio', { name: '30 seconds' })).toBeFocused();
});

for (const width of [1280, 375]) {
	test.describe(`axe at ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('filled results, empty results (placeholder), the beat view and the checklist are axe-clean', async ({
			page
		}) => {
			test.slow();
			test.setTimeout(240_000);
			await openStudio(page);
			await fillSample(page);
			await writeScript(page);
			if (width >= 1024) await expect(glance(page).getByRole('table')).toBeVisible();
			else await expect(glance(page).locator('[data-reel-cards]')).toBeVisible();
			await expect(checklist(page).getByRole('checkbox')).toHaveCount(8);
			await expectAxe(page, `filled results, ${width >= 1024 ? 'table' : 'stacked'} (${width}px)`);
			await expectNoPageScroll(page, width);

			await resultsField(page).fill('');
			await expect(page.locator('[data-reel-results-notice]')).toBeVisible();
			await writeScript(page);
			await expect(glance(page)).toContainText(PLACEHOLDER);
			await checklist(page).getByRole('checkbox').first().check();
			await expectAxe(page, `empty results, placeholder (${width}px)`);
			await expectNoPageScroll(page, width);
		});
	});
}
