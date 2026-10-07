import { test, expect, type Page } from '@playwright/test';
import { PRINT_SNAPSHOT, STUDIO_ROUTES } from './routes';
import { expectNoHorizontalScroll, loadSampleContacts } from './agent-helpers';
import {
	blockRentCast,
	mockRentCast,
	saveCap,
	saveRentCastKey,
	seedSavedSearches
} from './helpers/data';

// The agent Studio shell (09-09; 09-UI-SPEC "Routes", "(app) agent layout additions") on the real
// built site, both bases: the five Studio routes and the snapshot printout prerender with their h1
// and title, AgentNav marks Studio current on all of them, the Data source bar shows on
// /agent/studio/snapshot/ only, the check-on-open saved-search pass still runs in the Studio, and
// the hub and profile links lead to the right pages under the current base.

type StudioRoute = (typeof STUDIO_ROUTES)[number];

const EXPECTED: Record<StudioRoute, { h1: string; title: string }> = {
	'agent/studio/': { h1: 'Studio', title: 'Studio: Agent portal · Tran Real Estate Tools' },
	'agent/studio/listing/': {
		h1: 'Listing description',
		title: 'Listing description: Studio · Tran Real Estate Tools'
	},
	'agent/studio/social/': {
		h1: 'Social post pack',
		title: 'Social post pack: Studio · Tran Real Estate Tools'
	},
	'agent/studio/reel/': {
		h1: 'Reel script',
		title: 'Reel script: Studio · Tran Real Estate Tools'
	},
	'agent/studio/snapshot/': {
		h1: 'Market Snapshot',
		title: 'Market Snapshot: Studio · Tran Real Estate Tools'
	}
};

const NAV_ORDER = ['Today', 'Pipeline', 'Contacts', 'Import', 'Profile', 'Studio'];
const SNAPSHOT: StudioRoute = 'agent/studio/snapshot/';

const agentNav = (page: Page) => page.getByRole('navigation', { name: 'Agent tools' });
const statusBar = (page: Page) => page.getByRole('region', { name: 'Data source' });
/** The tool pages' ghost "Studio" back link (in <main>, outside AgentNav's own Studio link). */
const backLink = (page: Page) =>
	page.locator('main a:not(nav a)').filter({ hasText: /^\s*Studio\s*$/ });

async function hrefOf(page: Page, name: string): Promise<string> {
	return page
		.getByRole('link', { name, exact: true })
		.evaluate((a) => (a as HTMLAnchorElement).href);
}

test.beforeEach(async ({ page }) => {
	await blockRentCast(page);
});

test('the spec covers exactly the registered Studio routes', () => {
	expect(Object.keys(EXPECTED).sort()).toEqual([...STUDIO_ROUTES].sort());
});

for (const route of STUDIO_ROUTES) {
	const { h1, title } = EXPECTED[route];
	const showsBar = route === SNAPSHOT;

	test(`${route}: h1, title, Studio current, Data source bar ${showsBar ? 'shown' : 'hidden'}`, async ({
		page,
		baseURL
	}) => {
		await page.goto(route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText(h1);
		await expect(page).toHaveTitle(title);

		const nav = agentNav(page);
		await expect(nav).toBeVisible();
		expect((await nav.getByRole('link').allTextContents()).map((t) => t.trim())).toEqual(NAV_ORDER);
		const marked = nav.locator('a[aria-current]');
		await expect(marked).toHaveCount(1);
		await expect(marked).toHaveAttribute('aria-current', 'page');
		await expect(marked).toHaveText('Studio');
		expect(await marked.evaluate((a) => getComputedStyle(a).fontWeight)).toBe('600');
		expect(await marked.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
			new URL('agent/studio/', baseURL).href
		);

		// Only the snapshot builder spends RentCast calls (09-UI-SPEC Planner Note 2). Keyless, its
		// bar is the Sample data variant and leads <main>.
		if (showsBar) {
			await expect(statusBar(page)).toContainText('Sample data');
			await expect(page.locator('main > :first-child')).toHaveAttribute(
				'aria-label',
				'Data source'
			);
		} else {
			await expect(statusBar(page)).toHaveCount(0);
		}

		// Every tool route has the ghost "Studio" back link to the hub, above the h1; the hub has none.
		const back = backLink(page);
		if (route === 'agent/studio/') {
			await expect(back).toHaveCount(0);
		} else {
			await expect(back).toHaveCount(1);
			expect(await back.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
				new URL('agent/studio/', baseURL).href
			);
			const box = await back.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
			const h1Box = await page.locator('h1').boundingBox();
			expect((box?.y ?? 0) < (h1Box?.y ?? 0)).toBe(true);
		}
	});
}

test('agent/studio/: the hub links to the four tools and the sample report under the base', async ({
	page,
	baseURL
}) => {
	await page.goto('agent/studio/');
	await expect(page.locator('main')).toContainText(
		'Every draft is checked for Fair Housing problem phrases and gets your disclosure added.'
	);
	const tools: [string, string][] = [
		['Write a listing description', 'agent/studio/listing/'],
		['Write a post pack', 'agent/studio/social/'],
		['Write a reel script', 'agent/studio/reel/'],
		['Build a Market Snapshot', 'agent/studio/snapshot/']
	];
	for (const [name, path] of tools) {
		expect(await hrefOf(page, name), name).toBe(new URL(path, baseURL).href);
	}
	expect(await hrefOf(page, 'Preview a sample report')).toBe(
		new URL(`${PRINT_SNAPSHOT}?id=sample`, baseURL).href
	);

	await page.getByRole('link', { name: 'Preview a sample report', exact: true }).click();
	await expect(page).toHaveURL(new URL(`${PRINT_SNAPSHOT}?id=sample`, baseURL).href);
	await expect(page.locator('h1')).toContainText('Market Snapshot');
});

test('print/snapshot/: the prerendered printout shell has its h1 and title and no site chrome', async ({
	page
}) => {
	await page.goto(PRINT_SNAPSHOT);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toHaveCount(1);
	await expect(page.locator('h1')).toContainText('Market Snapshot');
	await expect(page.getByRole('banner')).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);
	await expect(agentNav(page)).toHaveCount(0);
	await expect(statusBar(page)).toHaveCount(0);
});

test('client-side navigation: the Data source bar appears on the snapshot builder only', async ({
	page
}) => {
	await page.goto('agent/today/');
	await expect(statusBar(page)).toHaveCount(0);
	await agentNav(page).getByRole('link', { name: 'Studio', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Studio');
	await expect(agentNav(page).locator('a[aria-current="page"]')).toHaveText('Studio');
	await expect(statusBar(page)).toHaveCount(0);

	await page.getByRole('link', { name: 'Build a Market Snapshot', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Market Snapshot');
	await expect(statusBar(page)).toContainText('Sample data');

	await backLink(page).click();
	await expect(page.locator('h1')).toHaveText('Studio');
	await expect(statusBar(page)).toHaveCount(0);

	await agentNav(page).getByRole('link', { name: 'Pipeline', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Pipeline');
	await expect(statusBar(page)).toHaveCount(0);
});

test('the Sample contacts notice stays on the CRM pages and off the Studio routes', async ({
	page
}) => {
	test.slow();
	await loadSampleContacts(page);
	const notice = page.getByRole('region', { name: 'Sample contacts' });
	// Client-side moves keep the agent layout (and its live contacts query) mounted, so the notice
	// would still be on screen if the Studio did not skip it: the absence below is not vacuous.
	await agentNav(page).getByRole('link', { name: 'Studio', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Studio');
	await expect(notice).toHaveCount(0);
	await page.getByRole('link', { name: 'Build a Market Snapshot', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Market Snapshot');
	await expect(notice).toHaveCount(0);
	// Control: back on a CRM page the notice returns.
	await agentNav(page).getByRole('link', { name: 'Pipeline', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Pipeline');
	await expect(notice).toBeVisible();
});

test('a full load of a Studio route still runs the check-on-open saved-search pass', async ({
	page
}) => {
	test.slow();
	const calls = await mockRentCast(page, () => ({ status: 404 }));
	await saveRentCastKey(page);
	await saveCap(page, 40);
	// Seeded from the home page, which mounts no DataShell (see data-status.spec.ts seedFromHome).
	await page.goto('');
	await seedSavedSearches(page, 5, { lastRunAt: null, reload: false });

	await page.goto('agent/studio/listing/');
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole('heading', { name: 'Check 5 saved searches for new listings?' })
	).toBeVisible();
	await dialog.getByRole('button', { name: 'Not now', exact: true }).click();
	await expect(dialog).toBeHidden();
	expect(calls).toHaveLength(0);
});

test('agent/profile/: "Create Market Snapshot" leads to the snapshot builder', async ({
	page,
	baseURL
}) => {
	await page.goto('agent/profile/');
	expect(await hrefOf(page, 'Create Market Snapshot')).toBe(
		new URL('agent/studio/snapshot/', baseURL).href
	);
	await page.getByRole('link', { name: 'Create Market Snapshot', exact: true }).click();
	await expect(page.locator('h1')).toHaveText('Market Snapshot');
	await expect(agentNav(page).locator('a[aria-current="page"]')).toHaveText('Studio');
});

test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	for (const route of [...STUDIO_ROUTES, PRINT_SNAPSHOT]) {
		test(`${route}: no horizontal scroll`, async ({ page }) => {
			await page.goto(route);
			await expect(page.locator('h1')).toBeVisible();
			await expectNoHorizontalScroll(page);
			if (route === PRINT_SNAPSHOT) return;
			// The six AgentNav links wrap onto two rows in reading order, all in the viewport.
			const tops = await agentNav(page)
				.getByRole('link')
				.evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().top)));
			expect(tops).toHaveLength(6);
			expect(new Set(tops).size).toBe(2);
			expect(tops).toEqual([...tops].sort((a, b) => a - b));
		});
	}
});
