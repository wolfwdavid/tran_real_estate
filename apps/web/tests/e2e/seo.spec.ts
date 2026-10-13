import { test, expect } from '@playwright/test';
import { APP_ROUTES, LEGAL_ROUTES, MARKETING_ROUTES, PRINT } from './routes';

// GTM-03 in a real browser. scripts/assert-seo.mjs proves the prerendered HTML; this spec proves
// that hydration does not duplicate or drop the head tags SeoHead renders (RESEARCH Pattern 6),
// that non-marketing pages stay noindex, and that the SEO files are served with the right content
// types. Relative paths keep one spec valid on the root and sub projects.

const OG_CARDS = ['default', 'tools', 'affordability', 'cap-rate', 'cash-on-cash', 'dscr'] as const;

for (const route of [...MARKETING_ROUTES, ...LEGAL_ROUTES]) {
	test(`head tags once after hydration on ${JSON.stringify(route)}`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1')).toBeVisible();

		await expect(page.locator('head title')).toHaveCount(1);
		await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
		await expect(page.locator('meta[name="description"]')).toHaveCount(1);
		await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
		await expect(
			page.locator('meta[name="twitter:card"][content="summary_large_image"]')
		).toHaveCount(1);
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

		const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
		expect(canonical).toMatch(/^https:\/\//);
		expect(canonical).not.toContain('..');
		expect(canonical!.endsWith(route === '' ? '/' : `/${route}`)).toBe(true);
		const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
		expect(ogUrl).toBe(canonical);
	});
}

test('noindex on app and print pages', async ({ page }) => {
	test.setTimeout((APP_ROUTES.length + 1) * 6_000);
	for (const route of [...APP_ROUTES, PRINT]) {
		await page.goto(route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(
			page.locator('meta[name="robots"][content="noindex"]'),
			`noindex on ${JSON.stringify(route)}`
		).toHaveCount(1);
		await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
	}
});

test('sitemap, robots and share cards are served', async ({ page }) => {
	await page.goto('');
	const sitemap = await page.request.get('sitemap.xml');
	expect(sitemap.status()).toBe(200);
	expect(sitemap.headers()['content-type']).toContain('application/xml');
	expect(await sitemap.text()).toContain('<urlset');

	const robots = await page.request.get('robots.txt');
	expect(robots.status()).toBe(200);
	expect(robots.headers()['content-type']).toContain('text/plain');
	expect(await robots.text()).toContain('Sitemap: ');

	for (const slug of OG_CARDS) {
		const card = await page.request.get(`og/${slug}.png`);
		expect(card.status(), `og/${slug}.png`).toBe(200);
		expect(card.headers()['content-type'], `og/${slug}.png`).toContain('image/png');
	}
});

test('og:image of the landing resolves', async ({ page }) => {
	await page.goto('');
	const content = await page.locator('meta[property="og:image"]').getAttribute('content');
	expect(content).toMatch(/^https:\/\/.+\/og\/default\.png$/);
	// The share card is absolute on the production origin; map its path onto the served base.
	const local = new URL(new URL(content!).pathname, page.url()).href;
	const res = await page.request.get(local);
	expect(res.status(), local).toBe(200);
	expect(res.headers()['content-type']).toContain('image/png');
});
