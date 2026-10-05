import { test, expect, type Page } from '@playwright/test';
import {
	blockAiProviders,
	fakeKey,
	openAiSettings,
	routeAnthropic,
	routeOpenAI,
	saveKey
} from './helpers/ai-mocks';

// Settings "AI drafting" (05-15) on the real built site, both bases, with every provider mocked
// through page.route (RESEARCH Pitfall 8). No provider host is ever reached: blockAiProviders runs
// first and each route* helper only answers the paths it knows. Stop-mid-stream uses the keyless
// Fixture provider, because route.fulfill delivers a whole SSE body at once.

const section = (page: Page) => page.locator('#ai-drafting');
const panel = (page: Page) => section(page).getByRole('region', { name: 'Sample inquiry' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const PLACEHOLDER = 'Your draft will appear here.';
const runButton = (page: Page, name: string) =>
	panel(page).getByRole('button', { name, exact: true });

// Every fake key a test saves, so the request collector can prove none reaches a URL.
const SAVED_KEYS = [fakeKey('anthropic'), fakeKey('openai')];

/** Console errors and uncaught page errors, collected from the first navigation. */
function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text());
	});
	page.on('pageerror', (e) => errors.push(e.message));
	return errors;
}

test.describe('AI drafting', () => {
	let urls: string[] = [];

	test.beforeEach(async ({ page }) => {
		await blockAiProviders(page);
		urls = [];
		page.on('request', (r) => urls.push(r.url()));
	});

	// No key in URLs, ever (Pitfall 10): neither a saved key nor any `key=` query parameter.
	test.afterEach(() => {
		expect(urls.length).toBeGreaterThan(0);
		for (const url of urls) {
			for (const key of SAVED_KEYS) expect(url).not.toContain(key);
			expect(url).not.toMatch(/[?&]key=/);
		}
	});

	test('spike: a mocked Anthropic SSE stream renders in Settings under the meta CSP', async ({
		page
	}) => {
		const errors = collectErrors(page);
		const calls = await routeAnthropic(page, { stream: 'Hello from a mocked Anthropic stream.' });

		await openAiSettings(page);
		await saveKey(page, 'Anthropic', fakeKey('anthropic'));
		await section(page).getByRole('radio', { name: 'Anthropic' }).check();
		await runButton(page, 'Generate draft').click();

		await expect(draft(page)).toContainText('Hello from a mocked Anthropic stream.');
		await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible();
		await expect(panel(page).getByText('claude-sonnet-5-5', { exact: true }).first()).toBeVisible();
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
		// The key travels only in the header.
		expect(calls[0]?.headers['x-api-key']).toBe(fakeKey('anthropic'));

		const bad = errors.filter((e) => /Content Security Policy|Illegal invocation/.test(e));
		expect(bad).toEqual([]);
	});

	test('sample output streams with no keys, and Stop keeps the partial draft', async ({ page }) => {
		await openAiSettings(page);
		await expect(
			section(page).getByText('No AI key yet, so drafts use sample output.', { exact: false })
		).toBeVisible();

		await runButton(page, 'Generate draft').click();
		await expect(runButton(page, 'Stop')).toBeVisible();
		// Wait for streamed words (the empty box shows a placeholder line, which is not a draft).
		await expect(draft(page)).not.toContainText(PLACEHOLDER);
		await expect(draft(page)).toContainText('Hi,');
		await runButton(page, 'Stop').click();

		await expect(
			panel(page).getByText(
				'Stopped. The partial draft is kept, so you can edit it, use it, or generate again.',
				{ exact: true }
			)
		).toBeVisible();
		await expect(runButton(page, 'Generate again')).toBeVisible();
		await expect(draft(page)).not.toContainText(PLACEHOLDER);
		const kept = (await draft(page).innerText()).trim();
		expect(kept).toMatch(/^Hi,/);
		// The fixture's last line is "{client_email} · {client_phone}" (restored or not, it has "·"),
		// so a stopped draft never reaches it.
		expect(kept).not.toContain('·');
		expect(kept).not.toContain('{client_email}');
		await expect(panel(page).getByText('Sample output', { exact: true })).toBeVisible();
	});

	test('sample output runs to completion with a clean Fair Housing check and open exits', async ({
		page
	}) => {
		await openAiSettings(page);
		await runButton(page, 'Generate draft').click();

		await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
			timeout: 15_000
		});
		await expect(
			panel(page).getByText('No Fair Housing problem phrases found', { exact: false }).first()
		).toBeVisible();
		for (const exit of [
			panel(page).getByRole('button', { name: 'Copy text' }),
			panel(page).getByRole('link', { name: 'Open in email app' }),
			panel(page).getByRole('button', { name: 'Mark as sent' })
		]) {
			await expect(exit).toBeVisible();
			await expect(exit).not.toHaveAttribute('aria-disabled', 'true');
		}
		// The finished draft is in Draft history.
		await expect(section(page).getByRole('button', { name: /^Open/ }).first()).toBeVisible();
	});

	test('Test connection reports the Anthropic key accepted and the model available', async ({
		page
	}) => {
		const calls = await routeAnthropic(page, {
			models: ['claude-sonnet-5-5'],
			canaryStatus: 401
		});
		await openAiSettings(page);
		await saveKey(page, 'Anthropic', fakeKey('anthropic'));

		const card = page.locator('#key-anthropic');
		await card.getByRole('button', { name: 'Test connection' }).click();
		await expect(card.getByText('Anthropic accepted this key.')).toBeVisible();
		await expect(card).toContainText('Model claude-sonnet-5-5 is available.');

		// One keyed models check and one keyless canary; no generation, no tokens.
		expect(calls.filter((c) => c.kind === 'models')).toHaveLength(1);
		expect(calls.filter((c) => c.kind === 'canary')).toHaveLength(1);
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(0);
		expect(calls.find((c) => c.kind === 'canary')?.headers['x-api-key']).toBeUndefined();
	});

	test('a blocked OpenAI generation with a good key is reported as a CORS block', async ({
		page
	}) => {
		const calls = await routeOpenAI(page, { stream: 'abort', modelsStatus: 200, models: [] });
		await openAiSettings(page);
		await saveKey(page, 'OpenAI', fakeKey('openai'));
		await section(page).getByRole('radio', { name: 'OpenAI' }).check();
		await runButton(page, 'Generate draft').click();

		await expect(panel(page).getByText('OpenAI is blocking this site right now')).toBeVisible();
		const link = panel(page).getByRole('link', { name: 'Set up OpenRouter' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', /#key-openrouter$/);
		// One generation attempt, then the keyed disambiguation probe.
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
		expect(calls.filter((c) => c.kind === 'models')).toHaveLength(1);
	});

	test('a blocked OpenAI generation with a bad key is reported as a rejected key', async ({
		page
	}) => {
		await routeOpenAI(page, {
			stream: 'abort',
			modelsStatus: 401,
			modelsError: { error: { code: 'invalid_api_key' } }
		});
		await openAiSettings(page);
		await saveKey(page, 'OpenAI', fakeKey('openai'));
		await section(page).getByRole('radio', { name: 'OpenAI' }).check();
		await runButton(page, 'Generate draft').click();

		await expect(panel(page).getByText("OpenAI didn't accept your key")).toBeVisible();
		const link = panel(page).getByRole('link', { name: 'Open AI settings' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', /#key-openai$/);
		await expect(panel(page).getByRole('link', { name: 'Set up OpenRouter' })).toHaveCount(0);
	});

	test('What will be sent shows the redactions and never the raw client details', async ({
		page
	}) => {
		await openAiSettings(page);
		await panel(page).getByText('What will be sent', { exact: true }).click();

		const replaced = panel(page).getByRole('list');
		await expect(panel(page).getByText('Replaced before sending', { exact: true })).toBeVisible();
		await expect(replaced).toContainText('Jordan Rivera → ');
		await expect(replaced).toContainText('{client_name}');

		const details = panel(page).getByRole('group', { name: 'Details', exact: true });
		await expect(details).toContainText('{client_email}');
		await expect(details).not.toContainText('jordan.rivera@example.com');
	});
});
