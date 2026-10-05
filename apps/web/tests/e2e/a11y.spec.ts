import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES, NOT_FOUND } from './routes';

// The automated accessibility gate (FND-04, BRND-03): axe over every prerendered route at the
// default 1280px viewport and at 375px, on the 404 page, and with the mobile menu open, on both
// bases. Exactly the WCAG 2.0/2.1/2.2 A and AA tag set; best-practice tags are deliberately not
// included. One test per route and state so a failure names it, and the assertion message lists
// the failing rule ids.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	// An empty violations list is only meaningful if axe evaluated rules against real content.
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
	// Text over the hero gradient cannot be measured by axe and lands in "incomplete" rather than
	// failing. The token contrast unit test (02-01) covers those pairs; log them for visibility.
	for (const item of results.incomplete) {
		if (item.id === 'color-contrast') {
			console.log(`[${label}] color-contrast incomplete on ${item.nodes.length} node(s)`);
		}
	}
}

/** Load a route and confirm the frame guard revealed it: axe skips hidden content. */
async function open(page: Page, route: string) {
	await page.goto(route);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toBeVisible();
}

for (const route of ROUTES) {
	test(`axe reports no WCAG A/AA violations on ${JSON.stringify(route)}`, async ({ page }) => {
		await open(page, route);
		await expectNoViolations(page, JSON.stringify(route));
	});
}

test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	for (const route of ROUTES) {
		test(`axe reports no WCAG A/AA violations at 375px on ${JSON.stringify(route)}`, async ({
			page
		}) => {
			await open(page, route);
			await expectNoViolations(page, `${JSON.stringify(route)} at 375px`);
		});
	}
});

test('axe on the 404 page', async ({ page }) => {
	await page.goto(NOT_FOUND);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toContainText('404');
	await expectNoViolations(page, 'the 404 page');
});

test.describe('menu open at 375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	for (const route of ['', 'renter/']) {
		test(`axe with the portal menu open on ${JSON.stringify(route)}`, async ({ page }) => {
			await open(page, route);
			// The toggle only works once hydrated; clicking the prerendered button earlier is a no-op.
			await expect(page.locator('nav[data-hydrated]')).toHaveCount(1);
			await page.locator('button[aria-controls="portal-menu"]').click();
			await expect(page.locator('#portal-menu')).toBeVisible();
			await expectNoViolations(page, `${JSON.stringify(route)} with the menu open`);
		});
	}
});
