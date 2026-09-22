import { test, expect } from '@playwright/test';

// FND-03: the app must refuse to render inside a third-party frame. Meta CSP cannot carry
// frame-ancestors, so the only mitigation is <html hidden> plus static/frame-guard.js, which
// removes the attribute only when window.self === window.top. serve-pages.mjs hosts an attacker
// page on its own port (a different origin) that frames the ROOT build three ways; the iframe
// ids are a contract with that script. This spec runs on the `root` project only (the config
// sets testIgnore on `sub`), because the attacker page frames the root origin.
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);
const ATTACKER_URL = `http://127.0.0.1:${ATTACKER}/`;
const ROOT = Number(process.env.E2E_PORT_ROOT ?? 4273);

// Tracing is off for this spec on purpose. Playwright's Chromium evaluations carry
// userGesture:true, and the trace snapshotter evaluates in EVERY frame around every action. If a
// snapshot lands in the #plain frame before its cross-origin navigation commits, the frame gains
// transient user activation, Chromium then permits the guard's top.location bust (which it
// otherwise blocks: "Unsafe attempt to initiate navigation"), the attacker page is replaced by
// the app at top level, and the frame assertions below cannot run. That is the guard doing its
// job after a (simulated) user gesture, not a defect, but it made the suite flaky under parallel
// workers (measured 2/4 full runs; 0/22 with plain Chromium and 0/16 with tracing off).
test.use({ trace: 'off' });

// plain: an ordinary cross-origin frame (guard runs, top.location bust is blocked by Chromium
//        without a user gesture, content stays hidden)
// sandboxed: sandbox without allow-scripts, so the guard never runs and hidden is never removed
// sandboxed-scripts: sandbox with scripts + same-origin, so the guard runs but cannot navigate top
const FRAMES: Record<string, string> = {
	plain: `http://127.0.0.1:${ROOT}/`,
	sandboxed: `http://127.0.0.1:${ROOT}/renter/`,
	'sandboxed-scripts': `http://127.0.0.1:${ROOT}/agent/`
};

for (const [id, src] of Object.entries(FRAMES)) {
	test(`the app stays hidden inside the #${id} cross-origin frame`, async ({ page }) => {
		await page.goto(ATTACKER_URL);
		// Wait for the frame to have committed its real document using only CDP-tracked state
		// (frame url and lifecycle events). Nothing here evaluates inside the frame, so no user
		// activation can be granted before the guard has already run.
		await expect.poll(() => page.frame({ name: id })?.url(), { message: `#${id} src` }).toBe(src);
		await page.frame({ name: id })?.waitForLoadState('load');

		const frame = page.frameLocator(`#${id}`);
		// Assert the attribute is PRESENT first. This proves the framed document actually loaded and
		// the guard left it hidden; a never-loaded frame would make toBeHidden() alone pass vacuously.
		await expect(frame.locator('html')).toHaveAttribute('hidden', '');
		await expect(frame.locator('h1')).toBeHidden();
		// The attacker page itself must still be intact: the guard's top.location bust is blocked
		// without a user gesture, so the page under test must not have been replaced.
		expect(page.url()).toBe(ATTACKER_URL);
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
