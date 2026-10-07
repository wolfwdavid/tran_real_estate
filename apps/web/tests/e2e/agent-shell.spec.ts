import { test, expect, type Page } from '@playwright/test';
import { AGENT_ROUTES } from './routes';

// The agent portal shell (08-11; 08-UI-SPEC "Routes", "(app) agent layout", "AgentNav") on the
// real built site, both bases: every agent sub-page renders its h1 and title, the Agent tools nav
// in fixed order with the current page marked, no Data source bar, and no horizontal scroll at
// 375px.

type AgentRoute = (typeof AGENT_ROUTES)[number];

// The contact detail without ?id= hydrates into its not-found block (08-23); its page title stays
// the generic "Contact".
const EXPECTED: Record<AgentRoute, { h1: string; current: string; title?: string }> = {
	'agent/today/': { h1: 'Today', current: 'Today' },
	'agent/pipeline/': { h1: 'Pipeline', current: 'Pipeline' },
	'agent/contacts/': { h1: 'Contacts', current: 'Contacts' },
	'agent/contact/': { h1: "This contact isn't here", current: 'Contacts', title: 'Contact' },
	'agent/import/': { h1: 'Import leads', current: 'Import' },
	'agent/profile/': { h1: 'Your profile', current: 'Profile' }
};

const NAV_ORDER = ['Today', 'Pipeline', 'Contacts', 'Import', 'Profile'];

const agentNav = (page: Page) => page.getByRole('navigation', { name: 'Agent tools' });

async function navTexts(page: Page): Promise<string[]> {
	return (await agentNav(page).getByRole('link').allTextContents()).map((t) => t.trim());
}

test('the spec covers exactly the registered agent routes', () => {
	expect(Object.keys(EXPECTED).sort()).toEqual([...AGENT_ROUTES].sort());
});

for (const route of AGENT_ROUTES) {
	const { h1, current, title = h1 } = EXPECTED[route];

	test(`${route}: h1, title, Agent tools nav in order with ${current} current`, async ({
		page
	}) => {
		await page.goto(route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText(h1);
		await expect(page).toHaveTitle(`${title}: Agent portal · Tran Real Estate Tools`);

		const nav = agentNav(page);
		await expect(nav).toBeVisible();
		expect(await navTexts(page)).toEqual(NAV_ORDER);
		const marked = nav.locator('a[aria-current]');
		await expect(marked).toHaveCount(1);
		await expect(marked).toHaveAttribute('aria-current', 'page');
		await expect(marked).toHaveText(current);
		await expect(nav).not.toContainText('Studio');

		// The agent CRM spends no RentCast calls: no Data source bar (08-UI-SPEC Planner Note 4).
		await expect(page.getByRole('region', { name: 'Data source' })).toHaveCount(0);
	});

	test(`${route}: the nav links lead to the agent pages under the current base`, async ({
		page,
		baseURL
	}) => {
		await page.goto(route);
		const hrefs = await agentNav(page)
			.getByRole('link')
			.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
		expect(hrefs).toEqual(
			['today', 'pipeline', 'contacts', 'import', 'profile'].map(
				(s) => new URL(`agent/${s}/`, baseURL).href
			)
		);
	});
}

test('agent/: the home shows the Agent tools nav with no current item', async ({ page }) => {
	await page.goto('agent/');
	await expect(page.locator('h1')).toHaveText('Agent portal');
	await expect(page).toHaveTitle('Agent portal: Tran Real Estate Tools');
	const nav = agentNav(page);
	await expect(nav).toBeVisible();
	expect(await navTexts(page)).toEqual(NAV_ORDER);
	await expect(nav.locator('[aria-current]')).toHaveCount(0);
	await expect(nav).not.toContainText('Studio');
});

test('the nav marks the next page current after a client-side navigation', async ({ page }) => {
	await page.goto('agent/today/');
	await agentNav(page).getByRole('link', { name: 'Pipeline' }).click();
	await expect(page.locator('h1')).toHaveText('Pipeline');
	await expect(agentNav(page).locator('a[aria-current="page"]')).toHaveText('Pipeline');
});

test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	for (const route of ['agent/', ...AGENT_ROUTES]) {
		test(`${route}: no horizontal scroll and the nav wraps to two rows`, async ({ page }) => {
			await page.goto(route);
			await expect(agentNav(page)).toBeVisible();
			const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(scrollWidth).toBeLessThanOrEqual(375);

			// The links wrap onto exactly two rows in reading order (where the break falls depends on
			// the label widths and the Today count pill), and none is hidden or clipped.
			const tops = await agentNav(page)
				.getByRole('link')
				.evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().top)));
			expect(tops).toHaveLength(5);
			expect(new Set(tops).size).toBe(2);
			expect(tops).toEqual([...tops].sort((a, b) => a - b));
			for (const link of await agentNav(page).getByRole('link').all()) {
				await expect(link).toBeInViewport();
			}
		});
	}
});
