// The Phase 7 route contract (07-UI-SPEC "Routes"): every investor route and the memo printout
// is a prerendered page with its h1, <title> and (except print) the Investor sub-nav with the
// right item current. Query strings never crash prerendered pages. Also smoke-tests the shared
// investor helpers so later specs can rely on them. Relative paths keep it valid on both bases.
import { parsePayload } from '../../../src/lib/data/rentcast/schemas';
import { INVESTOR_ROUTES } from '../routes';
import {
	INVESTOR_TEST_OPTIONS,
	MOCK_CITY,
	MOCK_ZIP,
	THIN_LISTINGS,
	blockRentCast,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	fewCompsRentEstimateBody,
	marketStatsBody,
	mockRentCast,
	printCount,
	rentEstimateBody,
	saleListingsBody,
	stubPrint,
	test,
	useMockedRentCastKey,
	valueEstimateBody
} from './helpers';
import { expectLiveMode } from '../support/seed';

test.use(INVESTOR_TEST_OPTIONS);

const CONTRACT: Record<string, { h1: string; title: string; current?: string }> = {
	'investor/': {
		h1: 'Investor portal',
		title: 'Investor portal: Tran Real Estate Tools',
		current: 'Overview'
	},
	'investor/analyze/': {
		h1: 'Analyze a deal',
		title: 'Analyze a deal: Tran Real Estate Tools',
		current: 'Analyze'
	},
	'investor/deals/': {
		h1: 'Saved deals',
		title: 'Saved deals: Tran Real Estate Tools',
		current: 'Deals'
	},
	'investor/compare/': {
		h1: 'Compare deals',
		title: 'Compare deals: Tran Real Estate Tools',
		current: 'Deals'
	},
	'investor/memo/': {
		h1: 'Investment memo',
		title: 'Investment memo: Tran Real Estate Tools',
		current: 'Deals'
	},
	'investor/buy-boxes/': {
		h1: 'Buy boxes',
		title: 'Buy boxes: Tran Real Estate Tools',
		current: 'Buy boxes'
	},
	'investor/markets/': {
		h1: 'Markets',
		title: 'Markets: Tran Real Estate Tools',
		current: 'Markets'
	},
	'investor/market/': {
		h1: 'ZIP market',
		title: 'ZIP market: Tran Real Estate Tools',
		current: 'Markets'
	},
	'print/memo/': { h1: 'Investment memo', title: 'Investment memo: Tran Real Estate Tools' }
};

test('the contract covers exactly the registered investor routes', () => {
	expect(Object.keys(CONTRACT).sort()).toEqual(
		[...INVESTOR_ROUTES, 'investor/', 'print/memo/'].sort()
	);
});

for (const [route, c] of Object.entries(CONTRACT)) {
	test(`route contract on ${JSON.stringify(route)}`, async ({ page }) => {
		const res = await page.goto(route);
		expect(res?.status()).toBe(200);
		await expect(page.locator('h1')).toHaveText(c.h1);
		await expect(page).toHaveTitle(c.title);
		const nav = page.getByRole('navigation', { name: 'Investor', exact: true });
		if (c.current === undefined) {
			await expect(nav).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Back to memo' })).toBeVisible();
			return;
		}
		await expect(nav.getByRole('link')).toHaveText([
			'Overview',
			'Analyze',
			'Deals',
			'Buy boxes',
			'Markets'
		]);
		const current = nav.locator('[aria-current="page"]');
		await expect(current).toHaveCount(1);
		await expect(current).toHaveText(c.current);
	});
}

test('the prerendered HTML already marks the current sub-nav item', async ({ page, request }) => {
	await page.goto('investor/compare/');
	const html = await (await request.get(page.url())).text();
	const nav = /<nav[^>]*aria-label="Investor"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
	expect(nav).toMatch(/<a[^>]*aria-current="page"[^>]*>Deals<\/a>/);
});

const QUERY_ROUTES = [
	['investor/analyze/?id=missing', 'Analyze a deal'],
	['investor/memo/?id=missing', 'Investment memo'],
	['investor/compare/?ids=a,b', 'Compare deals'],
	[`investor/market/?zip=${MOCK_ZIP}`, `ZIP ${MOCK_ZIP} market`],
	['investor/market/?zip=abc', 'ZIP market'],
	['print/memo/?id=missing&memo=x', 'Investment memo']
] as const;

for (const [url, h1] of QUERY_ROUTES) {
	test(`query string never crashes ${JSON.stringify(url)}`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(url);
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.locator('h1')).toHaveText(h1);
		expect(errors).toEqual([]);
	});
}

test('a valid ?zip= sets the document title in onMount', async ({ page }) => {
	await page.goto(`investor/market/?zip=${MOCK_ZIP}`);
	await expect(page).toHaveTitle(`ZIP ${MOCK_ZIP} market: Tran Real Estate Tools`);
});

test.describe('helpers', () => {
	test('mock bodies are synthetic fixture data that pass the Phase 4 schemas', async () => {
		const sales = await saleListingsBody();
		expect(sales.length).toBeGreaterThanOrEqual(4);
		for (const row of sales) {
			expect(row.zipCode).toBe(MOCK_ZIP);
			expect(`${String(row.city)}, ${String(row.state)}`).toBe(MOCK_CITY);
		}
		expect(parsePayload('sale-listings', sales)).toMatchObject({ ok: true, droppedRows: 0 });

		const rent = await rentEstimateBody();
		expect((rent.comparables as unknown[]).length).toBe(8);
		expect(parsePayload('rent-estimate', rent)).toMatchObject({ ok: true, droppedRows: 0 });
		const few = await fewCompsRentEstimateBody();
		expect((few.comparables as unknown[]).length).toBe(2);

		const value = await valueEstimateBody();
		expect(typeof value.price).toBe('number');
		expect(parsePayload('value-estimate', value)).toMatchObject({ ok: true });

		const market = await marketStatsBody(MOCK_ZIP);
		expect(parsePayload('markets', market)).toMatchObject({ ok: true });
		type Month = { dataByBedrooms: { bedrooms: number; totalListings: number }[] };
		const history = (market?.rentalData as { history: Record<string, Month> }).history;
		const months = Object.values(history);
		expect(months).toHaveLength(24);
		const beds = months.map((m) => m.dataByBedrooms.map((b) => b.bedrooms));
		expect(beds.filter((b) => !b.includes(3))).toHaveLength(1);
		expect(beds.every((b) => [0, 1, 2, 4].every((n) => b.includes(n)))).toBe(true);
		const thin = months.filter((m) =>
			m.dataByBedrooms.some((b) => b.bedrooms === 2 && b.totalListings === THIN_LISTINGS)
		);
		expect(thin).toHaveLength(1);
	});

	test('mockRentCast answers and counts the investor endpoints from the page', async ({
		page,
		net
	}) => {
		const rc = await mockRentCast(page, net, {
			respond: { valueEstimate: { status: 429, body: { error: 'auth/rate-limit-exceeded' } } }
		});
		await page.goto('investor/');
		const statuses = await page.evaluate(async (zip) => {
			const get = async (path: string) =>
				// eslint-disable-next-line no-restricted-syntax -- probing the mock from the page
				(await fetch(`https://api.rentcast.io${path}`, { headers: { 'X-Api-Key': 'x' } })).status;
			return [
				await get(`/v1/listings/sale?zipCode=${zip}`),
				await get(`/v1/markets?zipCode=${zip}&historyRange=24`),
				await get('/v1/avm/value?address=x'),
				await get('/v1/markets?zipCode=00001')
			];
		}, MOCK_ZIP);
		expect(statuses).toEqual([200, 200, 429, 404]);
		expect(rc.count()).toBe(4);
		expect(rc.count('/v1/markets')).toBe(2);
		expect(rc.urls).toHaveLength(4);
	});

	test('blockRentCast records calls; a fresh page makes none', async ({ page }) => {
		const blocked = await blockRentCast(page);
		await page.goto('investor/analyze/');
		await expect(page.locator('h1')).toBeVisible();
		expect(blocked.count()).toBe(0);
	});

	test('useMockedRentCastKey goes through Settings and turns on live mode', async ({
		page,
		net
	}) => {
		const rc = await mockRentCast(page, net);
		await useMockedRentCastKey(page);
		await page.goto('investor/deals/');
		await expectLiveMode(page);
		expect(rc.count()).toBe(0);
	});

	test('stubPrint counts window.print()', async ({ page }) => {
		await stubPrint(page);
		await page.goto('print/memo/');
		await page.evaluate(() => window.print());
		expect(await printCount(page)).toBe(1);
	});

	test('axe and 375px helpers pass on the investor overview', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('investor/');
		await expect(page.locator('h1')).toBeVisible();
		await expectNoHorizontalScroll(page);
		await expectNoAxeViolations(page, 'investor/ at 375px');
	});
});
