// SMOKE-02 SEO contracts over HTTP: sitemap, robots, manifest and share tags, all on the build's
// site URL (smoke.siteUrl), never a hard-coded origin. The configured target serves pages from
// 127.0.0.1 whose absolute URLs carry its own test origin, which is the HTTP-level LIVE-08 proof.
import { test, expect, smoke } from './fixtures';
import { LEGAL_ROUTES, MARKETING_ROUTES } from '../e2e/routes';

const site = smoke.siteUrl;
const INDEXABLE = [...MARKETING_ROUTES, ...LEGAL_ROUTES];

test('sitemap lists exactly the indexable URLs on the site URL', async ({ request }) => {
	const res = await request.get('sitemap.xml');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('xml');
	const locs = [...(await res.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
	expect(new Set(locs)).toEqual(new Set(INDEXABLE.map((r) => site + r)));
	expect(locs.length).toBe(14);
});

test('robots.txt points at the sitemap', async ({ request }) => {
	const res = await request.get('robots.txt');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('text/plain');
	expect(await res.text()).toContain(`Sitemap: ${site}sitemap.xml`);
});

test('manifest.webmanifest answers 200', async ({ request }) => {
	const res = await request.get('manifest.webmanifest');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('application/manifest+json');
});

for (const route of INDEXABLE) {
	test(`share tags on /${route}`, async ({ page }) => {
		const res = await page.goto(route);
		expect(res?.status()).toBe(200);
		await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
		const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
		expect(canonical).toBe(site + route);
		expect(await page.locator('meta[property="og:url"]').getAttribute('content')).toBe(canonical);
		const contents = await page
			.locator('meta[property^="og:"], meta[name^="twitter:"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('content') ?? ''));
		const absolute = contents.filter((c) => c.startsWith('http'));
		expect(absolute.length).toBeGreaterThan(0);
		expect(absolute.filter((c) => !c.startsWith(site))).toEqual([]);
	});
}

test('the landing og:image answers image/png', async ({ page }) => {
	await page.goto('');
	const content = (await page.locator('meta[property="og:image"]').getAttribute('content')) ?? '';
	expect(content.startsWith(site)).toBe(true);
	// The card is absolute on the site URL; map its path (below the site's base) onto the served base.
	const rel = new URL(content).pathname.slice(new URL(site).pathname.length);
	const res = await page.request.get(new URL(rel, smoke.baseUrl).href);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('image/png');
});
