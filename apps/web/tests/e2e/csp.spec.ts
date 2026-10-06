import { test, expect } from '@playwright/test';
import { ROUTES } from './routes';
import { announcer, fakeKey, openSettings, saveKey } from './helpers/settings';

// FND-02 at runtime: the build-time oracle (scripts/assert-csp.mjs) proves the policy TEXT is
// right; this spec proves the running app actually survives it in Chromium. Only built output is
// authoritative (in dev Kit loosens style-src), so this runs against serve-pages.mjs serving
// apps/web/build*. Relative page.goto paths keep one spec valid under both bases.

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

test('real Settings dialogs, radios and checkboxes run with zero CSP violations', async ({
	page
}) => {
	// The probe above proves the policy allows a Svelte transition; this proves the real Phase 3 UI
	// (bits-ui dialogs with their open/close animations, radio groups, checkboxes) runs under it.
	await installCollector(page);
	await openSettings(page);
	const styleCount = () => page.evaluate(() => document.querySelectorAll('style').length);
	const stylesBefore = await styleCount();
	expect(await violations(page)).toEqual([]);

	const key = fakeKey('openai');
	await saveKey(page, 'OpenAI', key);
	await expect(page.locator('#key-openai')).toContainText(`Key ending in ${key.slice(-4)}`);
	expect(await violations(page)).toEqual([]);

	// Forget all API keys? opens, animates, and closes on Escape.
	await page
		.locator('#api-keys')
		.getByRole('button', { name: 'Forget all keys', exact: true })
		.click();
	const forget = page.getByRole('alertdialog', { name: 'Forget all API keys?' });
	await expect(forget).toBeVisible();
	expect(await violations(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(forget).toBeHidden();
	expect(await violations(page)).toEqual([]);

	// Storage mode radios, both directions.
	const security = page.locator('#key-security');
	const remember = security.getByRole('radio', { name: 'Remember on this device', exact: true });
	const tabOnly = security.getByRole('radio', { name: 'This tab only (default)', exact: true });
	await remember.click();
	await expect(announcer(page)).toHaveText('Keys will be remembered on this device.');
	expect(await violations(page)).toEqual([]);
	await tabOnly.click();
	await expect(tabOnly).toBeChecked();
	expect(await violations(page)).toEqual([]);
	await remember.click();
	await expect(remember).toBeChecked();
	expect(await violations(page)).toEqual([]);

	// Add a passphrase dialog: tick and untick the checkbox, then Cancel.
	await security.getByRole('button', { name: 'Add a passphrase' }).click();
	const lock = page.getByRole('dialog', { name: 'Lock your remembered keys' });
	await expect(lock).toBeVisible();
	expect(await violations(page)).toEqual([]);
	const ack = lock.getByRole('checkbox');
	await ack.check();
	await expect(ack).toBeChecked();
	await ack.uncheck();
	await expect(ack).not.toBeChecked();
	expect(await violations(page)).toEqual([]);
	await lock.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(lock).toBeHidden();
	expect(await violations(page)).toEqual([]);

	// bits-ui writes styles through the CSSOM only: no <style> elements were injected.
	expect(await styleCount()).toBe(stylesBefore);
});

// Phase 8: the agent logo is an IndexedDB blob rendered through URL.createObjectURL, so the built
// policy must allow img-src blob: (same-origin script is the only thing that can mint one).
test('a same-origin blob: image (agent logo path) loads with zero CSP violations', async ({
	page
}) => {
	await installCollector(page);
	await page.goto('agent/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	const width = await page.evaluate(async () => {
		const c = document.createElement('canvas');
		c.width = 4;
		c.height = 2;
		const ctx = c.getContext('2d')!;
		ctx.fillRect(0, 0, 4, 2);
		const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
		const url = URL.createObjectURL(blob);
		const img = document.createElement('img');
		img.alt = 'probe';
		img.src = url;
		document.body.append(img);
		await img.decode();
		const w = img.naturalWidth;
		URL.revokeObjectURL(url);
		img.remove();
		return w;
	});
	expect(width).toBe(4);
	expect(await violations(page)).toEqual([]);
});

// The widening is blob: only: a data: image is still refused by img-src.
test('a data: image is still blocked by img-src', async ({ page }) => {
	await installCollector(page);
	await page.goto('agent/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await page.evaluate(() => {
		const img = document.createElement('img');
		img.alt = 'probe';
		img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
		document.body.append(img);
	});
	await expect.poll(() => violations(page)).toContainEqual(expect.stringMatching(/^img-src/));
});
