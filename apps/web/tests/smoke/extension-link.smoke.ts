// SMOKE-02: the browser extension's PRIVACY_URL points at /legal/privacy/#browser-extension, so the
// served privacy page must carry exactly one element with that id.
import { test, expect } from './fixtures';

test('the privacy page carries the #browser-extension section', async ({ page }) => {
	const res = await page.goto('legal/privacy/');
	expect(res?.status()).toBe(200);
	await expect(page.locator('#browser-extension')).toHaveCount(1);
});
