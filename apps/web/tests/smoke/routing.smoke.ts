// SMOKE-02 routing contracts against a served build: the landing and its brand title, the
// slashless-directory redirect GitHub Pages performs, a deep portal route that survives a reload,
// and the branded 404 for an unknown path. Read-only: navigation and GETs only.
import { test, expect, smoke } from './fixtures';
import { NOT_FOUND } from '../e2e/routes';

test('landing answers 200 with the brand title', async ({ page }) => {
	const res = await page.goto('');
	expect(res?.status()).toBe(200);
	await expect(page).toHaveTitle(/Tran Real Estate Tools/);
});

test('a slashless directory answers 301 to the slash form', async ({ request }) => {
	const res = await request.get('renter', { maxRedirects: 0 });
	expect(res.status()).toBe(301);
	// serve-pages answers a relative Location, live Pages an absolute one: resolve both the same way.
	const location = res.headers()['location'] ?? '';
	expect(new URL(location, new URL('renter', smoke.baseUrl)).href).toBe(
		new URL('renter/', smoke.baseUrl).href
	);
});

test('a deep portal route survives a reload', async ({ page }) => {
	const res = await page.goto('investor/deals/');
	expect(res?.status()).toBe(200);
	await expect(page.locator('h1')).toBeVisible();
	const again = await page.reload();
	expect(again?.status()).toBe(200);
	await expect(page.locator('h1')).toBeVisible();
});

test('an unknown path answers HTTP 404 with the branded page', async ({ page }) => {
	const res = await page.goto(NOT_FOUND);
	expect(res?.status()).toBe(404);
	await expect(page.locator('h1')).toContainText('404');
});
