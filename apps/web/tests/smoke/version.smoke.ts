// SMOKE-02 build stamp: the served /_app/version.json is the commit the deploy was built from.
// The propagation wait (up to 10 minutes remote) happens in scripts/smoke.mjs before Playwright
// starts; this spec checks once and never polls.
import { test, expect, smoke } from './fixtures';

test('version.json equals SMOKE_EXPECT_VERSION', async ({ request }) => {
	const res = await request.get(`_app/version.json?_=${smoke.expectVersion}-${Date.now()}`, {
		headers: { 'cache-control': 'no-cache' }
	});
	expect(res.status()).toBe(200);
	expect((await res.json()).version).toBe(smoke.expectVersion);
});
