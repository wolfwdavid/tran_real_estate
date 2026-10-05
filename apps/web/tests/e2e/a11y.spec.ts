import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES } from './routes';

// FND-04's automated accessibility gate: axe over every prerendered route, on both bases.
// Exactly the WCAG 2.0/2.1/2.2 A and AA tag set; best-practice tags are deliberately NOT included
// in this phase (Phase 2 owns brand, contrast and component work). One test per route so a
// failure names the route, and the assertion message lists the failing rule ids.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const route of ROUTES) {
	test(`axe reports no WCAG A/AA violations on ${JSON.stringify(route)}`, async ({ page }) => {
		await page.goto(route);
		// The frame guard must have revealed the page: axe skips hidden content, so an <html hidden>
		// document would pass with nothing analysed.
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1')).toBeVisible();

		const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
		// An empty violations list is only meaningful if axe evaluated rules against real content.
		expect(results.passes.length, 'axe evaluated no rules').toBeGreaterThan(0);
		const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
		expect(
			results.violations,
			`axe violations on ${JSON.stringify(route)}:\n${ids.join('\n')}`
		).toEqual([]);
	});
}
