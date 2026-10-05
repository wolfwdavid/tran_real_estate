import type { Page } from '@playwright/test';
import { openSettingsPage } from './helpers/data';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls } from './support/network';
import { mockRentCast, MARKETS_PATH, PROBE_ZIP, rentcastFixtures } from './support/rentcast-mocks';
import {
	expectLiveMode,
	expectSampleMode,
	TEST_RENTCAST_KEY,
	withRentCastKey
} from './support/seed';

// Smoke spec for the shared renter E2E harness (06-09): every later renter spec relies on the
// deny-all, the synthetic tile, the RentCast mocks and the mocked-key seed, so each piece is
// proven here first, including that the deny-all is not vacuous.

test.use(RENTER_TEST_OPTIONS);

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event (csp.spec.ts). */
		__csp: string[];
	}
}

/** The csp.spec.ts collector: installed before the first navigation. */
async function installCollector(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
}

const violations = (page: Page) => page.evaluate(() => window.__csp);

async function openRenter(page: Page): Promise<void> {
	await page.goto('renter/');
	await expect(page.locator('main h1').first()).toBeVisible();
}

test('deny-all blocks and records an external request', async ({ page, net }) => {
	await openRenter(page);
	// A host the CSP allows but no mock answers: only the router can stop it. (A host outside
	// connect-src, such as example.org, would be refused by the CSP before routing, which would
	// leave net.external empty and prove nothing about the deny-all.)
	const url = 'https://api.openai.com/v1/models';
	const outcome = await page.evaluate(
		(target) =>
			// eslint-disable-next-line no-restricted-syntax -- E2E proves the deny-all router stops a CSP-allowed cross-origin fetch
			fetch(target).then(
				() => 'reached',
				() => 'blocked'
			),
		url
	);
	expect(outcome).toBe('blocked');
	expect(net.external).toEqual([url]);
	// Intentional probe: clear it so the fixture's teardown assertion stays meaningful.
	net.external.length = 0;
});

test('a tile loads through the mock, under CSP, with a Referer', async ({ page, net }) => {
	await installCollector(page);
	await openRenter(page);
	const before = net.counts.tiles ?? 0;
	await page.evaluate(() => {
		const img = document.createElement('img');
		img.id = 't';
		img.alt = '';
		img.src = 'https://tile.openstreetmap.org/1/0/0.png';
		document.body.appendChild(img);
	});
	await expect
		.poll(() =>
			page.evaluate(() => (document.getElementById('t') as HTMLImageElement).naturalWidth)
		)
		.toBe(256);
	expect(net.counts.tiles).toBe(before + 1);
	expect(net.tileReferers[before]).not.toBe('');
	expect(await violations(page)).toEqual([]);
});

test('a data: image is blocked by img-src (non-vacuity)', async ({ page }) => {
	await installCollector(page);
	await openRenter(page);
	expect(await violations(page)).toEqual([]);
	await page.evaluate(() => {
		const img = document.createElement('img');
		img.alt = '';
		// A 1x1 transparent GIF: img-src must not allow data: (06-04).
		img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
		document.body.appendChild(img);
	});
	await expect
		.poll(() => violations(page))
		.toEqual(expect.arrayContaining([expect.stringMatching(/^img-src/)]));
});

test('service workers are blocked', async ({ page }) => {
	await openRenter(page);
	// A registered worker would control the page after a reload; with serviceWorkers 'block' none does.
	await page.reload();
	await expect(page.locator('main h1').first()).toBeVisible();
	expect(await page.evaluate(() => navigator.serviceWorker?.controller ?? null)).toBeNull();
});

test('mocked key switches to live mode and the key probe costs 0', async ({ page, net }) => {
	await mockRentCast(page, net);
	await withRentCastKey(page);

	// Keyless control first is impossible here (the seed runs before the first page), so the seed
	// itself is checked through Settings: the vault reports the fake key as saved.
	await openSettingsPage(page);
	const card = page.locator('#key-rentcast');
	await expect(card).toContainText(`Key ending in ${TEST_RENTCAST_KEY.slice(-4)}`);

	// The real "Test key" button sends the zero-cost probe; the mock answers 404 (valid key).
	await card.getByRole('button', { name: 'Test key (0 calls)' }).click();
	await expect(
		card.getByText("RentCast accepted this key. The test didn't use a call.")
	).toBeVisible();
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(1);
	expect(net.counts[`api.rentcast.io${MARKETS_PATH}`]).toBe(1);
	const probe = new URL(net.requests[0]!.url);
	expect(probe.searchParams.get('zipCode')).toBe(PROBE_ZIP);
	expect(probe.href).not.toContain(TEST_RENTCAST_KEY);

	await openRenter(page);
	await expectLiveMode(page);
	await expect(page.getByRole('region', { name: 'Data source' })).toContainText('0 of 50');
	// Opening the portal spent nothing: the only RentCast request is still the probe.
	expect(rentcastCalls(net)).toBe(1);
});

test('without a seeded key the portal stays in sample mode and makes no RentCast request', async ({
	page,
	net
}) => {
	await mockRentCast(page, net);
	await openRenter(page);
	await expectSampleMode(page);
	expect(rentcastCalls(net)).toBe(0);
});

/** GETs a RentCast URL from the page (through the routes) and returns status + parsed body. */
async function rentcastGet(page: Page, url: string): Promise<{ status: number; body: unknown }> {
	return page.evaluate(async (target) => {
		// eslint-disable-next-line no-restricted-syntax -- E2E exercises the RentCast mock through the page's own network stack
		const res = await fetch(target, { headers: { 'X-Api-Key': 'mock' } });
		return { status: res.status, body: await res.json() };
	}, url);
}

test('RentCast mock variants: 500 rows, extra rows, by id, comps slice, no markets', async ({
	page,
	net
}) => {
	const { rentals, estimates } = rentcastFixtures();
	const first = rentals[0]!;
	const zip = String(first.zipCode);
	const extra = { ...first, id: `${String(first.id)}-extra` };
	const subject = String(estimates.rent[0]!.formattedAddress);
	const base = 'https://api.rentcast.io/v1';

	// Default variant: the fixture rows for one ZIP, a by-id hit, all comps, market stats.
	await mockRentCast(page, net, { extraRows: [extra] });
	await openRenter(page);
	const fixtureRows = rentals.filter((r) => r.zipCode === zip && r.status === 'Active');
	const list = await rentcastGet(
		page,
		`${base}/listings/rental/long-term?zipCode=${zip}&limit=500`
	);
	expect(list.status).toBe(200);
	expect((list.body as unknown[]).length).toBe(fixtureRows.length + 1);
	expect((list.body as { id: string }[]).at(-1)!.id).toBe(extra.id);
	const byId = await rentcastGet(page, `${base}/listings/rental/long-term/${String(first.id)}`);
	expect(byId.status).toBe(200);
	expect((byId.body as { id: string }).id).toBe(first.id);
	expect((await rentcastGet(page, `${base}/listings/rental/long-term?zipCode=99999`)).status).toBe(
		404
	);
	const estimate = await rentcastGet(
		page,
		`${base}/avm/rent/long-term?address=${encodeURIComponent(subject)}`
	);
	expect((estimate.body as { comparables: unknown[] }).comparables).toHaveLength(5);
	expect((await rentcastGet(page, `${base}/markets?zipCode=${zip}`)).status).toBe(200);
	expect(rentcastCalls(net, '/v1/listings/rental/long-term')).toBe(2);
	expect(rentcastCalls(net)).toBe(5);

	// The other variants: later routes win, so this mock replaces the first one.
	await mockRentCast(page, net, {
		rows: 'many500',
		estimateComps: 2,
		markets: 'none',
		byIdMissing: true
	});
	const many = await rentcastGet(
		page,
		`${base}/listings/rental/long-term?zipCode=${zip}&limit=500`
	);
	const ids = (many.body as { id: string }[]).map((r) => r.id);
	expect(ids).toHaveLength(500);
	expect(new Set(ids).size).toBe(500);
	expect(ids.every((id) => /-c\d+$/.test(id))).toBe(true);
	expect(
		(await rentcastGet(page, `${base}/listings/rental/long-term/${String(first.id)}`)).status
	).toBe(404);
	const trimmed = await rentcastGet(
		page,
		`${base}/avm/rent/long-term?address=${encodeURIComponent(subject)}`
	);
	expect((trimmed.body as { comparables: unknown[] }).comparables).toHaveLength(2);
	expect((await rentcastGet(page, `${base}/markets?zipCode=${zip}`)).status).toBe(404);
	expect((await rentcastGet(page, `${base}/markets?zipCode=${PROBE_ZIP}`)).status).toBe(404);
	expect(rentcastCalls(net)).toBe(10);
});
