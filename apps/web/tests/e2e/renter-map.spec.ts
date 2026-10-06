import type { Page, Response } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls, type Net } from './support/network';
import { mockRentCast, rentcastFixtures, RENTAL_LISTINGS_PATH } from './support/rentcast-mocks';
import { expectLiveMode, expectSampleMode, withRentCastKey } from './support/seed';

// RENT-02 map end to end on both bases (06-19): Leaflet + supercluster load only when the Map tab
// opens; live mode draws OpenStreetMap tiles (mocked with the synthetic PNG) with the default
// Referer, visible attribution and zero CSP violations; sample mode draws on a plain backdrop with
// zero tile requests; pins and clusters are named keyboard buttons; co-located units list as
// "rentals at this spot"; filters re-render pins without moving the view; axe is clean with a pin
// selected (target-size included). Nothing here spends more than the one search call.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TILE_HOST = 'tile.openstreetmap.org';

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event (csp.spec.ts). */
		__csp: string[];
	}
}

async function installCollector(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
}

const violations = (page: Page) => page.evaluate(() => window.__csp);

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map(
		(v) => `${v.id} (${v.impact}): ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** Every same-origin JS body the page loads, in order (to prove what the map chunk holds). */
function collectScripts(page: Page): { url: string; body: string }[] {
	const scripts: { url: string; body: string }[] = [];
	page.on('response', async (res: Response) => {
		const url = res.url();
		if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(url) || !/\.js(\?|$)/.test(url)) return;
		try {
			scripts.push({ url, body: await res.text() });
		} catch {
			// Navigated away before the body was read: not a map chunk.
		}
	});
	return scripts;
}

const loadedMapChunk = (scripts: { body: string }[]) =>
	scripts.some((s) => s.body.includes(TILE_HOST));

const form = (page: Page) => page.getByRole('search', { name: 'Search rentals' });
const searchButton = (page: Page) => form(page).getByRole('button', { name: /^Search rentals/ });
const locationInput = (page: Page) =>
	page.getByRole('textbox', { name: 'City and state, or ZIP code' });
const minInput = (page: Page) => page.getByRole('textbox', { name: 'Min', exact: true });
const maxInput = (page: Page) => page.getByRole('textbox', { name: 'Max', exact: true });
const heading = (page: Page) => page.locator('#results-heading');
const listTab = (page: Page) => page.getByRole('tab', { name: 'List' });
const mapTab = (page: Page) => page.getByRole('tab', { name: 'Map' });
const mapPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Map' });
const container = (page: Page) => page.locator('.leaflet-container');
const pins = (page: Page) => page.locator('.leaflet-marker-icon.tran-pin-icon');
const clusters = (page: Page) => page.locator('.leaflet-marker-icon.tran-cluster');
const markers = (page: Page) => page.locator('.leaflet-marker-icon[role="button"]');
const preview = (page: Page) => page.locator('[data-selected-preview]');
const announcer = (page: Page) => page.getByTestId('live-announcer');
const listingCalls = (net: Net) => rentcastCalls(net, RENTAL_LISTINGS_PATH);

async function open(page: Page) {
	await page.goto('renter/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Find a rental' })).toBeVisible();
}

async function sampleSearch(page: Page) {
	await open(page);
	await expectSampleMode(page);
	await page.getByRole('button', { name: 'Try a sample search' }).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in /);
}

async function liveSearch(page: Page, net: Net, extraRows?: Record<string, unknown>[]) {
	await mockRentCast(page, net, extraRows ? { extraRows } : {});
	await withRentCastKey(page);
	await open(page);
	await expectLiveMode(page);
	await locationInput(page).fill('74201');
	await searchButton(page).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals in 74201$/);
	expect(listingCalls(net)).toBe(1);
}

async function openMap(page: Page) {
	await mapTab(page).click();
	await expect(container(page)).toBeVisible();
	await expect(markers(page).first()).toBeVisible();
}

/** Expands clusters (Enter) until at least one rent pin shows, then returns it. */
async function firstPin(page: Page) {
	for (let i = 0; i < 6 && (await pins(page).count()) === 0; i++) {
		await clusters(page).first().focus();
		await page.keyboard.press('Enter');
		await page.waitForTimeout(400);
	}
	await expect(pins(page).first()).toBeVisible();
	return pins(page).first();
}

/** Selects a pin with the keyboard and checks the selected card, focus and announcement. */
async function selectPin(page: Page) {
	const pin = await firstPin(page);
	const label = (await pin.getAttribute('aria-label')) ?? '';
	expect(label).toMatch(/a month, /);
	await pin.focus();
	await page.keyboard.press('Enter');
	// Below 1024px the card shows in the preview under the map; from 1024px it is the split
	// list's card (06-21). Either way exactly one visible card is selected and its link has focus.
	const card = page.locator('article[data-listing-card][aria-current="true"]:visible');
	await expect(card).toBeVisible();
	const linkId = await card.getAttribute('aria-labelledby');
	await expect(page.locator(':focus')).toHaveAttribute('id', linkId!);
	await expect(announcer(page)).toContainText('selected.');
	await expect(page.locator('.tran-pin-selected')).toHaveCount(1);
	return label;
}

test('lazy: Leaflet loads only when the Map tab first opens', async ({ page, net }) => {
	const scripts = collectScripts(page);
	await page.goto('');
	await expect(page.locator('h1').first()).toBeVisible();
	expect(loadedMapChunk(scripts), 'marketing home loaded the map chunk').toBe(false);

	await sampleSearch(page);
	await expect(page.locator('article[data-listing-card]').first()).toBeVisible();
	await page.waitForLoadState('networkidle');
	expect(loadedMapChunk(scripts), 'List tab loaded the map chunk').toBe(false);
	await expect(container(page)).toHaveCount(0);

	await openMap(page);
	await expect.poll(() => loadedMapChunk(scripts)).toBe(true);
	expect(net.counts.tiles).toBeUndefined();
});

test('sample mode: plain backdrop, caption, named pins and zero tile requests', async ({
	page,
	net
}) => {
	await sampleSearch(page);
	await openMap(page);
	await expect(announcer(page)).toHaveText('Map ready with sample listings.');
	await expect(
		mapPanel(page).getByText(
			'Sample listings are shown on a plain backdrop because their addresses are made up.',
			{ exact: false }
		)
	).toBeVisible();
	await expect(mapPanel(page).locator('[data-provenance-chip="sample"]').first()).toBeVisible();
	await expect(
		mapPanel(page).getByText('Drag, or use the arrow keys, to move the map.', { exact: false })
	).toBeVisible();
	await expect(page.locator('.tran-map-sample')).toBeVisible();
	await expect(page.locator('.leaflet-tile')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Report a map problem' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: /^Map of \d+ rentals$/ })).toBeAttached();
	for (const label of await markers(page).evaluateAll((els) =>
		els.map((e) => e.getAttribute('aria-label') ?? '')
	)) {
		expect(label.trim().length).toBeGreaterThan(0);
	}
	expect(net.counts.tiles).toBeUndefined();
	expect(net.tileReferers).toEqual([]);
	expect(rentcastCalls(net)).toBe(0);
});

test('live mode: OSM tiles with Referer and attribution, zero CSP violations', async ({
	page,
	net
}) => {
	await installCollector(page);
	await liveSearch(page, net);
	await openMap(page);
	await expect(announcer(page)).toHaveText(/^Map ready\. \d+ rentals shown\.$/);
	await expect.poll(() => net.counts.tiles ?? 0).toBeGreaterThan(0);
	const origin = new URL(page.url()).origin;
	for (const referer of net.tileReferers) {
		expect(referer).not.toBe('');
		expect(referer.startsWith(origin)).toBe(true);
	}
	const attribution = page.getByRole('link', { name: '© OpenStreetMap contributors' });
	await expect(attribution).toBeVisible();
	await expect(attribution).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
	await expect(page.locator('.leaflet-control-attribution')).toContainText('Leaflet');
	await expect(page.getByRole('link', { name: 'Report a map problem' })).toHaveAttribute(
		'href',
		'https://www.openstreetmap.org/fixthemap'
	);
	await expect(page.locator('.tran-map-sample')).toHaveCount(0);

	// Zooming and panning unload tiles: Leaflet 1.9.4's data: GIF cancel would break img-src.
	const before = net.counts.tiles ?? 0;
	await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await container(page).focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
	await expect.poll(() => net.counts.tiles ?? 0).toBeGreaterThan(before);
	await page.waitForTimeout(500);
	expect(await violations(page)).toEqual([]);

	// Non-vacuity: the collector does catch an img-src violation.
	await page.evaluate(() => {
		const img = document.createElement('img');
		img.alt = '';
		img.src = 'data:image/png;base64,iVBORw0KGgo=';
		document.body.append(img);
	});
	await expect
		.poll(async () => (await violations(page)).some((v) => v.startsWith('img-src')))
		.toBe(true);
	expect(rentcastCalls(net)).toBe(1);
});

test('selection at 375px: Enter on a pin shows its card and moves focus to its link', async ({
	page,
	net
}) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await sampleSearch(page);
	await openMap(page);
	await expect(preview(page)).toContainText('Select a price on the map to see that rental here.');
	await selectPin(page);
	const width = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(width).toBeLessThanOrEqual(375);
	expect(rentcastCalls(net)).toBe(0);
});

test('co-located units: one cluster that lists the rentals at this spot', async ({ page, net }) => {
	const base = rentcastFixtures().rentals.find(
		(r) => r.zipCode === '74201' && r.status === 'Active'
	)!;
	// A spot away from every fixture row, with a rent no fixture row has.
	const extraRows = [1, 2, 3, 4, 5].map((n) => ({
		...base,
		id: `${String(base.id)}-unit${n}`,
		addressLine2: `Unit ${n}`,
		latitude: 36.735,
		longitude: -101.985,
		price: 4321
	}));
	await liveSearch(page, net, extraRows);
	await minInput(page).fill('4300');
	await openMap(page);
	const cluster = page.getByRole('button', { name: '5 rentals here. Zoom in to see them.' });
	await expect(cluster).toBeVisible();
	await expect(pins(page)).toHaveCount(0);
	await cluster.focus();
	await page.keyboard.press('Enter');
	await expect(
		preview(page).getByRole('heading', { name: '5 rentals at this spot' })
	).toBeVisible();
	await expect(preview(page).locator('a[data-preview-link]')).toHaveCount(5);
	await expect(page.locator(':focus')).toHaveAttribute('data-preview-link', '');
	await expect(announcer(page)).toHaveText('5 rentals at this spot.');
	// Still one cluster: these units can never split into overlapping pins.
	await expect(cluster).toBeVisible();
	await expectNoViolations(page, 'renter/ map spot list');
	expect(listingCalls(net)).toBe(1);
});

test('a filter change re-renders pins and keeps the view', async ({ page, net }) => {
	await sampleSearch(page);
	await openMap(page);
	const pane = page.locator('.leaflet-map-pane');
	const transform = () => pane.evaluate((el) => (el as HTMLElement).style.transform);
	await container(page).focus();
	const start = await transform();
	await page.keyboard.press('ArrowRight');
	await expect.poll(transform).not.toBe(start);
	await page.waitForTimeout(400);
	const panned = await transform();
	const labels = () =>
		markers(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join('|'));
	const before = await labels();

	await listTab(page).click();
	await maxInput(page).fill('1800');
	await mapTab(page).click();
	await expect.poll(labels).not.toBe(before);
	expect(await transform()).toBe(panned);
	expect(rentcastCalls(net)).toBe(0);
});

for (const mode of ['sample', 'live'] as const) {
	for (const [name, viewport] of [
		['desktop', { width: 1280, height: 900 }],
		['375px', { width: 375, height: 812 }]
	] as const) {
		test(`axe: ${mode} map with a selected pin at ${name}`, async ({ page, net }) => {
			await page.setViewportSize(viewport);
			if (mode === 'sample') await sampleSearch(page);
			else await liveSearch(page, net);
			await openMap(page);
			await selectPin(page);
			await expectNoViolations(page, `renter/ ${mode} map ${name}`);
			expect(rentcastCalls(net)).toBe(mode === 'live' ? 1 : 0);
		});
	}
}

test('tab switching keeps one map and re-sizes it without re-importing', async ({ page, net }) => {
	const scripts = collectScripts(page);
	await sampleSearch(page);
	await openMap(page);
	await expect.poll(() => loadedMapChunk(scripts)).toBe(true);
	const chunkLoads = () => scripts.filter((s) => s.body.includes(TILE_HOST)).length;
	const loads = chunkLoads();

	await listTab(page).click();
	await expect(container(page)).toBeHidden();
	await mapTab(page).click();
	await expect(container(page)).toBeVisible();
	await listTab(page).click();
	await mapTab(page).click();
	await expect(container(page)).toHaveCount(1);
	const box = await container(page).boundingBox();
	expect(box?.width ?? 0).toBeGreaterThan(0);
	expect(box?.height ?? 0).toBeGreaterThanOrEqual(320);
	await expect(markers(page).first()).toBeVisible();
	expect(chunkLoads()).toBe(loads);
	expect(rentcastCalls(net)).toBe(0);
});
