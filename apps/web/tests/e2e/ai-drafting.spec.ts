import { test, expect, type Page } from '@playwright/test';
import {
	blockAiProviders,
	fakeKey,
	openAiSettings,
	routeAnthropic,
	saveKey
} from './helpers/ai-mocks';

// Settings "AI drafting" (05-15) on the real built site, both bases, with every provider mocked
// through page.route (RESEARCH Pitfall 8). No provider host is ever reached: blockAiProviders runs
// first and each route* helper only answers the paths it knows.

const section = (page: Page) => page.locator('#ai-drafting');
const panel = (page: Page) => section(page).getByRole('region', { name: 'Sample inquiry' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });

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
	test.beforeEach(async ({ page }) => {
		await blockAiProviders(page);
	});

	test('spike: a mocked Anthropic SSE stream renders in Settings under the meta CSP', async ({
		page
	}) => {
		const errors = collectErrors(page);
		const calls = await routeAnthropic(page, { stream: 'Hello from a mocked Anthropic stream.' });

		await openAiSettings(page);
		await saveKey(page, 'Anthropic', fakeKey('anthropic'));
		await section(page).getByRole('radio', { name: 'Anthropic' }).check();
		await panel(page).getByRole('button', { name: 'Generate draft' }).click();

		await expect(draft(page)).toContainText('Hello from a mocked Anthropic stream.');
		await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible();
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);

		const bad = errors.filter((e) => /Content Security Policy|Illegal invocation/.test(e));
		expect(bad).toEqual([]);
	});
});
