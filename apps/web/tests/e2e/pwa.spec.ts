import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { NOT_FOUND } from './routes';

// PLAT-06 at runtime: the app-shell service worker and the install manifest, on both bases.
// The worker is allowlist-only (src/service-worker.ts), so beyond "it works offline" these tests
// prove what it must NOT do: answer unknown paths (404s stay real), touch provider hosts
// (page.route() mocks still intercept), precache dotfiles, or trip the meta CSP.

const baseOf = (testInfo: TestInfo) => new URL(testInfo.project.use.baseURL!).pathname;

const swReady = (page: Page) =>
	page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));

/** Loads the start page, waits for the worker to activate, then reloads so it controls the page. */
async function controlled(page: Page) {
	await page.goto('');
	await swReady(page);
	await page.reload();
	await expect
		.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
		.toBe(true);
}

test('registers with scope {base}/ and controls the page after reload', async ({
	page
}, testInfo) => {
	await page.goto('');
	expect(await swReady(page)).toBe(new URL('./', testInfo.project.use.baseURL!).href);
	await page.reload();
	await page.evaluate(() => navigator.serviceWorker.ready);
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});

test('precache holds only build assets under the base, never dotfiles', async ({
	page
}, testInfo) => {
	const base = baseOf(testInfo);
	await page.goto('');
	await swReady(page);
	const { keys, urls, origin } = await page.evaluate(async () => {
		const keys = await caches.keys();
		const urls =
			keys.length === 1 ? (await (await caches.open(keys[0])).keys()).map((r) => r.url) : [];
		return { keys, urls, origin: location.origin };
	});
	expect(keys).toHaveLength(1);
	expect(keys[0]).toMatch(/^tran-shell-/);
	expect(urls.length).toBeGreaterThan(0);
	for (const u of urls) {
		const url = new URL(u);
		expect(url.origin, u).toBe(origin);
		expect(url.pathname.startsWith(base), u).toBe(true);
		expect(url.pathname.endsWith('/.nojekyll'), u).toBe(false);
		expect(
			url.pathname.split('/').some((seg) => seg.startsWith('.')),
			u
		).toBe(false);
		expect(url.pathname.endsWith('/service-worker.js'), u).toBe(false);
	}
	const paths = urls.map((u) => new URL(u).pathname);
	expect(paths).toContain(`${base}manifest.webmanifest`);
	expect(paths).toContain(`${base}icons/icon-192.png`);
	expect(paths).toContain(`${base}renter/`);
});

test('an unknown path still returns 404 while the worker controls the page', async ({ page }) => {
	await controlled(page);
	const res = await page.goto(NOT_FOUND);
	expect(NOT_FOUND).toBe('does-not-exist/deeper/');
	expect(res?.status()).toBe(404);
});

test('provider-host page.route() mocks still intercept while controlled', async ({ page }) => {
	let hits = 0;
	await page.route('https://api.rentcast.io/**', (route) => {
		hits += 1;
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: '{"ok":true}',
			headers: { 'access-control-allow-origin': '*' }
		});
	});
	await controlled(page);
	const body = await page.evaluate(() =>
		// eslint-disable-next-line no-restricted-syntax -- E2E proves the SW leaves cross-origin requests to the network
		fetch('https://api.rentcast.io/v1/ping').then((r) => r.json())
	);
	expect(body).toEqual({ ok: true });
	expect(hits).toBe(1);
});

test('navigates to a prerendered page while offline', async ({ page, context }) => {
	await controlled(page);
	await context.setOffline(true);
	try {
		await page.goto('renter/');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
	} finally {
		await context.setOffline(false);
	}
});

test('zero CSP violations with the worker active', async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __csp: string[] };
		w.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
	const violations = () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
	await page.goto('');
	await swReady(page);
	expect(await violations()).toEqual([]);
	await page.reload();
	await page.evaluate(() => navigator.serviceWorker.ready);
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
	expect(await violations()).toEqual([]);
	await page.goto('settings/');
	await expect(page.locator('h1')).toBeVisible();
	expect(await violations()).toEqual([]);
});

test('Chromium parses the manifest without errors and every icon is a PNG', async ({
	page
}, testInfo) => {
	const base = baseOf(testInfo);
	await page.goto('');
	await page.evaluate(() => navigator.serviceWorker.ready);
	const cdp = await page.context().newCDPSession(page);
	const m = (await cdp.send('Page.getAppManifest')) as {
		url: string;
		errors: unknown[];
		data?: string;
	};
	expect(m.errors).toEqual([]);
	expect(new URL(m.url).pathname).toBe(`${base}manifest.webmanifest`);
	const manifest = JSON.parse(m.data ?? '') as {
		start_url: string;
		icons: { src: string; type: string }[];
	};
	expect(manifest.start_url).toBe('./');
	expect(manifest.icons.length).toBeGreaterThan(0);
	for (const icon of manifest.icons) {
		const res = await page.request.get(new URL(icon.src, m.url).href);
		expect(res.status(), icon.src).toBe(200);
		expect(res.headers()['content-type'], icon.src).toMatch(/^image\/png/);
	}
	const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
	expect(apple).toBeTruthy();
	const appleRes = await page.request.get(new URL(apple!, page.url()).href);
	expect(appleRes.status()).toBe(200);
	expect(appleRes.headers()['content-type']).toMatch(/^image\/png/);

	// Logged only: an empty installability list is not a sufficient oracle (RESEARCH Pitfall 12).
	const inst = await cdp.send('Page.getInstallabilityErrors');
	testInfo.annotations.push({
		type: 'installability',
		description: JSON.stringify(inst.installabilityErrors)
	});
});

test('pwa-capture.js is loaded in <head> and captures the install prompt', async ({ page }) => {
	await page.goto('');
	await expect(page.locator('head script[src$="pwa-capture.js"]')).toHaveCount(1);
	const result = await page.evaluate(() => {
		const e = new Event('beforeinstallprompt', { cancelable: true });
		Object.assign(e, {
			prompt: () => Promise.resolve(),
			userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' })
		});
		window.dispatchEvent(e);
		const w = window as unknown as { __tranInstallPrompt?: Event };
		return { captured: w.__tranInstallPrompt === e, prevented: e.defaultPrevented };
	});
	expect(result).toEqual({ captured: true, prevented: true });
});
