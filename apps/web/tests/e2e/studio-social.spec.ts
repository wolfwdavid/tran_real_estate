import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_TAGS, announcer } from './agent-helpers';
import { fakeKey, openAiSettings, routeAnthropic, saveKey, type AiCall } from './helpers/ai-mocks';

// Social post pack (09-20, STU-02) on the real built site, both bases. Keyless runs use the
// Fixture provider (studio/social.v1 sample() built from the brief); the parse-error and axe runs
// seed a fake Anthropic key through Settings and mock the provider SSE. Every other request to a
// non-local host is aborted and recorded, and the record must stay empty: RentCast and the AI
// hosts are never reached except through the Anthropic mock.
//
// Covered: three platform cards in order, each with its count line, the Avery Sample ad-inline
// disclosure block and one Copy whose clipboard text ends with that disclosure; the Studio hub
// counts the saved pack; Draft history notes the copied platform; the Instagram over-limit gate
// with Facebook still copyable; the hashtag cap after an edit; a Must fix phrase gating one card;
// a missing section showing the parse error on that card only; the brief validation; the listing
// description source; axe before a run and after a run with one card over the limit and one
// parse error, at 1280px and 375px with no horizontal scroll.

const ROUTE = 'agent/studio/social/';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const FOOTER_LABEL = 'Added to the end of this post';
const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn'] as const;
const COUNT_LINE = /\d[\d,]* (of [\d,]+ )?characters, including your disclosure/;
const PROFILE_REASON_END = 'in your profile so your disclosure can be added.';

/** 1,990 characters of fictional, clean brief text with no digits. */
const LONG_BRIEF = 'New counters, wide windows and a covered porch. '.repeat(42).slice(0, 1990);

const SAMPLE_BRIEF =
	'Just listed: 3 bedrooms, 2 baths, updated kitchen, open house Saturday 1 to 3.';
const IG = [
	'=== INSTAGRAM ===',
	'Just listed in Harlow Springs.',
	'',
	SAMPLE_BRIEF,
	'',
	'Link in bio.',
	'=== INSTAGRAM HASHTAGS ===',
	'#JustListed #HarlowSpringsRealEstate #HarlowSprings #RealEstate'
].join('\n');
const LONG_IG = [
	'=== INSTAGRAM ===',
	`Just listed in Harlow Springs. ${'New counters, wide windows and a covered porch. '.repeat(50).trim()}`,
	'',
	'Link in bio.',
	'=== INSTAGRAM HASHTAGS ===',
	'#JustListed #HarlowSprings'
].join('\n');
const LI = [
	'=== LINKEDIN ===',
	'Just listed in Harlow Springs.',
	'',
	'3 bedrooms, 2 baths and an updated kitchen. Open house Saturday 1 to 3.',
	'',
	'#JustListed #HarlowSpringsRealEstate #RealEstate'
].join('\n');
/** A provider pack WITHOUT the FACEBOOK section. */
const PACK_NO_FACEBOOK = `${IG}\n${LI}\n`;
/** A provider pack with an over-limit Instagram caption and no FACEBOOK section. */
const PACK_LONG_NO_FACEBOOK = `${LONG_IG}\n${LI}\n`;

const panel = (page: Page) => page.getByRole('region', { name: 'Post pack' });
const card = (page: Page, platform: (typeof PLATFORMS)[number]) =>
	panel(page).locator(`article[data-platform-card="${platform.toLowerCase()}"]`);
const copyButton = (page: Page, platform: (typeof PLATFORMS)[number]) =>
	card(page, platform).getByRole('button', { name: `Copy ${platform} post` });
const writeButton = (page: Page) =>
	page.getByRole('button', { name: 'Write post pack', exact: true });
const briefBox = (page: Page) => page.getByLabel('Your brief', { exact: true });
const history = (page: Page) => page.getByRole('region', { name: 'Draft history' });

let external: string[];
let pageErrors: string[];

test.beforeEach(async ({ page }) => {
	external = [];
	pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(e.message));
	// Registered first, so a later provider mock (routeAnthropic) takes precedence for its host.
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (LOCAL_HOSTS.has(url.hostname)) return route.fallback();
		external.push(url.href);
		return route.abort();
	});
});

test.afterEach(() => {
	expect(external, 'no request may leave the local origin (except the mocked provider)').toEqual(
		[]
	);
	expect(pageErrors, 'no uncaught page errors').toEqual([]);
});

/** Opens the studio and waits until the form is interactive. */
async function openStudio(page: Page): Promise<void> {
	await page.goto(ROUTE);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toHaveText('Social post pack');
	await expect(page.locator('[data-social-studio]')).toBeVisible();
	await expect(page.getByText('Loading your studio')).toHaveCount(0);
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
}

async function useSample(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Use a sample brief' }).click();
	await expect(briefBox(page)).toHaveValue(SAMPLE_BRIEF);
	await expect(page.locator('[data-social-studio] [data-sample-chip]')).toBeVisible();
}

/** Runs the pack. The keyless Fixture streams at a reading pace, so a long brief takes a while. */
async function writePack(page: Page, timeout = 30_000): Promise<void> {
	await writeButton(page).click();
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({ timeout });
}

/** Replaces one card's post through Edit post / Done editing. */
async function editCard(
	page: Page,
	platform: (typeof PLATFORMS)[number],
	edit: (current: string) => string
): Promise<void> {
	await card(page, platform).getByRole('button', { name: 'Edit post' }).click();
	const box = card(page, platform).getByLabel(`Edit your ${platform} post`);
	await expect(box).toBeVisible();
	await box.fill(edit(await box.inputValue()));
	await card(page, platform).getByRole('button', { name: 'Done editing' }).click();
	await expect(box).toHaveCount(0);
}

/** The disclosure shown in a card's "Added to the end of this post" block. */
async function cardDisclosure(page: Page, platform: (typeof PLATFORMS)[number]): Promise<string> {
	const block = card(page, platform).locator(`[data-section-footer]`);
	await expect(block.locator('p').first()).toHaveText(FOOTER_LABEL);
	return ((await block.locator('p').nth(1).textContent()) ?? '').trim();
}

async function readClipboard(page: Page): Promise<string> {
	return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
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

/** Saves a complete Texas profile through the shipped profile page. */
async function saveProfile(page: Page): Promise<void> {
	await page.goto('agent/profile/');
	await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
	const field = (label: string) => page.getByLabel(label, { exact: true });
	await field('Full name').fill('Sample Agent');
	await field('Brokerage').fill('Example Realty');
	await field('License type').selectOption('salesperson');
	await field('License number').fill('SAMPLE-0001');
	await field('License state').selectOption('TX');
	await field('Brokerage phone').fill('(555) 555-0100');
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByTestId('profile-status')).toHaveText('Saved.');
}

/** Saves a fake Anthropic key in Settings and mocks the provider stream with `pack`. */
async function useMockedProvider(page: Page, pack: string): Promise<AiCall[]> {
	const calls = await routeAnthropic(page, { stream: pack });
	await openAiSettings(page);
	await saveKey(page, 'Anthropic', fakeKey('anthropic'));
	return calls;
}

test('the sample brief writes three checked posts, each ending with the disclosure', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'clipboard permissions can only be granted in Chromium');
	test.setTimeout(240_000);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openStudio(page);
	await expect(page.locator('[data-disclosure-status="incomplete"]')).toBeVisible();
	await useSample(page);
	await expect(page.locator('[data-disclosure-status="sample"]')).toBeVisible();

	await writePack(page);
	await expect(panel(page).getByText('Sample output', { exact: true }).first()).toBeVisible();
	const articles = panel(page).locator('article[data-platform-card]');
	await expect(articles).toHaveCount(3);
	expect(await articles.locator('h3').allTextContents()).toEqual([...PLATFORMS]);

	let disclosure = '';
	for (const platform of PLATFORMS) {
		await expect(card(page, platform).locator('[data-card-count]')).toHaveText(COUNT_LINE);
		const d = await cardDisclosure(page, platform);
		expect(d).toContain('Avery Sample');
		expect(d).toContain('Sample Realty');
		expect(d.split('\n')).toHaveLength(1);
		if (disclosure === '') disclosure = d;
		expect(d).toBe(disclosure);
		await expect(card(page, platform).getByText('Must fix', { exact: true })).toHaveCount(0);
		await expect(copyButton(page, platform)).not.toHaveAttribute('aria-disabled', 'true');
	}
	await expect(panel(page).getByTestId('generation-exits')).toHaveCount(0);

	// Copy LinkedIn: the post, a blank line, then the disclosure.
	const liExits = panel(page).getByTestId('exits-linkedin');
	await expect(liExits.locator('button, a')).toHaveCount(1);
	await liExits.getByRole('button', { name: 'Copy LinkedIn post' }).click();
	await expect(card(page, 'LinkedIn').getByText('Copied.', { exact: true })).toBeVisible();
	const clip = await readClipboard(page);
	expect(clip.endsWith(`\n\n${disclosure}`)).toBe(true);
	expect(clip).toContain('Just listed in Harlow Springs.');
	expect(clip.length).toBeGreaterThan(disclosure.length + 2);

	// Draft history: one pack row, Reviewed, with the copied platform.
	await expect(history(page).getByText('1 saved in this browser')).toBeVisible();
	await expect(history(page).getByText('Copied: LinkedIn', { exact: true })).toBeVisible();
	await expect(history(page).getByText('Reviewed', { exact: true })).toBeVisible();

	// Hashtags past the cap after an edit gate that card only.
	await editCard(page, 'Facebook', (t) => `${t} #TagOne #TagTwo #TagThree`);
	await expect(
		card(page, 'Facebook').getByText(
			'Facebook uses up to 2 hashtags. Remove 3 to copy this post.',
			{
				exact: true
			}
		)
	).toBeVisible();
	await expect(copyButton(page, 'Facebook')).toHaveAttribute('aria-disabled', 'true');
	await expect(copyButton(page, 'Instagram')).not.toHaveAttribute('aria-disabled', 'true');

	// A Must fix phrase in the LinkedIn post gates LinkedIn only.
	await editCard(page, 'LinkedIn', (t) => `In a family-friendly neighborhood. ${t}`);
	await expect(card(page, 'LinkedIn').getByText('Must fix', { exact: true }).first()).toBeVisible();
	await expect(
		card(page, 'LinkedIn').getByRole('button', { name: /family-friendly neighborhood/ })
	).toBeVisible();
	await expect(copyButton(page, 'LinkedIn')).toHaveAttribute('aria-disabled', 'true');
	await expect(copyButton(page, 'Instagram')).not.toHaveAttribute('aria-disabled', 'true');
	await expect(card(page, 'Instagram').getByText('Must fix', { exact: true })).toHaveCount(0);

	// The Studio hub counts the saved pack under studio-social.
	await page.goto('agent/studio/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	const tool = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('heading', { name: 'Social post pack' }) });
	await expect(tool).toContainText('1 draft saved');
});

test('an Instagram post over 2,200 characters cannot be copied; Facebook still can', async ({
	page
}) => {
	test.setTimeout(300_000);
	await saveProfile(page);
	await openStudio(page);
	await expect(page.locator('[data-disclosure-status="ready"]')).toBeVisible();
	expect(LONG_BRIEF).toHaveLength(1990);
	await briefBox(page).fill(LONG_BRIEF);
	await page.getByLabel('City or area for hashtags', { exact: true }).fill('Harlow Springs');
	await writePack(page, 180_000);

	await expect(copyButton(page, 'Instagram')).toHaveAttribute('aria-disabled', 'true');
	await expect(
		card(page, 'Instagram').getByText(
			/\d[\d,]* characters over Instagram's limit\. Shorten the post to copy it\./
		)
	).toBeVisible();
	await expect(card(page, 'Instagram').locator('[data-card-count]')).toContainText(
		"characters over Instagram's limit. Shorten the post."
	);
	await expect(copyButton(page, 'Facebook')).not.toHaveAttribute('aria-disabled', 'true');
	await expect(copyButton(page, 'LinkedIn')).not.toHaveAttribute('aria-disabled', 'true');
	// The agent's own disclosure, not the sample agent's.
	expect(await cardDisclosure(page, 'Facebook')).toContain('Example Realty');
});

test('an incomplete profile gates every Copy once the brief is the agent own', async ({ page }) => {
	await openStudio(page);
	await briefBox(page).fill('Open house Sunday 2 to 4. Updated kitchen and a covered porch.');
	await writePack(page);
	for (const platform of PLATFORMS) {
		await expect(copyButton(page, platform)).toHaveAttribute('aria-disabled', 'true');
		await expect(
			card(page, platform).getByText(new RegExp(`${PROFILE_REASON_END}$`))
		).toBeVisible();
	}
});

test('a missing section shows the parse error on that card only', async ({ page }) => {
	test.setTimeout(240_000);
	const calls = await useMockedProvider(page, PACK_NO_FACEBOOK);
	await openStudio(page);
	await useSample(page);
	await writePack(page);
	expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
	await expect(panel(page).getByText('Sample output', { exact: true })).toHaveCount(0);

	await expect(
		card(page, 'Facebook').getByText("The Facebook post didn't come through", { exact: true })
	).toBeVisible();
	await expect(copyButton(page, 'Facebook')).toHaveAttribute('aria-disabled', 'true');
	for (const platform of ['Instagram', 'LinkedIn'] as const) {
		await expect(card(page, platform).getByText(/didn't come through/)).toHaveCount(0);
		await expect(copyButton(page, platform)).not.toHaveAttribute('aria-disabled', 'true');
	}
});

test('the brief is validated before any request', async ({ page }) => {
	await openStudio(page);
	await writeButton(page).click();
	await expect(page.getByText('Write a short brief.', { exact: true })).toBeVisible();
	await expect(briefBox(page)).toBeFocused();
	await expect(briefBox(page)).toHaveAttribute('aria-invalid', 'true');
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toHaveCount(0);

	await briefBox(page).fill('Open house Saturday.');
	const link = page.getByLabel('Link to include (optional)', { exact: true });
	await link.fill('yourname');
	await writeButton(page).click();
	await expect(
		page.getByText("This link doesn't look right. Check it, like https://yourname.com.", {
			exact: true
		})
	).toBeVisible();
	await expect(link).toBeFocused();
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toHaveCount(0);
});

test('a listing description can start the brief, without its disclosure', async ({ page }) => {
	test.setTimeout(240_000);
	// One listing description in Draft history (keyless).
	await page.goto('agent/studio/listing/');
	await expect(page.locator('[data-listing-studio]')).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
	await page.getByRole('button', { name: 'Fill with sample facts' }).click();
	await page.getByRole('button', { name: 'Write description', exact: true }).click();
	const listingPanel = page.getByRole('region', { name: 'Listing description' });
	await expect(listingPanel.getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 30_000
	});
	const listingText = (
		(await listingPanel.locator('[data-generation-output]').first().textContent()) ?? ''
	).trim();
	expect(listingText.length).toBeGreaterThan(40);

	await openStudio(page);
	const source = page.getByLabel('Start from a listing description (optional)', { exact: true });
	const options = await source.locator('option').allTextContents();
	expect(options[0]).toBe("Don't use one");
	expect(options).toHaveLength(2);
	expect(options[1]).toMatch(/^[A-Z][a-z]{2} \d{1,2} \S /);
	await source.selectOption({ index: 1 });
	await expect(announcer(page)).toHaveText('Listing description copied into your brief.');
	const brief = await briefBox(page).inputValue();
	expect(brief.length).toBeGreaterThan(40);
	expect(brief).not.toContain('Lic. #');
	expect(brief).not.toContain('Avery Sample');
});

for (const width of [1280, 375]) {
	test.describe(`axe at ${width}px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('before a run, and after a run with one card over the limit and one parse error', async ({
			page
		}) => {
			test.slow();
			test.setTimeout(300_000);
			await useMockedProvider(page, PACK_LONG_NO_FACEBOOK);
			await openStudio(page);
			await expectAxe(page, `before a run (${width}px)`);
			await expectNoPageScroll(page, width);

			await useSample(page);
			await writePack(page);
			await expect(copyButton(page, 'Instagram')).toHaveAttribute('aria-disabled', 'true');
			await expect(
				card(page, 'Instagram').getByText(/over Instagram's limit\. Shorten the post to copy it\./)
			).toBeVisible();
			await expect(
				card(page, 'Facebook').getByText("The Facebook post didn't come through", { exact: true })
			).toBeVisible();
			await expect(copyButton(page, 'LinkedIn')).not.toHaveAttribute('aria-disabled', 'true');
			await expectAxe(page, `after a run (${width}px)`);
			await expectNoPageScroll(page, width);

			await page.getByRole('button', { name: 'Clear brief' }).click();
			const dialog = page.getByRole('alertdialog');
			await expect(dialog.getByRole('heading', { name: 'Clear this brief?' })).toBeVisible();
			await expectAxe(page, `Clear confirm (${width}px)`);
			await dialog.getByRole('button', { name: 'Clear brief' }).click();
			await expect(dialog).toBeHidden();
			await expect(briefBox(page)).toHaveValue('');
			await expectNoPageScroll(page, width);
		});
	});
}
