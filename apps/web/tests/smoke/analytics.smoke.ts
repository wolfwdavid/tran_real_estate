// SMOKE-05: the one smoke spec that runs with GPC OFF (the only importer of testGpcOff and the only
// user of beaconBudget; scripts/smoke-readonly.test.ts enforces both). A build with analytics sends
// exactly one page-view beacon and its host answers JSON 200; a build without analytics makes no
// cross-origin request even with GPC off. The worker is blocked so it cannot intercept the beacon.
import { testGpcOff as test, expect, smoke } from './fixtures';

test.use({ serviceWorkers: 'block', beaconBudget: 1 });

const origin = new URL(smoke.baseUrl).origin;

if (smoke.analyticsHost) {
	test('GPC off: exactly one page-view beacon and the analytics host answers JSON 200', async ({
		page
	}) => {
		const seen: { status: number; ct: string; body: unknown }[] = [];
		// The beacon is no-cors, so the page only ever sees an opaque response. Fetching it here
		// reaches the host exactly once and exposes the real status, headers and body.
		await page.route(`${smoke.analyticsHost}/api/send`, async (route) => {
			const res = await route.fetch();
			seen.push({
				status: res.status(),
				ct: res.headers()['content-type'] ?? '',
				body: await res.json()
			});
			await route.fulfill({ response: res });
		});
		await page.goto('');
		await expect.poll(() => seen.length).toBe(1);
		await page.waitForLoadState('networkidle');
		expect(seen).toHaveLength(1);
		// A 404 {"error":"Website not found"} here means the wrong host or website id
		// (docs/DEPLOY-CHECKLIST.md Step 8).
		expect(seen[0].status).toBe(200);
		expect(seen[0].ct).toContain('application/json');
		expect(typeof seen[0].body).toBe('object');
	});
} else {
	test('GPC off with analytics unset: zero cross-origin requests', async ({ page, context }) => {
		const seen: string[] = [];
		context.on('request', (r) => seen.push(r.url()));
		const res = await page.goto('');
		expect(res?.status()).toBe(200);
		await page.waitForLoadState('networkidle');
		expect(seen.filter((u) => new URL(u).origin !== origin)).toEqual([]);
		expect(seen.filter((u) => new URL(u).origin === origin).length).toBeGreaterThan(0);
	});
}
