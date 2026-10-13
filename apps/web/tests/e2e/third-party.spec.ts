import { test, expect, type BrowserContext } from '@playwright/test';
import { ROUTES } from './routes';
import { siteEnv } from './site-env';

// GTM-04 success criterion 4: network inspection shows no third-party traffic and no third-party
// script tags. Runs on root and sub (keyless builds). The only cross-origin request a build may
// ever make on page load is the first-party usage beacon, a `fetch` to its own configured analytics
// host; the default builds have none, so for them every request must be same-origin.
// layout.spec.ts covers same-origin requests plus fonts; this spec adds the analytics allowance,
// network-idle settling per route, and the script-tag check.

const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);

interface Seen {
	type: string;
	url: string;
}

/** `${resourceType} ${url}` for every request that leaves the page's origin, except the beacon. */
function offenders(seen: readonly Seen[], pageOrigin: string, beaconOrigin: string | null) {
	return seen
		.filter(({ type, url }) => {
			const origin = new URL(url).origin;
			if (origin === pageOrigin) return false;
			return !(beaconOrigin !== null && type === 'fetch' && origin === beaconOrigin);
		})
		.map(({ type, url }) => `${type} ${url}`);
}

/** Records every request the context makes (pages and workers alike). */
function record(context: BrowserContext): Seen[] {
	const seen: Seen[] = [];
	context.on('request', (r) => seen.push({ type: r.resourceType(), url: r.url() }));
	return seen;
}

test('keyless: every request on every route is same-origin', async ({ page, context }) => {
	// One test walks every route, so its budget grows with ROUTES.
	test.setTimeout(ROUTES.length * 5_000);
	const env = siteEnv(test.info().project.name);
	const beaconOrigin = env.analyticsHost ? new URL(env.analyticsHost).origin : null;
	// A root build made with the owner's real Umami host must never post to it from CI.
	if (env.analyticsHost) {
		await page.route(`${env.analyticsHost}/**`, (r) => r.fulfill({ status: 200 }));
	}
	const seen = record(context);
	let total = 0;
	for (const route of ROUTES) {
		seen.length = 0;
		const res = await page.goto(route);
		expect(res?.status(), `status for ${JSON.stringify(route)}`).toBe(200);
		await page.waitForLoadState('networkidle');
		total += seen.length;
		const origin = new URL(page.url()).origin;
		expect(offenders(seen, origin, beaconOrigin), `offenders on ${JSON.stringify(route)}`).toEqual(
			[]
		);
	}
	expect(total).toBeGreaterThan(ROUTES.length); // non-vacuity: assets were collected
});

test('no third-party <script src> in any built page', async ({ page }) => {
	test.setTimeout(ROUTES.length * 4_000);
	let scripts = 0;
	for (const route of ROUTES) {
		await page.goto(route);
		const { srcs, origin } = await page.evaluate(() => ({
			srcs: [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((s) => s.src),
			origin: location.origin
		}));
		scripts += srcs.length;
		const foreign = srcs.filter((src) => new URL(src).origin !== origin);
		expect(foreign, `third-party script[src] on ${JSON.stringify(route)}`).toEqual([]);
	}
	// non-vacuity: the selector matches real tags (every page loads the same-origin frame guard)
	expect(scripts).toBeGreaterThanOrEqual(ROUTES.length);
});

test.describe('third-party filter control', () => {
	// CSP-blocked requests never fire `request`, so the policy is bypassed ONLY here to prove the
	// filter above would catch a third-party request if one were ever made.
	test.use({ bypassCSP: true });

	test('the filter reports exactly a planted cross-origin image (non-vacuity)', async ({
		page,
		context
	}) => {
		const env = siteEnv(test.info().project.name);
		const beaconOrigin = env.analyticsHost ? new URL(env.analyticsHost).origin : null;
		if (env.analyticsHost) {
			await page.route(`${env.analyticsHost}/**`, (r) => r.fulfill({ status: 200 }));
		}
		await page.goto('');
		await page.waitForLoadState('networkidle');
		const seen = record(context);
		const planted = `http://127.0.0.1:${ATTACKER}/x.png`;
		await page.evaluate((src) => {
			new Image().src = src;
		}, planted);
		await expect
			.poll(() => offenders(seen, new URL(page.url()).origin, beaconOrigin))
			.toEqual([`image ${planted}`]);
	});
});
