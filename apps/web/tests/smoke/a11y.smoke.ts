// SMOKE-06: axe over the served bundle on the landing, a portal and the privacy page. The same five
// WCAG 2.0/2.1/2.2 A and AA tags as tests/e2e/a11y.spec.ts (copied, not imported: importing a spec
// file would register its tests here). A zero-violation result only counts if axe evaluated rules.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const route of ['', 'renter/', 'legal/privacy/']) {
	test(`axe on /${route}`, async ({ page }) => {
		const res = await page.goto(route);
		expect(res?.status()).toBe(200);
		// The frame guard reveals the page; axe skips hidden content.
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1')).toBeVisible();
		const r = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
		expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
		expect(r.passes.length).toBeGreaterThan(0);
	});
}
