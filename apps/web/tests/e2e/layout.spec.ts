import { test, expect, type Page } from '@playwright/test';
import { ROUTES, CHROME_ROUTES, PRINT, NOT_FOUND, APP_ROUTES } from './routes';

// Phase 2 chrome proof (BRND-01/03/04/05). The shared header (PortalSwitcher), footer and page
// shells are exercised on every prerendered route plus the 404, under both base paths: landmark
// structure, aria-current present in the RAW prerendered HTML (not only after hydration), footer
// legal reachability, no third-party requests, self-hosted fonts actually loaded. Every check
// carries a non-vacuity control so a silently empty selector or collector cannot pass.
// Relative page.goto paths keep one spec valid under the root and /tran_real_estate/ bases.

const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);
const LEGAL_LINKS = ['Privacy', 'Terms', 'Fair Housing', 'Data coverage'] as const;

/** Requests whose origin differs from the page's own origin (third-party traffic). */
const foreign = (urls: readonly string[], origin: string) =>
	urls.filter((u) => new URL(u).origin !== origin);

const portals = (page: Page) => page.getByRole('navigation', { name: 'Portals' });

for (const route of [...ROUTES, NOT_FOUND]) {
	test(`landmarks on ${JSON.stringify(route)}`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('h1')).toHaveCount(1);
		const chrome = route === PRINT ? 0 : 1;
		await expect(page.getByRole('banner')).toHaveCount(chrome);
		await expect(portals(page)).toHaveCount(chrome);
		await expect(page.getByRole('main')).toHaveCount(1);
		await expect(page.getByRole('contentinfo')).toHaveCount(chrome);
	});
}

test('prerendered HTML marks the current portal', async ({ page }) => {
	const anchors = async (route: string) => {
		const res = await page.request.get(route);
		expect(res.status(), `status for ${JSON.stringify(route)}`).toBe(200);
		const html = await res.text();
		return html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
	};
	for (const route of [...APP_ROUTES, 'legal/privacy/']) {
		const tags = await anchors(route);
		const marks = new RegExp(`href="[^"]*${route}"`);
		expect(
			tags.some((t) => marks.test(t)),
			`raw HTML of ${route} marks it current: ${JSON.stringify(tags)}`
		).toBe(true);
	}
	// Control: the landing page is no portal and no footer destination, so nothing is current.
	expect(await anchors('')).toEqual([]);
});

for (const route of CHROME_ROUTES) {
	test(`footer legal links resolve from ${JSON.stringify(route)}`, async ({ page }) => {
		await page.goto(route);
		const footer = page.getByRole('contentinfo');
		for (const name of LEGAL_LINKS) {
			const href = await footer.getByRole('link', { name, exact: true }).getAttribute('href');
			expect(href, `${name} href`).toBeTruthy();
			const target = new URL(href!, page.url()).href;
			const res = await page.request.get(target);
			expect(res.status(), `${name} -> ${target}`).toBe(200);
		}
		await expect(footer).toContainText('Equal Housing Opportunity');
		await expect(footer).toContainText(/© \d{4} Tran Real Estate Tools/);
		// BRND-05: the portal switcher is on every chrome page.
		const renter = await portals(page)
			.getByRole('link', { name: 'Renter', exact: true })
			.first()
			.getAttribute('href');
		expect(new URL(renter!, page.url()).pathname).toMatch(/renter\/$/);
	});
}

test('every route makes only same-origin requests and loads both brand fonts', async ({ page }) => {
	const urls: string[] = [];
	page.on('request', (r) => urls.push(r.url()));
	for (const route of ROUTES) {
		await page.goto(route);
		await page.evaluate(() => document.fonts.ready);
	}
	const origin = new URL(page.url()).origin;
	expect(urls.length).toBeGreaterThan(ROUTES.length); // non-vacuity: assets were collected
	expect(foreign(urls, origin)).toEqual([]);

	await page.goto(CHROME_ROUTES[CHROME_ROUTES.length - 1]);
	await page.evaluate(() => document.fonts.ready);
	const loaded = await page.evaluate(() =>
		[...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''))
	);
	expect(loaded).toContain('Inter Variable');
	expect(loaded).toContain('Fraunces Variable');
	expect(foreign(urls, origin)).toEqual([]);
});

test.describe('request filter control', () => {
	// CSP-blocked requests never fire `request`, so the policy is bypassed ONLY here to prove the
	// filter above would catch a third-party request if one were ever made.
	test.use({ bypassCSP: true });

	test('the same-origin filter flags a planted cross-origin request (non-vacuity)', async ({
		page
	}) => {
		const urls: string[] = [];
		page.on('request', (r) => urls.push(r.url()));
		await page.goto('');
		const origin = new URL(page.url()).origin;
		expect(foreign(urls, origin)).toEqual([]);
		await page.evaluate((p) => {
			new Image().src = `http://127.0.0.1:${p}/x.png`;
		}, ATTACKER);
		await expect.poll(() => foreign(urls, origin).length).toBeGreaterThan(0);
	});
});
