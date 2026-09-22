import { test, expect } from '@playwright/test';

// FND-03: the app must refuse to render inside a third-party frame. Meta CSP cannot carry
// frame-ancestors, so the only mitigation is <html hidden> plus static/frame-guard.js, which
// removes the attribute only when window.self === window.top. serve-pages.mjs hosts an attacker
// page on its own port (a different origin) that frames the ROOT build three ways; the iframe
// ids are a contract with that script. This spec runs on the `root` project only (the config
// sets testIgnore on `sub`), because the attacker page frames the root origin.
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);

// plain: an ordinary cross-origin frame (guard runs, top.location bust is blocked by Chromium
//        without a user gesture, content stays hidden)
// sandboxed: sandbox without allow-scripts, so the guard never runs and hidden is never removed
// sandboxed-scripts: sandbox with scripts + same-origin, so the guard runs but cannot navigate top
const FRAMES = ['plain', 'sandboxed', 'sandboxed-scripts'];

for (const id of FRAMES) {
	test(`the app stays hidden inside the #${id} cross-origin frame`, async ({ page }) => {
		await page.goto(`http://127.0.0.1:${ATTACKER}/`);
		await page.waitForLoadState('load');
		const frame = page.frameLocator(`#${id}`);
		// Assert the attribute is PRESENT first. This proves the framed document actually loaded and
		// the guard left it hidden; a never-loaded frame would make toBeHidden() alone pass vacuously.
		await expect(frame.locator('html')).toHaveAttribute('hidden', '');
		await expect(frame.locator('h1')).toBeHidden();
		// The attacker page itself must still be intact: the guard's top.location bust is blocked,
		// so we do not assert on navigation, only that the page under test was not replaced.
		expect(page.url()).toBe(`http://127.0.0.1:${ATTACKER}/`);
	});
}

test('positive control: the same page is visible when loaded at the top level', async ({
	page
}) => {
	// Without this, a guard that hid everything unconditionally would pass every frame test.
	await page.goto('');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1')).toBeVisible();
});
