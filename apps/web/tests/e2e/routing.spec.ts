import { test, expect } from '@playwright/test';
import { ROUTES, EXTERNAL_HOSTS, isPrintRoute } from './routes';

// FND-01 routing contract, proven against the real built output served with GitHub Pages
// semantics (scripts/serve-pages.mjs). Every page.goto uses a RELATIVE path so the same spec
// runs under both the root base ('/') and the sub-path base ('/tran_real_estate/').
const SUB_BASE = '/tran_real_estate/';

// The two route walks below visit every page in one test, so their budget grows with ROUTES
// (about 2 s a page on one core) instead of the 30 s default.
const WALK_TIMEOUT = ROUTES.length * 4_000;

test('every prerendered route responds 200 with a visible h1', async ({ page }) => {
	test.setTimeout(WALK_TIMEOUT);
	for (const route of ROUTES) {
		const res = await page.goto(route);
		expect(res?.status(), `status for ${JSON.stringify(route)}`).toBe(200);
		await expect(page.locator('h1')).toBeVisible();
	}
});

test('deep link without trailing slash is redirected to the page and survives a refresh', async ({
	page
}) => {
	const res = await page.goto('renter');
	// Pages answers 301 for a directory without a trailing slash; trailingSlash: 'always' means the
	// redirected URL is the prerendered one, so the final document is the page itself.
	expect(res?.status()).toBe(200);
	expect(page.url()).toMatch(/\/renter\/$/);
	await expect(page.locator('h1')).toBeVisible();

	await page.reload();
	expect(page.url()).toMatch(/\/renter\/$/);
	await expect(page.locator('h1')).toBeVisible();
});

test('unknown path returns HTTP 404 and renders the branded not-found page', async ({ page }) => {
	const res = await page.goto('does-not-exist/deeper/');
	expect(res?.status()).toBe(404);
	await expect(page.locator('h1')).toContainText('404');
});

test('every in-page link resolves to a trailing-slash path under the current base', async ({
	page
}, testInfo) => {
	test.setTimeout(WALK_TIMEOUT);
	for (const route of ROUTES) {
		await page.goto(route);
		// Prerendered hrefs are base-relative (./renter/, ../investor/), so resolve them against the
		// page URL before asserting. Fragment links (the skip link) are same-page anchors, not routes.
		const links = await page.locator('a:not([href^="#"])').evaluateAll((anchors) =>
			anchors.map((a) => ({
				href: a.getAttribute('href') ?? '',
				target: a.getAttribute('target')
			}))
		);
		// The print surfaces deliberately carry no site navigation, so the "at least one link"
		// guard applies to every other route.
		if (!isPrintRoute(route)) {
			expect(links.length, `links on ${JSON.stringify(route)}`).toBeGreaterThan(0);
		}
		const origin = new URL(page.url()).origin;
		for (const { href, target } of links) {
			// Phone/email actions open the renter's own apps (UI-SPEC honesty rule 4); they are not
			// routes, so they skip both the cross-origin and the base-path assertions.
			if (/^(tel|mailto):/i.test(href)) continue;
			const url = new URL(href, page.url());
			// Cross-origin links (HUD, data providers on the legal pages) are not routes: they must be
			// https and open in the same tab, then skip the base-path assertions.
			if (url.origin !== origin) {
				expect(url.protocol, `${href} on ${JSON.stringify(route)}`).toBe('https:');
				expect(target, `${href} on ${JSON.stringify(route)} target`).toBeNull();
				expect(EXTERNAL_HOSTS, href).toContain(url.hostname);
				continue;
			}
			const { pathname } = url;
			expect(pathname, `${href} on ${JSON.stringify(route)}`).toMatch(/\/$/);
			if (testInfo.project.name === 'sub') {
				expect(pathname, `${href} on ${JSON.stringify(route)}`).toMatch(
					new RegExp(`^${SUB_BASE.replace(/[/_]/g, '\\$&')}`)
				);
			}
		}
	}
});
