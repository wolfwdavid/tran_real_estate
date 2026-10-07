import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_TAGS } from './agent-helpers';

// Listing description studio (09-15, STU-01) on the real built site, both bases, keyless: with no
// AI key the Phase 5 GenerationPanel uses the Fixture provider, whose text is built from the
// agent's facts by studio/listing.v1 sample(). Every request to a non-local host is aborted and
// recorded; RentCast and every AI provider host must stay at zero.
//
// Covered: no steering fields on the page; the run control validates first (no generation, focus
// on the first invalid field); sample facts write a draft with zero Must fix findings; Copy text
// ends with the Avery Sample ad-block disclosure shown under the draft; a typed problem phrase
// gates Copy until "Use alternative"; the profile gate returns once the sample facts are edited;
// axe in five states at 1280px and 375px with no horizontal scroll.

const ROUTE = 'agent/studio/listing/';
const PROVIDER_HOSTS = [
	'api.rentcast.io',
	'api.anthropic.com',
	'api.openai.com',
	'generativelanguage.googleapis.com',
	'openrouter.ai'
];
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

const FOOTER_LABEL = 'Added to the end of this description';
const BLOCK_REASON = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
const PROFILE_REASON =
	'Add your full name, brokerage, license type, license number, and license state in your profile so your disclosure can be added.';

const panel = (page: Page) => page.getByRole('region', { name: 'Listing description' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const exits = (page: Page) => panel(page).getByTestId('generation-exits');
const copyButton = (page: Page) => exits(page).getByRole('button', { name: 'Copy text' });
const writeButton = (page: Page) =>
	page.getByRole('button', { name: 'Write description', exact: true });
const footer = (page: Page) => panel(page).locator('p', { hasText: `${FOOTER_LABEL}:` });

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
	expect(providerHits, 'the listing studio must never reach RentCast or an AI provider').toEqual(
		[]
	);
	expect(external, 'no request may leave the local origin').toEqual([]);
	expect(pageErrors, 'no uncaught page errors').toEqual([]);
});

/** Opens the studio and waits until the form is interactive. */
async function openStudio(page: Page): Promise<void> {
	await page.goto(ROUTE);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toHaveText('Listing description');
	await expect(page.locator('[data-listing-studio]')).toBeVisible();
	await expect(page.getByText('Loading your studio')).toHaveCount(0);
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
}

async function fillSample(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Fill with sample facts' }).click();
	await expect(page.getByLabel('Street or area name')).toHaveValue('12 Example Lane');
	await expect(page.locator('[data-listing-studio] [data-sample-chip]')).toBeVisible();
}

async function writeDraft(page: Page): Promise<void> {
	await writeButton(page).click();
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 30_000
	});
}

/** Appends text to the draft through Edit draft / Done editing. */
async function appendToDraft(page: Page, extra: string): Promise<void> {
	await panel(page).getByRole('button', { name: 'Edit draft' }).click();
	const box = panel(page).getByLabel('Edit your draft');
	await expect(box).toBeVisible();
	await box.fill((await box.inputValue()) + extra);
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

test('the page asks for property facts only', async ({ page }) => {
	await openStudio(page);
	for (const steer of [/school/i, /crime/i, /safety/i, /worship|church|religio/i, /demograph/i]) {
		await expect(page.getByLabel(steer)).toHaveCount(0);
	}
	for (const legend of ['The home', 'Features', 'Nearby', 'Style']) {
		await expect(page.locator('legend', { hasText: new RegExp(`^${legend}$`) })).toHaveCount(1);
	}
	await expect(page.locator('[data-disclosure-status="incomplete"]')).toBeVisible();
	await expect(draft(page)).toContainText('Your draft will appear here.');
});

test('Write description on an empty form makes no request and focuses the first invalid field', async ({
	page
}) => {
	await openStudio(page);
	await writeButton(page).click();
	await expect(page.getByText('Choose For sale or For rent.', { exact: true })).toBeVisible();
	await expect(page.getByText('Choose a property type.', { exact: true })).toBeVisible();
	await expect(page.getByRole('radio', { name: 'For sale' })).toBeFocused();
	await expect(draft(page)).toContainText('Your draft will appear here.');
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toHaveCount(0);
	await expect(writeButton(page)).toBeVisible();

	// Choosing a value clears that field's error.
	await page.getByRole('radio', { name: 'For rent' }).check();
	await expect(page.getByText('Choose For sale or For rent.', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Monthly rent')).toBeVisible();
});

test('sample facts: a checked draft, the disclosure on Copy, and a gated problem phrase', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'clipboard permissions can only be granted in Chromium');
	test.setTimeout(180_000);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openStudio(page);
	await fillSample(page);
	await expect(page.getByRole('radio', { name: 'For sale' })).toBeFocused();
	await expect(page.locator('[data-disclosure-status="sample"]')).toBeVisible();

	await writeDraft(page);
	await expect(panel(page).getByText('Sample output', { exact: true }).first()).toBeVisible();
	await expect(draft(page)).not.toContainText('Your draft will appear here.');
	await expect(panel(page).getByText('Must fix', { exact: true })).toHaveCount(0);
	await expect(panel(page).getByText('Number check passed', { exact: true })).toBeVisible();
	await expect(panel(page).getByText('Facts check passed', { exact: true })).toBeVisible();
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	// The read-only disclosure block under the draft is the Avery Sample ad-block disclosure.
	const block = ((await footer(page).textContent()) ?? '').trim();
	expect(block.startsWith(`${FOOTER_LABEL}: `)).toBe(true);
	const disclosure = block.slice(`${FOOTER_LABEL}: `.length);
	expect(disclosure).toContain('Avery Sample');
	expect(disclosure).toContain('Sample Realty');
	expect(disclosure).toContain('SAMPLE-0001');
	expect(disclosure.split('\n').length).toBeGreaterThan(1);

	// Count line: words, characters, and the with-disclosure count.
	const counts = page.locator('[data-listing-count]');
	await expect(counts).toContainText(
		/\d+ words .+ characters\. With your disclosure: [\d,]+ characters\./
	);

	// Copy text: the draft, a blank line, then the disclosure.
	await copyButton(page).click();
	await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();
	const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
	expect(clip.endsWith(`\n\n${disclosure}`)).toBe(true);
	expect(clip.length).toBeGreaterThan(disclosure.length + 2);

	// A problem phrase typed into the draft is flagged and gates Copy.
	await appendToDraft(page, ' Perfect for young professionals.');
	const trigger = draft(page).getByRole('button', { name: /Perfect for young professionals/ });
	await expect(trigger).toBeVisible();
	await expect(panel(page).getByText('Must fix', { exact: true }).first()).toBeVisible();
	await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(panel(page).getByText(BLOCK_REASON, { exact: true })).toBeVisible();

	// Use alternative fixes it and Copy is enabled again.
	await trigger.click();
	const useAlternative = page.getByRole('dialog').getByRole('button', { name: 'Use alternative' });
	await expect(useAlternative).toBeFocused();
	await useAlternative.click();
	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(draft(page)).not.toContainText('young professionals');
	await expect(panel(page).getByText(BLOCK_REASON, { exact: true })).toHaveCount(0);
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	// Editing a sample fact drops the sample state: the profile gate applies again.
	await page.getByRole('radio', { name: 'Concise' }).check();
	await expect(page.locator('[data-listing-studio] [data-sample-chip]')).toHaveCount(0);
	await expect(page.locator('[data-disclosure-status="incomplete"]')).toBeVisible();
	await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(panel(page).getByText(PROFILE_REASON, { exact: true })).toBeVisible();
	await page.getByRole('radio', { name: 'Warm' }).check();
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');
});

test('the form autosaves and comes back after a reload', async ({ page }) => {
	await openStudio(page);
	await fillSample(page);
	await page.getByLabel('Bedrooms').fill('4');
	await page.getByLabel('Bedrooms').blur();
	// The 500 ms autosave debounce, then a reload.
	await page.waitForTimeout(1_200);
	await page.reload();
	await expect(page.locator('[data-listing-studio]')).toBeVisible();
	await expect(page.getByLabel('Bedrooms')).toHaveValue('4');
	await expect(page.getByLabel('Street or area name')).toHaveValue('12 Example Lane');
});

for (const width of [1280, 375]) {
	test.describe(`axe at ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test(`empty, sample-filled, findings, edit mode and Clear confirm are axe-clean`, async ({
			page
		}) => {
			test.slow();
			test.setTimeout(240_000);
			await openStudio(page);
			await expectAxe(page, `empty form (${width}px)`);
			await expectNoPageScroll(page, width);

			await fillSample(page);
			await expectAxe(page, `sample-filled (${width}px)`);
			await expectNoPageScroll(page, width);

			// One Must fix (Fair Housing) and Review findings (an unsupported feature and a number
			// written as a word).
			await writeDraft(page);
			await appendToDraft(
				page,
				' Perfect for young professionals. A fireplace. Rents rose twelve percent.'
			);
			await expect(panel(page).getByText('Must fix', { exact: true }).first()).toBeVisible();
			await expect(panel(page).getByText('Review', { exact: true }).first()).toBeVisible();
			await expect(panel(page).getByText(/^Facts check: \d+ to review$/)).toBeVisible();
			await expect(panel(page).getByText(/^Numbers as words: \d+ to review$/)).toBeVisible();
			await expectAxe(page, `findings (${width}px)`);
			await expectNoPageScroll(page, width);

			await panel(page).getByRole('button', { name: 'Edit draft' }).click();
			await expect(panel(page).getByLabel('Edit your draft')).toBeVisible();
			await expectAxe(page, `edit mode (${width}px)`);
			await expectNoPageScroll(page, width);
			await panel(page).getByRole('button', { name: 'Done editing' }).click();

			await page.getByRole('button', { name: 'Clear facts' }).click();
			const dialog = page.getByRole('alertdialog');
			await expect(dialog).toBeVisible();
			await expect(dialog.getByRole('heading', { name: 'Clear these facts?' })).toBeVisible();
			await expectAxe(page, `Clear confirm (${width}px)`);
			await dialog.getByRole('button', { name: 'Clear facts' }).click();
			await expect(dialog).toBeHidden();
			await expect(page.getByLabel('Street or area name')).toHaveValue('');
			await expect(page.getByRole('radio', { name: 'For sale' })).toBeFocused();
			await expectNoPageScroll(page, width);
		});
	});
}
