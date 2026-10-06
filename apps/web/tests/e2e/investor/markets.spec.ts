// Markets and the ZIP dashboard (07-13, INV-05) on the real build, both bases.
//
// Proves: the cost is shown before the click ("Watch ZIP (1 call)", "(0 calls · cached)",
// "(0 calls · sample data)"); a new ZIP costs exactly 1 call after the click, a cached one 0;
// opening or reloading a page never spends; the 6th ZIP is refused; and the live LayerChart
// SVGs are named and described, use 14px tick labels and token colors only, raise zero CSP
// violations, and pass axe. SSR unit tests cannot see the plot, so this spec is its proof.
//
// "79999"-style ZIPs are not in the sample fixtures, so live-mode specs answer /v1/markets for
// ANY ZIP with the MOCK_ZIP market body re-labelled (24 months, a 3-bedroom gap month, a thin
// 2-bedroom month). Sample mode is only ever exercised with the fixture ZIP MOCK_ZIP.
import type { Page } from '@playwright/test';
import {
	GAP_MONTH_OFFSET,
	INVESTOR_TEST_OPTIONS,
	MOCK_ZIP,
	THIN_MONTH_OFFSET,
	blockRentCast,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	marketStatsBody,
	mockRentCast,
	test,
	useMockedRentCastKey,
	type MockResult,
	type Net
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const LIVE_ZIP = '79999';
const MARKETS = '/v1/markets';

type Side = { history?: Record<string, unknown> } & Record<string, unknown>;

/** The MOCK_ZIP market body re-labelled for `zip` (optionally cut to its latest month only). */
async function marketsFor(url: URL, opts: { singleMonth?: boolean } = {}): Promise<MockResult> {
	const zip = url.searchParams.get('zipCode') ?? '';
	const body = (await marketStatsBody(MOCK_ZIP)) as Record<string, unknown> & {
		rentalData?: Side;
		saleData?: Side;
	};
	const cut = (side?: Side) => {
		if (!side || !opts.singleMonth) return side;
		const keys = Object.keys(side.history ?? {}).sort();
		const lastKey = keys[keys.length - 1];
		return { ...side, history: { [lastKey]: side.history?.[lastKey] } };
	};
	return {
		status: 200,
		body: {
			...body,
			id: zip,
			zipCode: zip,
			rentalData: cut(body.rentalData),
			saleData: cut(body.saleData)
		}
	};
}

async function liveMarkets(page: Page, net: Net, opts: { singleMonth?: boolean } = {}) {
	const rc = await mockRentCast(page, net, {
		respond: { markets: (url) => marketsFor(url, opts) }
	});
	await useMockedRentCastKey(page);
	return rc;
}

const zipInput = (page: Page) => page.getByLabel('ZIP code');
const watchButton = (page: Page) => page.getByRole('button', { name: /^Watch ZIP/ });
const cardHeading = (page: Page, zip: string) =>
	page.getByRole('heading', { level: 2, name: `ZIP ${zip}`, exact: true });

async function openMarkets(page: Page): Promise<void> {
	await page.goto('investor/markets/');
	await expect(page.getByText(/of 5 ZIP codes watched$/)).toBeVisible();
}

/** Types a ZIP and waits for the free cost label, then clicks and waits for the card. */
async function watch(page: Page, zip: string, cost: string): Promise<void> {
	await zipInput(page).fill(zip);
	await expect(watchButton(page)).toHaveAccessibleName(`Watch ZIP ${cost}`);
	await watchButton(page).click();
	await expect(cardHeading(page, zip)).toBeFocused();
}

/** Dashboard with both live charts drawn. */
async function openDashboard(page: Page, zip: string): Promise<void> {
	await page.goto(`investor/market/?zip=${zip}`);
	await expect(page.locator('h1')).toHaveText(`ZIP ${zip} market`);
	await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
}

test('keyless: sample data at 0 calls, never a RentCast request', async ({ page }) => {
	const blocked = await blockRentCast(page);
	await openMarkets(page);
	await expect(page.getByRole('heading', { name: 'No ZIP codes watched yet' })).toBeVisible();
	await expect(page.getByText('0 of 5 ZIP codes watched')).toBeVisible();
	await expectNoAxeViolations(page, 'markets empty (sample)');

	await watch(page, MOCK_ZIP, '(0 calls · sample data)');
	const card = page.locator('article', { has: cardHeading(page, MOCK_ZIP) });
	await expect(card.getByText('Sample data').first()).toBeVisible();

	await card.getByRole('link', { name: 'Open dashboard' }).click();
	await expect(page.locator('h1')).toHaveText(`ZIP ${MOCK_ZIP} market`);
	await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
	await expect(page.locator('figure').first()).toContainText('(sample data)');
	expect(blocked.count()).toBe(0);
	expect(blocked.urls).toEqual([]);
});

test('live: 1 call shown first and spent on the click; cached re-watch and reload cost 0', async ({
	page,
	net
}) => {
	const rc = await liveMarkets(page, net);
	await openMarkets(page);
	expect(rc.count(MARKETS)).toBe(0);

	await zipInput(page).fill(LIVE_ZIP);
	await expect(watchButton(page)).toHaveAccessibleName('Watch ZIP (1 call)');
	expect(rc.count(MARKETS)).toBe(0); // the label is free
	await watchButton(page).click();
	await expect(cardHeading(page, LIVE_ZIP)).toBeFocused();
	expect(rc.count(MARKETS)).toBe(1);
	const card = page.locator('article', { has: cardHeading(page, LIVE_ZIP) });
	await expect(card.locator('dd').first()).toContainText('$');
	await expect(card.locator('dd').nth(1)).toContainText('$');
	await expect(page.getByText('1 of 5 ZIP codes watched')).toBeVisible();

	await page.reload();
	await expect(cardHeading(page, LIVE_ZIP)).toBeVisible();
	await expect(card.locator('dd').first()).toContainText('$');
	expect(rc.count(MARKETS)).toBe(1);

	await card.getByRole('button', { name: 'Stop watching' }).click();
	await expect(cardHeading(page, LIVE_ZIP)).toHaveCount(0);
	await expect(zipInput(page)).toBeFocused();
	await expect(page.getByText('0 of 5 ZIP codes watched')).toBeVisible();

	await zipInput(page).fill(LIVE_ZIP);
	await expect(watchButton(page)).toHaveAccessibleName('Watch ZIP (0 calls · cached)');
	await watchButton(page).click();
	await expect(cardHeading(page, LIVE_ZIP)).toBeFocused();
	expect(rc.count(MARKETS)).toBe(1);

	// Opening the dashboard of a cached ZIP is free too.
	await openDashboard(page, LIVE_ZIP);
	expect(rc.count(MARKETS)).toBe(1);
});

test('a 6th ZIP is refused: limit note replaces the form at 5 of 5', async ({ page, net }) => {
	const rc = await liveMarkets(page, net);
	await openMarkets(page);
	const zips = ['79991', '79992', '79993', '79994', '79995'];
	for (const zip of zips) await watch(page, zip, '(1 call)');
	expect(rc.count(MARKETS)).toBe(5);

	await expect(page.getByText('5 of 5 ZIP codes watched')).toBeVisible();
	await expect(
		page.getByText(
			"You're watching 5 ZIP codes, the most Tran tracks. Stop watching one to add another."
		)
	).toBeVisible();
	await expect(zipInput(page)).toHaveCount(0);
	await expect(watchButton(page)).toHaveCount(0);
	await expectNoAxeViolations(page, 'markets at 5 ZIPs');

	// Stop watching the first card: focus moves to the next card's heading, the form returns.
	await page
		.locator('article', { has: cardHeading(page, zips[0]) })
		.getByRole('button', { name: 'Stop watching' })
		.click();
	await expect(cardHeading(page, zips[1])).toBeFocused();
	await expect(page.getByText('4 of 5 ZIP codes watched')).toBeVisible();
	await expect(zipInput(page)).toBeVisible();

	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
});

test('dashboard: named and described SVGs, legend, tables, gaps, 14px ticks, token colors, zero CSP', async ({
	page,
	net
}) => {
	await page.addInitScript(() => {
		const w = window as Window & { __csp?: string[] };
		w.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			w.__csp?.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
	const rc = await liveMarkets(page, net);
	await openMarkets(page);
	await watch(page, LIVE_ZIP, '(1 call)');
	await openDashboard(page, LIVE_ZIP);
	expect(rc.count(MARKETS)).toBe(1);

	// Stat summary under the h1.
	const stats = page.locator('main dl').first();
	await expect(stats.locator('dt')).toHaveText([
		'Median rent',
		'Median sale price',
		'Price-to-rent ratio',
		'Listings counted'
	]);

	const figures = page.locator('figure');
	await expect(figures).toHaveCount(2);
	for (let i = 0; i < 2; i++) {
		const figure = figures.nth(i);
		const titleId = await figure.locator('h2').getAttribute('id');
		const summaryId = `${titleId?.replace(/-title$/, '')}-summary`;
		const labelledBy = (await figure.locator('svg[role="img"]').getAttribute('aria-labelledby'))
			?.split(/\s+/)
			.filter(Boolean);
		expect(labelledBy).toContain(titleId);
		expect(labelledBy).toContain(summaryId);
		await expect(figure.locator(`[id="${summaryId}"]`)).toBeVisible();
	}

	const trend = figures.nth(0);
	await expect(trend.locator('h2')).toHaveText('Rent trend by bedroom count');
	await expect(trend.locator('[id$="-summary"]')).toHaveText(
		new RegExp(`^Median rent in ZIP ${LIVE_ZIP}\\.`)
	);
	await expect(figures.nth(1).locator('[id$="-summary"]')).toHaveText(
		new RegExp(`^Price-to-rent ratio in ZIP ${LIVE_ZIP}:`)
	);

	// Legend items equal the drawn series lines.
	const legendItems = await trend.locator('ul[aria-label="Legend"] > li').count();
	expect(legendItems).toBe(5);
	await expect(trend.locator('svg[role="img"] path.stroke-2')).toHaveCount(legendItems);

	// Data tables: caption, 24 months, a thin month and a gap month.
	for (let i = 0; i < 2; i++) {
		await figures.nth(i).getByText('Show data table').click();
	}
	const table = trend.locator('table');
	await expect(table.locator('caption')).toContainText('Rent trend by bedroom count');
	const rows = table.locator('tbody tr');
	expect(await rows.count()).toBeGreaterThanOrEqual(24);
	await expect(table.getByText('(few listings:', { exact: false }).first()).toBeVisible();
	const headers = await table.locator('thead th').allTextContents();
	const threeBed = headers.findIndex((h) => /^\s*3/.test(h));
	expect(threeBed).toBeGreaterThan(0);
	const count = await rows.count();
	const gapRow = rows.nth(count - 1 - GAP_MONTH_OFFSET);
	await expect(gapRow.locator('th, td').nth(threeBed)).toHaveText('No data');
	expect(THIN_MONTH_OFFSET).not.toBe(GAP_MONTH_OFFSET);
	await expect(figures.nth(1).locator('table caption')).toBeVisible();
	await expect(page.getByText('$0', { exact: true })).toHaveCount(0);
	await expectNoAxeViolations(page, 'dashboard with both tables open');

	// Tick labels are 14px.
	const tickSizes = await page
		.locator('figure svg .lc-axis-tick-label')
		.evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize));
	expect(tickSizes.length).toBeGreaterThan(0);
	expect(new Set(tickSizes)).toEqual(new Set(['14px']));

	// Every painted stroke/fill inside the charts is a Phase 2 token color.
	const offenders = await page.evaluate(() => {
		// Each token resolved two ways: its text-* utility (when the build ships it) and the
		// --color-* variable itself (Tailwind only emits utilities the sources use).
		const tokens = [
			'primary',
			'secondary',
			'foreground',
			'muted-foreground',
			'border-strong',
			'border',
			'card'
		];
		const allowed = new Set<string>();
		for (const t of tokens) {
			for (const how of ['class', 'var'] as const) {
				const el = document.createElement('span');
				if (how === 'class') el.className = `text-${t}`;
				else el.style.color = `var(--color-${t})`;
				document.body.append(el);
				const c = getComputedStyle(el).color;
				if (how === 'var' || c !== getComputedStyle(document.body).color) allowed.add(c);
				el.remove();
			}
		}
		const ok = (v: string) =>
			v === 'none' || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || allowed.has(v);
		const bad: string[] = [];
		for (const svg of document.querySelectorAll('figure svg[role="img"]')) {
			for (const el of svg.querySelectorAll('path, line, circle, rect, polygon, text')) {
				const s = getComputedStyle(el);
				if (!ok(s.stroke)) bad.push(`${el.tagName} stroke ${s.stroke}`);
				// A <line> has no interior, so its fill never paints.
				if (el.tagName !== 'line' && !ok(s.fill)) bad.push(`${el.tagName} fill ${s.fill}`);
			}
		}
		return { bad, allowed: allowed.size };
	});
	expect(offenders.allowed).toBeGreaterThanOrEqual(5);
	expect(offenders.bad).toEqual([]);

	const csp = await page.evaluate(() => (window as Window & { __csp?: string[] }).__csp ?? []);
	expect(csp, 'securitypolicyviolation events with the charts mounted').toEqual([]);

	await page.getByText('Show data table').first().click(); // close one again
	await expectNoAxeViolations(page, 'dashboard loaded');
	await page.setViewportSize({ width: 375, height: 812 });
	await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
	await expectNoHorizontalScroll(page);
});

test('dashboard: invalid ?zip shows the neutral panel', async ({ page }) => {
	await blockRentCast(page);
	await page.goto('investor/market/?zip=12');
	await expect(page.getByText('Pick a ZIP code to see its dashboard')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Go to markets' })).toBeVisible();
	await expect(page.locator('figure')).toHaveCount(0);
});

test('dashboard: unwatched, uncached ZIP never spends and offers Watch ZIP (1 call)', async ({
	page,
	net
}) => {
	const rc = await liveMarkets(page, net);
	await page.goto(`investor/market/?zip=${LIVE_ZIP}`);
	await expect(page.getByText("You're not watching this ZIP.")).toBeVisible();
	await expect(page.getByRole('button', { name: 'Watch ZIP (1 call)' })).toBeVisible();
	await expect(page.getByText('Not enough monthly data for this ZIP yet.').first()).toBeVisible();
	expect(rc.count(MARKETS)).toBe(0);
	await expectNoAxeViolations(page, 'dashboard empty (nothing saved)');

	await page.getByRole('button', { name: 'Watch ZIP (1 call)' }).click();
	await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
	await expect(page.getByText("You're not watching this ZIP.")).toHaveCount(0);
	expect(rc.count(MARKETS)).toBe(1);
});

test('dashboard: a single month of data shows the not-enough-data state', async ({ page, net }) => {
	await liveMarkets(page, net, { singleMonth: true });
	await openMarkets(page);
	await watch(page, '79998', '(1 call)');
	await page.goto('investor/market/?zip=79998');
	await expect(page.locator('h1')).toHaveText('ZIP 79998 market');
	await expect(page.getByText('Not enough monthly data for this ZIP yet.')).toHaveCount(2);
	await expect(page.locator('figure svg[role="img"]')).toHaveCount(0);
	await expectNoAxeViolations(page, 'dashboard empty data');
});

test('a 500 on Watch ZIP shows the gateway error, focused, and watches nothing', async ({
	page,
	net
}) => {
	await mockRentCast(page, net, {
		respond: { markets: { status: 500, body: { error: 'server' } } }
	});
	await useMockedRentCastKey(page);
	await openMarkets(page);
	await zipInput(page).fill(LIVE_ZIP);
	await expect(watchButton(page)).toHaveAccessibleName('Watch ZIP (1 call)');
	await watchButton(page).click();
	await expect(page.getByText('RentCast had a problem answering', { exact: true })).toBeFocused();
	await expect(cardHeading(page, LIVE_ZIP)).toHaveCount(0);
	await expect(page.getByText('0 of 5 ZIP codes watched')).toBeVisible();
	await expectNoAxeViolations(page, 'markets watch error');
	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);
});
