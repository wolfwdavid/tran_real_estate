// Cut line (CONTEXT): this spec is the first item to cut if time-boxed; the unit tests in
// lib/analytics remain.
//
// Real-browser proof of the first-party usage beacon (GTM-04) on the configured build, whose
// analytics host is the beacon collector on the attacker origin (10-05). Each beacon is read back
// as the collector saw it on the wire: body, Content-Type, Cookie, Referer, and any CORS preflight.
// The collector's record is shared by every worker and every configured-build page load sends a
// beacon, so this file tags its browser's user agent and reads and resets only its own entries
// (`/__beacons` filtered by `userAgent`).
import { test, expect, devices, type Page } from '@playwright/test';
import { TEST_WEBSITE_ID } from '../../../../scripts/lib/build-targets.mjs';
import { siteEnv } from './site-env';
import { beaconTag, beaconsFor, resetBeacons, type BeaconRecord } from './helpers/beacons';

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event. */
		__csp: string[];
		/** Survives client-side navigation only; a full page load drops it. */
		__sameDocument?: boolean;
	}
}

const env = siteEnv('configured');
const TAG = beaconTag('analytics');
const PAYLOAD_KEYS = ['website', 'hostname', 'url', 'referrer', 'screen', 'data'];

test.use({ userAgent: `${devices['Desktop Chrome'].userAgent} ${TAG}` });

/** This file's beacons and preflights, as the collector recorded them. */
const mine = (page: Page) => beaconsFor(page.request, env.collector, TAG);

const violations = (page: Page) => page.evaluate(() => window.__csp);

test.beforeEach(async ({ page }) => {
	expect(await resetBeacons(page.request, env.collector, TAG)).toBe(204);
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
});

/** The JSON payload of a recorded beacon, after checking the wire-level guarantees. */
function payloadOf(b: BeaconRecord) {
	expect(b.preflight, 'no CORS preflight').toBeUndefined();
	expect(b.cookie, 'no Cookie header').toBeNull();
	expect(b.referer, 'no Referer header').toBeNull();
	expect(String(b.contentType)).toMatch(/^text\/plain/);
	const parsed = JSON.parse(String(b.body)) as { type: string; payload: Record<string, unknown> };
	expect(parsed.type).toBe('event');
	for (const key of Object.keys(parsed.payload)) expect(PAYLOAD_KEYS).toContain(key);
	expect(parsed.payload.website).toBe(TEST_WEBSITE_ID);
	expect(['small', 'medium', 'large']).toContain(parsed.payload.screen);
	expect(String(parsed.payload.url)).not.toMatch(/[?#]/);
	return parsed.payload;
}

test('one beacon per navigation', async ({ page, context }) => {
	// A same-site cookie the browser WOULD send to the collector if the beacon allowed credentials
	// (cookies ignore ports, so 127.0.0.1:4276 → :4275 is same-site): makes the Cookie check real.
	await context.addCookies([{ name: 'tran_probe', value: '1', url: env.collector }]);

	await page.goto('');
	await expect.poll(async () => (await mine(page)).length).toBe(1);

	// Client-side navigation through the footer: the marker survives only if no full load happens.
	await page.evaluate(() => (window.__sameDocument = true));
	await page
		.getByRole('contentinfo')
		.getByRole('link', { name: 'For renters', exact: true })
		.click();
	await expect(page).toHaveURL(/\/for-renters\/$/);
	expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
	await expect.poll(async () => (await mine(page)).length).toBe(2);
	await page.waitForTimeout(1_000);

	const records = await mine(page);
	expect(records).toHaveLength(2); // exactly one per navigation, nothing extra
	const payloads = records.map(payloadOf);
	expect(payloads.map((p) => p.url)).toEqual(['/', '/for-renters/']);
	for (const p of payloads) {
		expect(p.hostname).toBe('127.0.0.1');
		expect(p.data).toEqual({ portal: 'none' });
		expect(p.referrer).toBeUndefined(); // direct load, then a same-site navigation
	}
	expect(await violations(page)).toEqual([]);
});

test('portal and query stripping', async ({ page }) => {
	// An external referrer is reduced to its origin: the domain, never the full address.
	await page.goto('renter/?id=abc#x', { referer: 'https://news.example.com/story/42?utm=x' });
	await expect.poll(async () => (await mine(page)).length).toBe(1);
	await page.waitForTimeout(1_000);
	const records = await mine(page);
	expect(records).toHaveLength(1);
	const p = payloadOf(records[0]);
	expect(p.url).toBe('/renter/');
	expect(p.data).toEqual({ portal: 'renter' });
	expect(p.referrer).toBe('https://news.example.com/');
	expect(await violations(page)).toEqual([]);
});

test('GPC suppresses', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true })
	);
	await page.goto('');
	await page.waitForLoadState('networkidle');
	await page.goto('for-investors/');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1_000);
	expect(await mine(page)).toHaveLength(0);
	expect(
		await page.evaluate(
			() => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
		)
	).toBe(true);
});

test('DNT suppresses', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' })
	);
	await page.goto('');
	await page.waitForLoadState('networkidle');
	await page.goto('for-investors/');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1_000);
	expect(await mine(page)).toHaveLength(0);
	expect(await page.evaluate(() => navigator.doNotTrack)).toBe('1');
});

test('privacy variant A', async ({ page }) => {
	await page.goto('legal/privacy/');
	const main = page.locator('main');
	await expect(main).toContainText('Each page view sends only');
	await expect(main).toContainText('If your browser sends Do Not Track or Global Privacy Control');
	await expect(main).toContainText(`Umami counter at ${new URL(env.analyticsHost).host}`);
	await expect(main).not.toContainText("doesn't count visits right now");
});
