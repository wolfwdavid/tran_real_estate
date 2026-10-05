import { test, expect, type Page } from '@playwright/test';
import {
	blockAiProviders,
	countRequests,
	fakeKey,
	openAiSettings,
	routeAnthropic,
	routeGemini,
	saveKey
} from './helpers/ai-mocks';
import { announcer } from './helpers/settings';

// Phase 5 guardrails in a real browser (05-16), both bases, every provider mocked:
// - AI-02 / AI-04: a Must fix phrase gates all three exits (aria-disabled, no email href, the
//   reason line), Use alternative fixes it, the acknowledgement unlocks the exits, and Copy puts
//   exactly the draft on the clipboard. Exits are only ever human clicks.
// - AI-03: a live Gemini run with client details asks first, focus starts on "Don't send to
//   Gemini", cancel paths send nothing, and the "don't ask again" choice lives in sessionStorage
//   only (never localStorage, never past the tab).
// - Draft history statuses, Mark as not sent, and the delete confirmation.
// - The sample output toggle overrides a saved key: no provider request at all.

test.describe.configure({ timeout: 120_000 });

const section = (page: Page) => page.locator('#ai-drafting');
const panel = (page: Page) => section(page).getByRole('region', { name: 'Sample inquiry' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const exits = (page: Page) => panel(page).getByTestId('generation-exits');
const runButton = (page: Page, name: string) =>
	panel(page).getByRole('button', { name, exact: true });
const history = (page: Page) => section(page).getByRole('region', { name: 'Draft history' });

const copyButton = (page: Page) => exits(page).getByRole('button', { name: 'Copy text' });
const emailLink = (page: Page) => exits(page).getByRole('link', { name: 'Open in email app' });
const markButton = (page: Page) => exits(page).getByRole('button', { name: /^Mark(ed)? as sent$/ });

const BLOCKED =
	'Perfect for young professionals. It is walking distance to church.\nReply anytime.';
const FIXED = 'Close to transit and downtown. It is walking distance to church.\nReply anytime.';
const BLOCK_REASON = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
const WARN_REASON = 'Review the flagged phrases and check the box above to continue.';
const ACK =
	"I've reviewed the flagged phrases. They describe the property, not who should live there.";
const GEMINI_TITLE = 'Send client details to Gemini?';
const DONT_SEND = "Don't send to Gemini";

const SAVED_KEYS = [fakeKey('anthropic'), fakeKey('gemini')];

/** Clipboard text with line breaks normalized (the Windows clipboard hands text back as CRLF). */
async function readClipboard(page: Page): Promise<string> {
	const text = await page.evaluate(() => navigator.clipboard.readText());
	return text.replace(/\r\n/g, '\n');
}

/** Waits for a finished sample or live draft. */
async function expectDraftReady(page: Page): Promise<void> {
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 20_000
	});
}

test.describe('AI guardrails', () => {
	let urls: string[] = [];

	test.beforeEach(async ({ page }) => {
		await blockAiProviders(page);
		urls = [];
		page.on('request', (r) => urls.push(r.url()));
	});

	// No key in any URL (Pitfall 10), in every flow below.
	test.afterEach(() => {
		expect(urls.length).toBeGreaterThan(0);
		for (const url of urls) {
			for (const key of SAVED_KEYS) expect(url).not.toContain(key);
			expect(url).not.toMatch(/[?&]key=/);
		}
	});

	test('a Must fix phrase gates every exit until it is fixed and the rest acknowledged', async ({
		page,
		context
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const calls = await routeAnthropic(page, { stream: BLOCKED });
		await openAiSettings(page);
		await saveKey(page, 'Anthropic', fakeKey('anthropic'));
		await section(page).getByRole('radio', { name: 'Anthropic' }).check();
		await runButton(page, 'Generate draft').click();
		await expectDraftReady(page);
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);

		// Findings + gated exits.
		await expect(
			panel(page).getByText('Fair Housing check: 1 to fix, 1 to review', { exact: true })
		).toBeVisible();
		await expect(exits(page).locator('button, a')).toHaveCount(3);
		for (const exit of [copyButton(page), emailLink(page), markButton(page)]) {
			await expect(exit).toHaveAttribute('aria-disabled', 'true');
		}
		await expect(markButton(page)).toHaveText('Mark as sent');
		await expect(emailLink(page)).not.toHaveAttribute('href');
		await expect(panel(page).getByText(BLOCK_REASON, { exact: true })).toBeVisible();

		// A gated Copy writes nothing: the clipboard keeps what was there.
		// (aria-disabled keeps the button focusable, so a keyboard user can still press it.)
		await page.evaluate(() => navigator.clipboard.writeText('sentinel'));
		await copyButton(page).focus();
		await page.keyboard.press('Enter');
		expect(await readClipboard(page)).toBe('sentinel');
		await expect(announcer(page)).toHaveText(BLOCK_REASON);

		// The inline trigger opens the finding popover with focus on its primary action.
		const trigger = draft(page).getByRole('button', { name: /Perfect for young professionals/ });
		await trigger.click();
		const popover = page.getByRole('dialog');
		await expect(popover).toBeVisible();
		await expect(popover.getByText('Must fix', { exact: true })).toBeVisible();
		await expect(popover.getByText('Category: Familial status', { exact: true })).toBeVisible();
		await expect(popover.getByText('Suggested wording:', { exact: true })).toBeVisible();
		const useAlternative = popover.getByRole('button', { name: 'Use alternative' });
		await expect(useAlternative).toBeFocused();

		// Escape closes it and returns focus to the trigger.
		await page.keyboard.press('Escape');
		await expect(popover).toBeHidden();
		await expect(trigger).toBeFocused();

		// Reopen and apply the alternative.
		await trigger.click();
		await expect(
			page.getByRole('dialog').getByRole('button', { name: 'Use alternative' })
		).toBeFocused();
		await page.getByRole('dialog').getByRole('button', { name: 'Use alternative' }).click();
		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(draft(page)).toContainText('Close to transit and downtown.');
		await expect(draft(page)).not.toContainText('young professionals');
		await expect(
			panel(page).getByText('Fair Housing check: 1 to review', { exact: true })
		).toBeVisible();

		// Only a Review flag is left: the acknowledgement is the remaining gate.
		const ack = panel(page).getByRole('checkbox', { name: ACK });
		await expect(ack).toBeVisible();
		await expect(panel(page).getByText(WARN_REASON, { exact: true })).toBeVisible();
		await expect(panel(page).getByText(BLOCK_REASON, { exact: true })).toHaveCount(0);
		await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
		await ack.check();
		for (const exit of [copyButton(page), emailLink(page), markButton(page)]) {
			await expect(exit).not.toHaveAttribute('aria-disabled', 'true');
		}
		await expect(panel(page).getByText(WARN_REASON, { exact: true })).toHaveCount(0);

		// Copy puts exactly the fixed draft on the clipboard.
		await copyButton(page).click();
		await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();
		expect(await readClipboard(page)).toBe(FIXED);

		// Open in email app: a mailto: link carrying the draft (CRLF line breaks). The navigation
		// itself is cancelled in the page so no external handler opens; the app's click handler
		// still runs.
		const href = await emailLink(page).getAttribute('href');
		expect(href).not.toBeNull();
		expect(href!.startsWith('mailto:')).toBe(true);
		expect(href).toContain('Close%20to%20transit%20and%20downtown.');
		expect(href).toContain('%0D%0A');
		await page.evaluate(() =>
			window.addEventListener(
				'click',
				(e) => {
					if ((e.target as Element | null)?.closest('a[href^="mailto:"]')) e.preventDefault();
				},
				{ capture: true }
			)
		);
		await emailLink(page).click();
		await expect(
			panel(page).getByText(
				"Opened in your email app. Tran doesn't send it. Review it there and press send yourself.",
				{ exact: true }
			)
		).toBeVisible();

		// Mark as sent is a local note: pressed state + label change.
		await markButton(page).click();
		await expect(markButton(page)).toHaveText('Marked as sent');
		await expect(markButton(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(
			history(page).getByRole('listitem').first().getByText('Marked as sent', { exact: true })
		).toBeVisible();

		// Still exactly one generation: no exit ever reached the provider.
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
	});

	test('Gemini asks before sending client details, and the acknowledgement is session-only', async ({
		page,
		browser
	}, testInfo) => {
		const generations = countRequests(page, ':streamGenerateContent');
		const gemini = countRequests(page, 'generativelanguage.googleapis.com');
		const calls = await routeGemini(page, { stream: 'Hello from Gemini.' });
		await openAiSettings(page);
		await saveKey(page, 'Google Gemini', fakeKey('gemini'));
		await section(page).getByRole('radio', { name: 'Google Gemini' }).check();

		const dialog = page.getByRole('alertdialog', { name: GEMINI_TITLE });
		const generate = runButton(page, 'Generate draft');

		// 1. Escape = Don't send.
		await generate.click();
		await expect(dialog).toBeVisible();
		await expect(page.getByRole('button', { name: DONT_SEND })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(
			panel(page).getByText('Canceled. Nothing was sent to Google.', { exact: true })
		).toBeVisible();
		await expect(generate).toBeFocused();
		expect(generations.count).toBe(0);

		// 2. The Don't send button.
		await generate.click();
		await expect(dialog).toBeVisible();
		await expect(page.getByRole('button', { name: DONT_SEND })).toBeFocused();
		await page.getByRole('button', { name: DONT_SEND }).click();
		await expect(dialog).toBeHidden();
		expect(generations.count).toBe(0);
		expect(gemini.count).toBe(0);

		// 3. Send, with "don't ask again until I close this tab".
		await generate.click();
		await expect(dialog).toBeVisible();
		const dontAsk = dialog.getByRole('checkbox', {
			name: "Don't ask again until I close this tab"
		});
		await expect(dontAsk).not.toBeChecked();
		await dontAsk.check();
		await dialog.getByRole('button', { name: 'Send to Gemini', exact: true }).click();
		await expectDraftReady(page);
		await expect(draft(page)).toContainText('Hello from Gemini.');
		expect(generations.count).toBe(1);
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
		expect(calls[0]?.headers['x-goog-api-key']).toBe(fakeKey('gemini'));

		const stored = await page.evaluate(() => [
			sessionStorage.getItem('tran.ai.gemini-client-data-ack'),
			Object.keys(localStorage).filter((k) => k.toLowerCase().includes('gemini'))
		]);
		expect(stored).toEqual(['1', []]);

		// 4. The session acknowledgement skips the dialog for this tab.
		await runButton(page, 'Generate again').click();
		await expectDraftReady(page);
		await expect(dialog).toHaveCount(0);
		expect(generations.count).toBe(2);

		// 5. A new browser context (a fresh session) asks again: never permanent.
		const fresh = await browser.newContext({
			baseURL: testInfo.project.use.baseURL,
			reducedMotion: 'reduce'
		});
		try {
			const other = await fresh.newPage();
			await blockAiProviders(other);
			const otherGenerations = countRequests(other, ':streamGenerateContent');
			await routeGemini(other, { stream: 'Hello again.' });
			await openAiSettings(other);
			await saveKey(other, 'Google Gemini', fakeKey('gemini'));
			await section(other).getByRole('radio', { name: 'Google Gemini' }).check();
			await runButton(other, 'Generate draft').click();
			await expect(other.getByRole('alertdialog', { name: GEMINI_TITLE })).toBeVisible();
			await expect(other.getByRole('button', { name: DONT_SEND })).toBeFocused();
			expect(
				await other.evaluate(() => sessionStorage.getItem('tran.ai.gemini-client-data-ack'))
			).toBeNull();
			expect(otherGenerations.count).toBe(0);
		} finally {
			await fresh.close();
		}
	});

	test('Draft history shows Draft, Reviewed and Marked as sent, and deletes with confirmation', async ({
		page,
		context
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await openAiSettings(page);

		// Oldest: copied (Reviewed). Middle: marked as sent. Newest: left as a draft.
		await runButton(page, 'Generate draft').click();
		await expectDraftReady(page);
		await copyButton(page).click();
		await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();

		await runButton(page, 'Generate again').click();
		await expectDraftReady(page);
		await markButton(page).click();
		await expect(markButton(page)).toHaveAttribute('aria-pressed', 'true');

		await runButton(page, 'Generate again').click();
		await expectDraftReady(page);

		const rows = history(page).getByRole('listitem');
		await expect(rows).toHaveCount(3);
		await expect(history(page).getByText('3 saved in this browser', { exact: true })).toBeVisible();
		await expect(rows.nth(0).getByText('Draft', { exact: true })).toBeVisible();
		await expect(rows.nth(1).getByText('Marked as sent', { exact: true })).toBeVisible();
		await expect(rows.nth(2).getByText('Reviewed', { exact: true })).toBeVisible();
		for (let i = 0; i < 3; i++) {
			await expect(rows.nth(i).getByText('Sample output', { exact: true })).toBeVisible();
		}

		// Mark as not sent: the badge goes back to Reviewed and the change is announced.
		await rows.nth(1).getByRole('button', { name: 'Mark as not sent' }).click();
		await expect(announcer(page)).toHaveText('Marked as not sent in Draft history.');
		await expect(rows.nth(1).getByText('Reviewed', { exact: true })).toBeVisible();
		await expect(rows.nth(1).getByRole('button', { name: 'Mark as not sent' })).toHaveCount(0);
		await expect(rows.nth(1).getByRole('button', { name: 'Open' })).toBeFocused();

		// Delete asks first; the safe button has focus; confirming moves focus to the title.
		const remove = rows.nth(0).getByRole('button', { name: 'Delete' });
		await remove.click();
		const confirm = page.getByRole('alertdialog', { name: 'Delete this draft?' });
		await expect(confirm).toBeVisible();
		await expect(confirm.getByRole('button', { name: 'Keep draft' })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(confirm).toBeHidden();
		await expect(rows).toHaveCount(3);

		await remove.click();
		await expect(confirm).toBeVisible();
		await confirm.getByRole('button', { name: 'Delete draft' }).click();
		await expect(confirm).toBeHidden();
		await expect(rows).toHaveCount(2);
		await expect(history(page).getByRole('heading', { name: 'Draft history' })).toBeFocused();
		await expect(announcer(page)).toHaveText('Draft deleted.');
		await expect(history(page).getByText('2 saved in this browser', { exact: true })).toBeVisible();
	});

	test('the sample output toggle overrides a saved key and sends nothing', async ({ page }) => {
		const anthropic = countRequests(page, 'api.anthropic.com');
		const calls = await routeAnthropic(page, { stream: 'This must never be requested.' });
		await openAiSettings(page);
		await saveKey(page, 'Anthropic', fakeKey('anthropic'));
		await section(page).getByRole('radio', { name: 'Anthropic' }).check();
		await expect(panel(page).getByText('claude-sonnet-5-5', { exact: true }).first()).toBeVisible();

		await section(page)
			.getByRole('checkbox', { name: 'Use sample output instead of my AI key' })
			.check();
		await expect(announcer(page)).toHaveText('Sample output turned on.');
		await expect(panel(page).getByText('Sample output', { exact: true })).toBeVisible();

		await runButton(page, 'Generate draft').click();
		await expectDraftReady(page);
		await expect(panel(page).getByText('Sample output', { exact: true })).toBeVisible();
		await expect(draft(page)).not.toContainText('This must never be requested.');
		expect(anthropic.count).toBe(0);
		expect(calls).toHaveLength(0);
	});
});
