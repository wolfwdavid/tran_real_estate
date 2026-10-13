import { test, expect } from '@playwright/test';
import { TEST_FORM_KEY } from '../../../../scripts/lib/build-targets.mjs';
import { siteEnv } from './site-env';
import { beaconTag, beaconsFor, resetBeacons } from './helpers/beacons';

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

// Every configured-build page load now sends a real beacon, and the record is shared by every
// worker, so these checks tag their own requests by user agent and never wipe the whole record.
const TAG = beaconTag('harness');

async function postBeacon(body: string) {
	// eslint-disable-next-line no-restricted-syntax -- test harness talks to the local collector
	return fetch(`${env.collector}/api/send`, {
		method: 'POST',
		headers: { 'user-agent': TAG },
		body
	});
}

test('the collector reset removes recorded beacons', async ({ page }) => {
	await postBeacon('{"type":"event"}');
	expect((await beaconsFor(page.request, env.collector, TAG)).length).toBeGreaterThan(0);
	expect(await resetBeacons(page.request, env.collector, TAG)).toBe(204);
	expect(await beaconsFor(page.request, env.collector, TAG)).toEqual([]);
});

test('the collector records a POSTed beacon (non-vacuity)', async ({ page }) => {
	await resetBeacons(page.request, env.collector, TAG);
	const sent = await postBeacon('{"type":"event"}');
	expect(sent.status).toBe(200);
	expect(sent.headers.get('access-control-allow-origin')).toBeNull();
	const beacons = await beaconsFor(page.request, env.collector, TAG);
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
