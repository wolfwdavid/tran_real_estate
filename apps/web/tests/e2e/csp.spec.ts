import { test, expect } from '@playwright/test';

// FND-02 at runtime: the build-time oracle (scripts/assert-csp.mjs) proves the policy TEXT is
// right; this spec proves the running app actually survives it in Chromium. Only built output is
// authoritative (in dev Kit loosens style-src), so this runs against serve-pages.mjs serving
// apps/web/build*. Relative page.goto paths keep one spec valid under both bases.
const ROUTES = ['', 'renter/', 'investor/', 'agent/', 'settings/', 'print/'];

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event. */
		__csp: string[];
	}
}

// The collector must be installed BEFORE the first navigation: the securitypolicyviolation
// events we care about fire while the document is still loading (boot script, stylesheet,
// frame-guard.js), long before any test code could attach a listener after the fact.
async function installCollector(page: import('@playwright/test').Page) {
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
}

const violations = (page: import('@playwright/test').Page) => page.evaluate(() => window.__csp);

test('every route loads at top level with zero CSP violations', async ({ page }) => {
	await installCollector(page);
	for (const route of ROUTES) {
		const res = await page.goto(route);
		expect(res?.status(), `status for ${JSON.stringify(route)}`).toBe(200);
		// The frame guard is a script the policy must allow: if it were blocked the page would
		// stay hidden, so this doubles as a check that script-src 'self' covers it.
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1')).toBeVisible();
		expect(await violations(page), `violations on ${JSON.stringify(route)}`).toEqual([]);
	}
});

test('a Svelte transition and an inline style attribute run without a style-src-attr violation', async ({
	page
}) => {
	await installCollector(page);
	await page.goto('settings/');
	const toggle = page.getByTestId('csp-transition-toggle');
	const target = page.getByTestId('csp-transition-target');

	// Run the intro AND the outro to completion: whatever the transition writes, it writes while
	// the animation is in flight, so reading the collector before the panel is hidden again would
	// miss the outro. (Svelte 5.57's fade drives Element.animate() keyframes; a probe during this
	// plan recorded no `style` attribute mutations, so the explicit setAttribute check below is
	// what actually proves style-src-attr 'unsafe-inline' is live, independent of Svelte's
	// implementation choice.)
	await toggle.click();
	await expect(target).toBeVisible();
	await toggle.click();
	await expect(target).toBeHidden();
	expect(await violations(page)).toEqual([]);

	// D3 proof: an inline style ATTRIBUTE write is exactly what style-src-attr governs (CSSOM
	// property writes are not governed by CSP at all). Phase 2's UI primitives render such
	// attributes, so this must stay permitted while style-src itself stays 'self'.
	await page.evaluate(() => {
		document.querySelector('h1')?.setAttribute('style', 'opacity: 0.99');
	});
	await expect(page.locator('h1')).toHaveCSS('opacity', '0.99');
	expect(await violations(page)).toEqual([]);
});

test('the collector reports a deliberately provoked violation (non-vacuity control)', async ({
	page
}) => {
	await installCollector(page);
	await page.goto('');
	expect(await violations(page)).toEqual([]);

	// An un-hashed inline script is exactly what script-src 'self' + hashes must refuse. If this
	// were NOT reported, every empty-list assertion above would be meaningless.
	await page.evaluate(() => {
		const s = document.createElement('script');
		s.textContent = 'window.__cspProbeRan = true;';
		document.head.appendChild(s);
	});
	// The violation event is queued as a task, so poll rather than read synchronously.
	await expect
		.poll(() => violations(page))
		.toEqual(expect.arrayContaining([expect.stringMatching(/^script-src(-elem)? inline$/)]));
	expect(await page.evaluate(() => '__cspProbeRan' in window)).toBe(false);
});
