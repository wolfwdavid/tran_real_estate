import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls } from './support/network';
import { expectSampleMode } from './support/seed';

// RENT-02 split view end to end on both bases (06-21): from 1024px the Map tab is a 400px list of
// the rentals inside the current map view beside a sticky map. Hover/focus link cards and pins
// both ways, a pin activation scrolls to and focuses its card, the wheel zooms only once the map
// is engaged, reduced motion still selects, and axe is clean with a pin selected. Sample mode
// throughout: zero RentCast calls and zero tile requests.

test.use({ ...RENTER_TEST_OPTIONS, viewport: { width: 1280, height: 900 } });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const heading = (page: Page) => page.locator('#results-heading');
const mapTab = (page: Page) => page.getByRole('tab', { name: 'Map' });
const container = (page: Page) => page.locator('.leaflet-container');
const pins = (page: Page) => page.locator('.leaflet-marker-icon.tran-pin-icon');
const clusters = (page: Page) => page.locator('.leaflet-marker-icon.tran-cluster');
const markers = (page: Page) => page.locator('.leaflet-marker-icon[role="button"]');
const split = (page: Page) => page.getByRole('region', { name: 'Rentals in this view' });
const splitHeader = (page: Page) => split(page).locator('[data-split-count]');
const splitCards = (page: Page) => split(page).locator('article[data-listing-card]');
const zoom = (page: Page) => container(page).evaluate((el) => Number(el.getAttribute('data-zoom')));

async function sampleSearch(page: Page): Promise<number> {
	await page.goto('renter/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Find a rental' })).toBeVisible();
	await expectSampleMode(page);
	await page.getByRole('button', { name: 'Try a sample search' }).click();
	await expect(heading(page)).toHaveText(/^\d+ rentals? in /);
	return Number(/^(\d+)/.exec((await heading(page).textContent()) ?? '')![1]);
}

async function openMap(page: Page) {
	await mapTab(page).click();
	await expect(container(page)).toBeVisible();
	await expect(markers(page).first()).toBeVisible();
	await expect(container(page)).toHaveAttribute('data-zoom', /^\d+$/);
}

async function splitCount(page: Page): Promise<number> {
	const text = (await splitHeader(page).textContent())?.trim() ?? '';
	expect(text).toMatch(/^\d+ rentals? in this map view$/);
	return Number(/^(\d+)/.exec(text)![1]);
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

/** Enter on a pin: its split-list card is selected, in view, and its address link has focus. */
async function selectPin(page: Page) {
	const pin = await firstPin(page);
	const id = (await pin.getAttribute('data-listing-pin'))!;
	expect(id).toBeTruthy();
	await pin.focus();
	await page.keyboard.press('Enter');
	const card = split(page).locator(`article[data-listing-card="${id}"]`);
	await expect(card).toHaveAttribute('aria-current', 'true');
	await expect(card).toBeInViewport();
	await expect(page.locator(':focus')).toHaveAttribute('id', `card-${id}-addr`);
	await expect(split(page).locator('article[aria-current="true"]')).toHaveCount(1);
	await expect(page.locator('.tran-pin-selected')).toHaveCount(1);
	return id;
}

test('split view: a list of the rentals in this map view beside a sticky map', async ({
	page,
	net
}) => {
	const total = await sampleSearch(page);
	await openMap(page);
	await expect(split(page)).toBeVisible();
	await expect(split(page)).toHaveAttribute('tabindex', '0');
	const count = await splitCount(page);
	expect(count).toBeGreaterThan(0);
	expect(count).toBeLessThanOrEqual(total);
	await expect(splitCards(page)).toHaveCount(count);

	// Side by side: a 400px list column, then the map filling the rest.
	const list = (await split(page).boundingBox())!;
	const map = (await container(page).boundingBox())!;
	expect(Math.round(list.width)).toBe(400);
	expect(map.x).toBeGreaterThanOrEqual(list.x + list.width + 32 - 1);
	expect(map.height).toBeGreaterThanOrEqual(480);
	expect(Math.abs(map.height - (900 - 128))).toBeLessThanOrEqual(1);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);

	// Below 1024px the 06-19 stacked layout is unchanged: no split list.
	await page.setViewportSize({ width: 1023, height: 900 });
	await expect(split(page)).toBeHidden();
	await expect(page.locator('[data-selected-preview]')).toBeVisible();
	expect(rentcastCalls(net)).toBe(0);
	expect(net.counts.tiles).toBeUndefined();
});

test('zooming in narrows the list to the pins inside the view', async ({ page, net }) => {
	await sampleSearch(page);
	await openMap(page);
	const startCount = await splitCount(page);
	const startZoom = await zoom(page);

	await container(page).focus();
	await page.keyboard.press('+');
	await expect.poll(() => zoom(page)).toBe(startZoom + 1);
	await page.keyboard.press('+');
	await expect.poll(() => zoom(page)).toBe(startZoom + 2);
	await expect.poll(() => splitCount(page)).toBeLessThanOrEqual(startCount);
	const count = await splitCount(page);
	expect(count).toBeLessThan(startCount);
	await expect(splitCards(page)).toHaveCount(count);

	// Every listed card whose pin is drawn has that pin inside the map's box.
	const box = (await container(page).boundingBox())!;
	let checked = 0;
	for (const id of await splitCards(page).evaluateAll((els) =>
		els.map((e) => e.getAttribute('data-listing-card')!)
	)) {
		const pin = page.locator(`[data-listing-pin="${id}"]`);
		if ((await pin.count()) === 0) continue; // inside a cluster
		const p = (await pin.boundingBox())!;
		const cx = p.x + p.width / 2;
		const cy = p.y + p.height / 2;
		expect(cx).toBeGreaterThanOrEqual(box.x - 1);
		expect(cx).toBeLessThanOrEqual(box.x + box.width + 1);
		expect(cy).toBeGreaterThanOrEqual(box.y - 1);
		expect(cy).toBeLessThanOrEqual(box.y + box.height + 1);
		checked++;
	}
	expect(checked).toBeGreaterThan(0);
	// And no drawn pin is missing from the list.
	const listed = new Set(
		await splitCards(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-listing-card')))
	);
	for (const id of await pins(page).evaluateAll((els) =>
		els
			.filter((e) => {
				const r = e.getBoundingClientRect();
				const m = document.querySelector('.leaflet-container')!.getBoundingClientRect();
				const cx = r.x + r.width / 2;
				const cy = r.y + r.height / 2;
				return cx > m.x && cx < m.right && cy > m.y && cy < m.bottom;
			})
			.map((e) => e.getAttribute('data-listing-pin'))
	)) {
		expect(listed.has(id)).toBe(true);
	}
	expect(rentcastCalls(net)).toBe(0);
});

test('hover links cards and pins both ways', async ({ page, net }) => {
	await sampleSearch(page);
	await openMap(page);
	const pin = await firstPin(page);
	const id = (await pin.getAttribute('data-listing-pin'))!;
	const card = split(page).locator(`article[data-listing-card="${id}"]`);

	await card.hover();
	await expect(pin).toHaveClass(/tran-pin-highlighted/);
	await page.mouse.move(1270, 10);
	await expect(pin).not.toHaveClass(/tran-pin-highlighted/);
	await expect(card).not.toHaveClass(/outline-foreground/);

	await pin.hover();
	await expect(card).toHaveClass(/outline-foreground/);
	await expect(card).not.toHaveAttribute('aria-current');
	await page.mouse.move(1270, 10);
	await expect(card).not.toHaveClass(/outline-foreground/);

	// Keyboard focus links the same way.
	await pin.focus();
	await expect(card).toHaveClass(/outline-foreground/);
	await card.locator(`#card-${id}-addr`).focus();
	await expect(pin).toHaveClass(/tran-pin-highlighted/);
	expect(rentcastCalls(net)).toBe(0);
});

test('Enter on a pin scrolls its card into view and focuses its link', async ({ page, net }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await sampleSearch(page);
	await openMap(page);
	// Scroll the list away from the top first, so "in view" is a real scroll.
	await split(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
	await selectPin(page);
	expect(rentcastCalls(net)).toBe(0);
});

test('the wheel zooms only after the map is clicked; otherwise the page scrolls', async ({
	page,
	net
}) => {
	await sampleSearch(page);
	await openMap(page);
	const box0 = (await container(page).boundingBox())!;
	// Put the map's top 200px below the viewport top so there is page left to scroll.
	await page.evaluate(
		(y) => window.scrollTo(0, Math.max(0, y)),
		box0.y + (await page.evaluate(() => scrollY)) - 200
	);
	await mapTab(page).focus();
	const box = (await container(page).boundingBox())!;
	const startZoom = await zoom(page);
	const startScroll = await page.evaluate(() => scrollY);

	await page.mouse.move(box.x + box.width - 40, box.y + 120);
	await page.mouse.wheel(0, 300);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(startScroll);
	await page.waitForTimeout(300);
	expect(await zoom(page)).toBe(startZoom);

	const box2 = (await container(page).boundingBox())!;
	await page.mouse.click(box2.x + box2.width - 40, box2.y + 120);
	const scrolled = await page.evaluate(() => scrollY);
	await page.mouse.wheel(0, -300);
	await expect.poll(() => zoom(page)).not.toBe(startZoom);
	expect(await page.evaluate(() => scrollY)).toBe(scrolled);

	// Leaving the map (focus moves elsewhere without scrolling the page) turns it off again.
	await page.waitForTimeout(300);
	await mapTab(page).evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
	const box3 = (await container(page).boundingBox())!;
	await page.mouse.move(box3.x + box3.width - 40, box3.y + 120);
	const zoomed = await zoom(page);
	await page.mouse.wheel(0, -300);
	await page.waitForTimeout(300);
	expect(await zoom(page)).toBe(zoomed);
	expect(rentcastCalls(net)).toBe(0);
});

test('reduced motion: selection still scrolls to and focuses the card', async ({ page, net }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await sampleSearch(page);
	await openMap(page);
	await split(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
	await selectPin(page);
	expect(rentcastCalls(net)).toBe(0);
});

test('axe: split view with a selected pin', async ({ page, net }) => {
	await sampleSearch(page);
	await openMap(page);
	await selectPin(page);
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length).toBeGreaterThan(0);
	const ids = results.violations.map(
		(v) => `${v.id} (${v.impact}): ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(results.violations, `axe violations:\n${ids.join('\n')}`).toEqual([]);
	expect(rentcastCalls(net)).toBe(0);
	expect(net.counts.tiles).toBeUndefined();
	expect(net.tileReferers).toEqual([]);
});
