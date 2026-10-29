// SMOKE-02 zero third-party traffic: with GPC on (the fixture default) every prerendered route
// makes requests to its own origin only, so even the analytics-configured build sends no beacon.
// Read-only: navigation only.
import { test, expect, smoke } from './fixtures';
import { ROUTES } from '../e2e/routes';

const origin = new URL(smoke.baseUrl).origin;

for (const route of ROUTES) {
	test(`/${route} makes zero cross-origin requests`, async ({ page, context }) => {
		const seen: { type: string; url: string }[] = [];
		context.on('request', (r) => seen.push({ type: r.resourceType(), url: r.url() }));
		const res = await page.goto(route);
		expect(res?.status()).toBe(200);
		await page.waitForLoadState('networkidle');
		expect(
			seen.filter((s) => new URL(s.url).origin !== origin).map((s) => `${s.type} ${s.url}`)
		).toEqual([]);
		// non-vacuity: the recorder saw the page's own scripts
		expect(seen.some((s) => s.type === 'script' && new URL(s.url).origin === origin)).toBe(true);
	});
}
