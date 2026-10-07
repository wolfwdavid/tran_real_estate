import { test, expect, type Page } from '@playwright/test';
import {
	ROUTES,
	CHROME_ROUTES,
	NOT_FOUND,
	PORTAL_ROUTES,
	isPrintRoute,
	isPublicRoute
} from './routes';

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
		const chrome = isPrintRoute(route) ? 0 : 1;
		await expect(page.getByRole('banner')).toHaveCount(chrome);
		// The (public) pages keep a header and footer but never show the portal switcher.
		await expect(portals(page)).toHaveCount(isPublicRoute(route) ? 0 : chrome);
		await expect(page.getByRole('main')).toHaveCount(1);
		await expect(page.getByRole('contentinfo')).toHaveCount(chrome);
	});
}

test('prerendered HTML marks the current portal', async ({ page }) => {
	// `scope` narrows the raw HTML to one landmark. Without it the footer's own portal links
	// (which mark the current page too) would mask a broken header switcher on renter/investor/
	// agent: the mutation check in 02-10 caught the bug only on settings/ until this was scoped.
	const anchors = async (
		route: string,
		scope: 'Portals' | 'footer' | 'all',
		value: 'page' | 'true' = 'page'
	) => {
		const res = await page.request.get(route);
		expect(res.status(), `status for ${JSON.stringify(route)}`).toBe(200);
		let html = await res.text();
		if (scope === 'Portals')
			html = html.match(/<nav\b[^>]*aria-label="Portals"[\s\S]*?<\/nav>/)?.[0] ?? '';
		if (scope === 'footer') html = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] ?? '';
		expect(scope === 'all' || html.length > 0, `${scope} found in ${route}`).toBe(true);
		return html.match(new RegExp(String.raw`<a\b[^>]*aria-current="${value}"[^>]*>`, 'g')) ?? [];
	};
	const marked = (tags: string[], route: string) =>
		tags.some((t) => new RegExp(`href="[^"]*${route}"`).test(t));

	// The header switcher marks each app page (the inline list and the menu panel both do). A
	// portal sub-page (renter/shortlist/) marks its portal root as the current section instead.
	for (const route of PORTAL_ROUTES) {
		const root = `${route.split('/')[0]}/`;
		const tags = await anchors(route, 'Portals', route === root ? 'page' : 'true');
		expect(marked(tags, root), `Portals nav in raw ${route}: ${JSON.stringify(tags)}`).toBe(true);
	}
	// The footer marks a legal page.
	const legal = await anchors('legal/privacy/', 'footer');
	expect(marked(legal, 'legal/privacy/'), JSON.stringify(legal)).toBe(true);
	// Control: the landing page is no portal and no footer destination, so nothing is current.
	expect(await anchors('', 'all')).toEqual([]);
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
	// One test walks every route, so its budget grows with ROUTES (about 2 s a page on one core).
	test.setTimeout(ROUTES.length * 4_000);
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

// ---------------------------------------------------------------------------------------------
// BRND-03/05 responsive behaviour. 375px is the smallest supported width; 640px is the `sm`
// breakpoint where the inline portal list replaces the Menu disclosure. Interactions wait for
// nav[data-hydrated] (set in onMount) because a click before hydration does nothing (Pitfall 10).

const overflow = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const inlineList = (page: Page) => portals(page).locator('ul:not(#portal-menu)');
const hydrated = (page: Page) => expect(page.locator('nav[data-hydrated]')).toBeAttached();

/** WCAG 1.4.12 text-spacing overrides. an injected <style> element is refused by style-src-elem, so the
 *  sheet is constructed in the page and adopted (constructed sheets are not governed by CSP). */
const applyTextSpacing = (page: Page) =>
	page.evaluate(() => {
		const s = new CSSStyleSheet();
		s.replaceSync(
			'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'
		);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
	});

test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	for (const route of [...ROUTES, NOT_FOUND]) {
		test(`no horizontal scroll on ${JSON.stringify(route)}`, async ({ page }) => {
			await page.goto(route);
			await expect(page.locator('h1')).toBeVisible();
			expect(await overflow(page)).toBeLessThanOrEqual(0);
			if (!isPrintRoute(route) && !isPublicRoute(route)) {
				await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
				await expect(inlineList(page)).toBeHidden();
			}
		});
	}

	for (const route of CHROME_ROUTES) {
		test(`no horizontal scroll with the menu open on ${JSON.stringify(route)}`, async ({
			page
		}) => {
			await page.goto(route);
			await hydrated(page);
			await page.getByRole('button', { name: 'Menu' }).click();
			await expect(page.locator('#portal-menu')).toBeVisible();
			expect(await overflow(page)).toBeLessThanOrEqual(0);
		});
	}

	for (const route of ROUTES) {
		test(`text spacing overrides keep ${JSON.stringify(route)} usable`, async ({ page }) => {
			await page.goto(route);
			await applyTextSpacing(page);
			// The override must actually be in force, or the overflow check proves nothing.
			await expect(page.locator('h1')).not.toHaveCSS('word-spacing', '0px');
			expect(
				await page.evaluate(() => getComputedStyle(document.body).letterSpacing),
				'letter-spacing override applied'
			).not.toBe('normal');
			expect(await overflow(page)).toBeLessThanOrEqual(0);
			await expect(page.locator('h1')).toBeVisible();
		});
	}

	test('overflow detector catches a planted wide element (non-vacuity)', async ({ page }) => {
		await page.goto('');
		expect(await overflow(page)).toBeLessThanOrEqual(0);
		await page.evaluate(() => {
			const d = document.createElement('div');
			d.setAttribute('style', 'width:1000px;height:1px');
			document.body.append(d);
		});
		expect(await overflow(page)).toBeGreaterThan(0);
	});
});

test.describe('disclosure menu at 375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	const button = (page: Page) => page.locator('button[aria-controls="portal-menu"]');
	const panel = (page: Page) => page.locator('#portal-menu');

	test.beforeEach(async ({ page }) => {
		await page.goto('renter/');
		await hydrated(page);
	});

	test('mouse toggles the panel and marks the current portal', async ({ page }) => {
		await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(panel(page)).toBeHidden();
		await expect(button(page)).toHaveText('Menu');

		await button(page).click();
		await expect(button(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(button(page)).toHaveText('Close');
		await expect(panel(page)).toBeVisible();
		await expect(panel(page).locator('a[aria-current="page"]')).toHaveText('Renter');
	});

	test('Escape closes the panel and returns focus to the button', async ({ page }) => {
		await button(page).click();
		await panel(page).getByRole('link', { name: 'Investor' }).focus();
		await page.keyboard.press('Escape');
		await expect(panel(page)).toBeHidden();
		await expect(button(page)).toBeFocused();
		await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
	});

	test('Enter opens and Space closes the panel', async ({ page }) => {
		await button(page).focus();
		await page.keyboard.press('Enter');
		await expect(button(page)).toHaveAttribute('aria-expanded', 'true');
		await expect(panel(page)).toBeVisible();
		await page.keyboard.press('Space');
		await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(panel(page)).toBeHidden();
	});

	test('choosing a portal navigates and closes the panel', async ({ page }) => {
		await button(page).click();
		await panel(page).getByRole('link', { name: 'Investor' }).click();
		await expect(page).toHaveURL(/investor\/$/);
		await hydrated(page);
		await expect(panel(page)).toBeHidden();
		await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(panel(page).locator('a[aria-current="page"]')).toHaveText('Investor');
	});

	test('resizing to 640px closes the panel and swaps to the inline list', async ({ page }) => {
		await button(page).click();
		await expect(panel(page)).toBeVisible();
		await page.setViewportSize({ width: 640, height: 812 });
		await expect(button(page)).toBeHidden();
		await expect(panel(page)).toBeHidden();
		await expect(inlineList(page)).toBeVisible();
		await page.setViewportSize({ width: 639, height: 812 });
		await expect(button(page)).toBeVisible();
		// The open state was reset by the breakpoint crossing, not merely hidden by CSS.
		await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
		await expect(panel(page)).toBeHidden();
	});
});

test.describe('640px', () => {
	test.use({ viewport: { width: 640, height: 900 } });

	for (const route of CHROME_ROUTES) {
		test(`inline portal links replace the menu on ${JSON.stringify(route)}`, async ({ page }) => {
			await page.goto(route);
			await expect(page.locator('button[aria-controls="portal-menu"]')).toBeHidden();
			const inline = inlineList(page);
			for (const name of ['Renter', 'Investor', 'Agent']) {
				await expect(inline.getByRole('link', { name, exact: true })).toBeVisible();
			}
			const settings = inline.getByRole('link', { name: 'Settings', exact: true });
			if (PORTAL_ROUTES.includes(route)) await expect(settings).toBeVisible();
			else await expect(settings).toHaveCount(0);
		});
	}
});
