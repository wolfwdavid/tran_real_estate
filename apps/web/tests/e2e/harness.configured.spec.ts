import { test, expect } from '@playwright/test';
import { TEST_FORM_KEY } from '../../../../scripts/lib/build-targets.mjs';
import { siteEnv } from './site-env';

// Harness smoke for the configured build (10-05): the build carries the test owner settings and
// the first-party collector on the attacker origin records beacons that specs can read back.
const env = siteEnv('configured');

test.describe.configure({ mode: 'serial' }); // the collector record is shared in-memory state

test('the configured build allows its analytics host in connect-src', async ({ page }) => {
	const res = await page.goto('');
	expect(res?.status()).toBe(200);
	const csp = await page
		.locator('meta[http-equiv="content-security-policy"]')
		.getAttribute('content');
	const connect = (csp ?? '')
		.split(';')
		.map((d) => d.trim())
		.find((d) => d.startsWith('connect-src '));
	expect(env.analyticsHost).not.toBe('');
	expect(connect?.split(/\s+/)).toContain(env.analyticsHost);
});

test('the collector resets to an empty record', async ({ page }) => {
	const reset = await page.request.post(`${env.collector}/__beacons/reset`);
	expect(reset.status()).toBe(204);
	const got = await page.request.get(`${env.collector}/__beacons`);
	expect(await got.json()).toEqual([]);
});

test('the collector records a POSTed beacon (non-vacuity)', async ({ page }) => {
	await page.request.post(`${env.collector}/__beacons/reset`);
	// eslint-disable-next-line no-restricted-syntax -- test harness talks to the local collector
	const sent = await fetch(`${env.collector}/api/send`, {
		method: 'POST',
		body: '{"type":"event"}'
	});
	expect(sent.status).toBe(200);
	expect(sent.headers.get('access-control-allow-origin')).toBeNull();
	const beacons = await (await page.request.get(`${env.collector}/__beacons`)).json();
	expect(beacons).toHaveLength(1);
	expect(beacons[0].body).toBe('{"type":"event"}');
	expect(String(beacons[0].contentType)).toMatch(/^text\/plain/);
	expect(beacons[0].preflight).toBeUndefined();
});

test('siteEnv reports the test form key for the configured project', () => {
	expect(env.web3formsKey).toBe(TEST_FORM_KEY);
	expect(env.websiteId).not.toBe('');
	expect(env.contactEmail).not.toBe('');
});
