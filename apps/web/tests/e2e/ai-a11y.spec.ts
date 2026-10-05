import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
	anthropicSse,
	blockAiProviders,
	fakeKey,
	openAiSettings,
	routeAnthropic,
	routeGemini,
	saveKey,
	type AiMockOptions
} from './helpers/ai-mocks';
import { announcer } from './helpers/settings';

// Phase 5 accessibility contract (05-UI-SPEC "Accessibility Contract (Phase 5 additions)"): axe
// over /settings/ in every AI state the UI-SPEC lists, on both bases, every provider mocked. One
// test per state so a failure names it. Same tag set and non-vacuity guard as a11y.spec.ts and
// settings-a11y.spec.ts. The popover and the Gemini dialog are also checked at 375px for no
// horizontal page scroll.

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	// An empty violations list is only meaningful if axe evaluated rules against real content.
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

async function expectNoPageScrollAt375(page: Page, label: string): Promise<void> {
	const width = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(width, `page scrollWidth on ${label}`).toBeLessThanOrEqual(375);
}

const section = (page: Page) => page.locator('#ai-drafting');
const panel = (page: Page) => section(page).getByRole('region', { name: 'Sample inquiry' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const runButton = (page: Page, name: string) =>
	panel(page).getByRole('button', { name, exact: true });
const history = (page: Page) => section(page).getByRole('region', { name: 'Draft history' });
const errorCard = (page: Page) => panel(page).locator('[data-generation-error]');

const BLOCKED =
	'Perfect for young professionals. It is walking distance to church.\nReply anytime.';
const GEMINI_TITLE = 'Send client details to Gemini?';

async function expectDraftReady(page: Page): Promise<void> {
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 20_000
	});
}

test.beforeEach(async ({ page }) => {
	await blockAiProviders(page);
});

/** Anthropic key saved and chosen, with `o` answering its endpoints. */
async function anthropicReady(page: Page, o: AiMockOptions): Promise<void> {
	await routeAnthropic(page, o);
	await openAiSettings(page);
	await saveKey(page, 'Anthropic', fakeKey('anthropic'));
	await section(page).getByRole('radio', { name: 'Anthropic' }).check();
}

/** The planted block + warn draft (Task 1 text), generated through the mocked Anthropic stream. */
async function plantedDraft(page: Page): Promise<void> {
	await anthropicReady(page, { stream: BLOCKED });
	await runButton(page, 'Generate draft').click();
	await expectDraftReady(page);
	await expect(
		panel(page).getByText('Fair Housing check: 1 to fix, 1 to review', { exact: true })
	).toBeVisible();
}

async function openBlockPopover(page: Page): Promise<void> {
	await draft(page)
		.getByRole('button', { name: /Perfect for young professionals/ })
		.click();
	const popover = page.getByRole('dialog');
	await expect(popover).toBeVisible();
	await expect(popover.getByRole('button', { name: 'Use alternative' })).toBeFocused();
}

async function openGeminiDialog(page: Page): Promise<void> {
	await routeGemini(page, { stream: 'Hello from Gemini.' });
	await openAiSettings(page);
	await saveKey(page, 'Google Gemini', fakeKey('gemini'));
	await section(page).getByRole('radio', { name: 'Google Gemini' }).check();
	await runButton(page, 'Generate draft').click();
	await expect(page.getByRole('alertdialog', { name: GEMINI_TITLE })).toBeVisible();
	await expect(page.getByRole('button', { name: "Don't send to Gemini" })).toBeFocused();
}

/** Three sample drafts: copied (Reviewed), marked as sent, and left as a Draft. */
async function historyWithAllStatuses(page: Page): Promise<void> {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await openAiSettings(page);
	await runButton(page, 'Generate draft').click();
	await expectDraftReady(page);
	await panel(page).getByRole('button', { name: 'Copy text' }).click();
	await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();
	await runButton(page, 'Generate again').click();
	await expectDraftReady(page);
	await panel(page).getByRole('button', { name: 'Mark as sent' }).click();
	await expect(panel(page).getByRole('button', { name: 'Marked as sent' })).toBeVisible();
	await runButton(page, 'Generate again').click();
	await expectDraftReady(page);
	const rows = history(page).getByRole('listitem');
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(0).getByText('Draft', { exact: true })).toBeVisible();
	await expect(rows.nth(1).getByText('Marked as sent', { exact: true })).toBeVisible();
	await expect(rows.nth(2).getByText('Reviewed', { exact: true })).toBeVisible();
}

// ---- 1. No AI keys ----

test('1. no AI keys: sample notice and empty Draft history are axe clean', async ({ page }) => {
	await openAiSettings(page);
	await expect(
		section(page).getByText('No AI key yet, so drafts use sample output.', { exact: false })
	).toBeVisible();
	await expect(history(page).getByText('No drafts yet.', { exact: false })).toBeVisible();
	await expectAxeClean(page, 'AI drafting with no keys');
});

// ---- 2. Test connection outcomes ----

const TEST_OUTCOMES: { name: string; mock: AiMockOptions; expected: string }[] = [
	{
		name: 'ok, model listed',
		mock: { models: ['claude-sonnet-5-5'] },
		expected: 'Model claude-sonnet-5-5 is available.'
	},
	{
		name: 'ok, model not listed',
		mock: { models: ['claude-other-model'] },
		expected: "Anthropic didn't list claude-sonnet-5-5 for this key."
	},
	{
		name: 'cors-blocked',
		mock: { models: ['claude-sonnet-5-5'], canaryStatus: 'abort' },
		expected: 'Anthropic is blocking browser access from this site right now.'
	},
	{
		name: 'auth',
		mock: { modelsStatus: 401, modelsError: { error: { type: 'authentication_error' } } },
		expected: "Anthropic didn't accept this key."
	},
	{
		name: 'quota',
		mock: { modelsStatus: 429, modelsError: { error: { type: 'rate_limit_error' } } },
		expected: 'Your Anthropic account has hit a usage or billing limit.'
	},
	{
		name: 'network',
		mock: { modelsStatus: 'abort' },
		expected: "Couldn't reach api.anthropic.com."
	}
];

for (const [i, o] of TEST_OUTCOMES.entries()) {
	test(`2.${i + 1} Test connection ${o.name} is axe clean`, async ({ page }) => {
		await anthropicReady(page, o.mock);
		const card = page.locator('#key-anthropic');
		await card.getByRole('button', { name: 'Test connection' }).click();
		await expect(card).toContainText(o.expected);
		await expectAxeClean(page, `Test connection ${o.name}`);
	});
}

// ---- 3-4. Streaming and stopped (keyless sample provider) ----

test('3. panel streaming is axe clean', async ({ page }) => {
	await openAiSettings(page);
	await runButton(page, 'Generate draft').click();
	await expect(runButton(page, 'Stop')).toBeVisible();
	await expect(panel(page)).toHaveAttribute('aria-busy', 'true');
	await expect(draft(page)).toContainText('Hi,');
	await expectAxeClean(page, 'panel streaming');
});

test('4. panel stopped with partial text is axe clean', async ({ page }) => {
	await openAiSettings(page);
	await runButton(page, 'Generate draft').click();
	await expect(draft(page)).toContainText('Hi,');
	await runButton(page, 'Stop').click();
	await expect(
		panel(page).getByText(
			'Stopped. The partial draft is kept, so you can edit it, use it, or generate again.',
			{ exact: true }
		)
	).toBeVisible();
	await expectAxeClean(page, 'panel stopped');
});

// ---- 5-7. Planted findings, acknowledgement, edit mode ----

test('5. block + warn draft with the finding popover open is axe clean', async ({ page }) => {
	await plantedDraft(page);
	await openBlockPopover(page);
	await expectAxeClean(page, 'planted findings, popover open');
});

test('5b. at 375px the popover fits and the page never scrolls sideways', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await plantedDraft(page);
	await openBlockPopover(page);
	await expectNoPageScrollAt375(page, 'popover open at 375px');
	const box = await page.getByRole('dialog').boundingBox();
	expect(box, 'popover box').not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	await expectAxeClean(page, 'popover open at 375px');
});

test('6. acknowledgement visible after the block is fixed is axe clean', async ({ page }) => {
	await plantedDraft(page);
	await openBlockPopover(page);
	await page.getByRole('dialog').getByRole('button', { name: 'Use alternative' }).click();
	await expect(
		panel(page).getByRole('checkbox', {
			name: "I've reviewed the flagged phrases. They describe the property, not who should live there."
		})
	).toBeVisible();
	await expect(
		panel(page).getByText('Review the flagged phrases and check the box above to continue.', {
			exact: true
		})
	).toBeVisible();
	await expectAxeClean(page, 'acknowledgement visible');
});

test('7. edit mode is axe clean', async ({ page }) => {
	await plantedDraft(page);
	await runButton(page, 'Edit draft').click();
	const box = panel(page).getByLabel('Edit your draft', { exact: true });
	await expect(box).toBeFocused();
	await expect(runButton(page, 'Done editing')).toBeVisible();
	await expectAxeClean(page, 'edit mode');
});

// ---- 8. Each GenerationError ----

const ERRORS: {
	name: string;
	mock: AiMockOptions;
	title: string;
	offline?: boolean;
}[] = [
	{
		name: 'cors-blocked',
		mock: { stream: 'abort', models: [] },
		title: 'Anthropic is blocking this site right now'
	},
	{
		name: 'auth',
		mock: { stream: { status: 401, body: { error: { type: 'authentication_error' } } } },
		title: "Anthropic didn't accept your key"
	},
	{
		name: 'quota',
		mock: { stream: { status: 429, body: { error: { type: 'rate_limit_error' } } } },
		title: 'Your Anthropic account hit a limit'
	},
	{
		name: 'network',
		mock: { stream: 'abort', modelsStatus: 'abort' },
		title: "Couldn't reach Anthropic",
		offline: true
	},
	{
		name: 'model-not-found',
		mock: {
			stream: {
				status: 404,
				body: { error: { type: 'not_found_error', message: 'model: claude-sonnet-5-5' } }
			}
		},
		title: "Anthropic doesn't recognize this model"
	},
	{
		name: 'refused',
		mock: { stream: { rawSse: anthropicSse('I can', 1, 'refusal') } },
		title: 'Anthropic declined to write this draft'
	}
];

for (const [i, e] of ERRORS.entries()) {
	test(`8.${i + 1} GenerationError ${e.name} is axe clean`, async ({ page }) => {
		await anthropicReady(page, e.mock);
		if (e.offline) {
			// The browser reports offline, so an unreachable key check reads as a network failure
			// (disambiguateFetchFailure), without cutting the page off from its own JS chunks.
			await page.evaluate(() =>
				Object.defineProperty(Navigator.prototype, 'onLine', {
					configurable: true,
					get: () => false
				})
			);
		}
		await runButton(page, 'Generate draft').click();
		await expect(errorCard(page)).toBeVisible();
		await expect(errorCard(page)).toContainText(e.title);
		await expectAxeClean(page, `GenerationError ${e.name}`);
	});
}

const PASS = ['quiet', 'harbor', 'lantern', 'seven'].join(' ');

test('8.7 GenerationError locked is axe clean', async ({ page, context }) => {
	// Remember mode + an Anthropic key chosen as the provider + a passphrase lock, then a new tab
	// where the vault starts locked.
	await openAiSettings(page);
	const security = page.locator('#key-security');
	await security.getByRole('radio', { name: 'Remember on this device', exact: true }).click();
	await expect(announcer(page)).toHaveText('Keys will be remembered on this device.');
	await saveKey(page, 'Anthropic', fakeKey('anthropic'));
	await section(page).getByRole('radio', { name: 'Anthropic' }).check();
	await security.getByRole('button', { name: 'Add a passphrase' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Passphrase', { exact: true }).fill(PASS);
	await dialog.getByLabel('Confirm passphrase', { exact: true }).fill(PASS);
	await dialog.getByRole('checkbox').check();
	await dialog.getByRole('button', { name: 'Lock keys' }).click();
	await expect(dialog).toBeHidden();

	const locked = await context.newPage();
	await blockAiProviders(locked);
	const calls = await routeAnthropic(locked, { stream: 'This must never be requested.' });
	await openAiSettings(locked);
	await expect(
		locked.locator('#key-security').getByRole('button', { name: 'Unlock keys' })
	).toBeVisible();
	await runButton(locked, 'Generate draft').click();
	await expect(errorCard(locked)).toContainText('Your keys are locked');
	await expect(errorCard(locked).getByRole('link', { name: 'Unlock in Settings' })).toBeVisible();
	expect(calls).toHaveLength(0);
	await expectAxeClean(locked, 'GenerationError locked');
});

// ---- 9. Gemini dialog ----

test('9. Gemini dialog open is axe clean', async ({ page }) => {
	await openGeminiDialog(page);
	await expectAxeClean(page, 'Gemini dialog open');
});

test('9b. at 375px the Gemini dialog fits and the page never scrolls sideways', async ({
	page
}) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await openGeminiDialog(page);
	await expectNoPageScrollAt375(page, 'Gemini dialog at 375px');
	const box = await page.getByRole('alertdialog', { name: GEMINI_TITLE }).boundingBox();
	expect(box, 'dialog box').not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(375);
	await expectAxeClean(page, 'Gemini dialog at 375px');
});

// ---- 10-11. Draft history ----

test('10. Draft history with all three statuses is axe clean', async ({ page }) => {
	await historyWithAllStatuses(page);
	await expectAxeClean(page, 'Draft history with Draft, Reviewed and Marked as sent');
});

test('11. delete confirmation open is axe clean', async ({ page }) => {
	await historyWithAllStatuses(page);
	await history(page).getByRole('listitem').first().getByRole('button', { name: 'Delete' }).click();
	const confirm = page.getByRole('alertdialog', { name: 'Delete this draft?' });
	await expect(confirm).toBeVisible();
	await expect(confirm.getByRole('button', { name: 'Keep draft' })).toBeFocused();
	await expectAxeClean(page, 'delete confirmation open');
});
