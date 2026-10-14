import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { blockRentCast } from './helpers/data';

// GTM-01 end to end (10-20): the landing's inline Get started guide (10-15) on the real built site,
// both bases. Every test gets a fresh browser context, so localStorage starts empty. Proves the
// prerendered first-visit state, focus on every step heading (never on load), all three portal
// tours, both exits (sample mode and the RentCast key setup), Hide / compact row / Show me around,
// reload persistence, that the guide is never modal, a corrupt stored value, and axe in every
// guide state at 375 and 1280 px. RentCast is never reached (blockRentCast).
//
// The page is only driven after the guide's onMount ran (`data-ready`): the prerendered tiles are
// real buttons, so a click that lands before hydration does nothing.

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const KEY = 'tran.onboarding.v1';
const PORTALS = ['renter', 'investor', 'agent'] as const;
type Portal = (typeof PORTALS)[number];
const TITLE: Record<Portal, string> = { renter: 'Renter', investor: 'Investor', agent: 'Agent' };
const TOUR_H3: Record<Portal, [string, string, string]> = {
	renter: ['What the renter portal does', 'Where your keys go', 'Sample data or live data'],
	investor: ['What the investor portal does', 'Where your keys go', 'Sample data or live data'],
	agent: ['What the agent portal does', 'Where your keys go', 'Sample contacts or your own']
};
const VIEWPORTS = [
	{ width: 375, height: 812 },
	{ width: 1280, height: 800 }
];

const guide = (page: Page) => page.locator('#get-started');
const h2 = (page: Page) => guide(page).getByRole('heading', { level: 2, name: 'Get started' });
const h3 = (page: Page, name: string) => guide(page).getByRole('heading', { level: 3, name });
const tile = (page: Page, p: Portal) =>
	guide(page).getByRole('button', { name: `${TITLE[p]} Start the tour` });
const button = (page: Page, name: string) => guide(page).getByRole('button', { name, exact: true });
const announcer = (page: Page) => page.getByTestId('live-announcer');
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const storedState = async (page: Page) => JSON.parse((await stored(page)) ?? 'null');

/** The base URL of the current project ('http://host/' or 'http://host/tran_real_estate/'). */
const base = () => String(test.info().project.use.baseURL);

async function openLanding(page: Page): Promise<void> {
	await page.goto('');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(guide(page)).toHaveAttribute('data-ready', '');
}

async function expectNeverModal(page: Page, label: string): Promise<void> {
	expect(await page.locator('[role="dialog"]').count(), `dialog on ${label}`).toBe(0);
	expect(await page.locator('[inert]').count(), `inert on ${label}`).toBe(0);
	expect(await page.locator('[aria-modal="true"]').count(), `aria-modal on ${label}`).toBe(0);
}

async function axeGuide(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page })
		.include('#get-started')
		.withTags(WCAG_TAGS)
		.analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** Starts the tour for `p` and waits for focus on the step 1 heading. */
async function startTour(page: Page, p: Portal): Promise<void> {
	await tile(page, p).click();
	await expect(h3(page, TOUR_H3[p][0])).toBeFocused();
}

test.beforeEach(async ({ page }) => {
	await blockRentCast(page);
});

test('prerendered first-visit state: the raw HTML is step 0 and has no dialog', async ({
	page
}) => {
	const response = await page.request.get('');
	expect(response.ok()).toBe(true);
	const html = await response.text();
	expect(html).toContain('id="get-started"');
	expect(html).toContain('Where do you want to start?');
	expect(html).toContain('Start the tour');
	expect(html).not.toContain('role="dialog"');
	expect(html).not.toContain('aria-modal');
	// The tour itself is not in the first paint (it loads on demand).
	expect(html).not.toContain('Where your keys go');
});

test('no auto focus on load', async ({ page }) => {
	await openLanding(page);
	expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
	await expectNeverModal(page, 'step 0');
	expect(await stored(page)).toBeNull();
});

for (const p of PORTALS) {
	test(`${p} tour: focus lands on every step heading, Back / Change portal / Skip, and the exits`, async ({
		page
	}) => {
		await openLanding(page);
		const [s1, s2, s3] = TOUR_H3[p];

		await startTour(page, p);
		await expect(guide(page)).toContainText('Step 1 of 3');
		await expectNeverModal(page, `${p} step 1`);
		expect(await storedState(page)).toMatchObject({ status: 'touring', portal: p, step: 1 });

		await button(page, 'Next').click();
		await expect(h3(page, s2)).toBeFocused();
		await expect(h3(page, 'Where your keys go')).toBeFocused();
		await expect(guide(page)).toContainText('Step 2 of 3');

		await button(page, 'Back').click();
		await expect(h3(page, s1)).toBeFocused();
		await expect(guide(page)).toContainText('Step 1 of 3');

		// "Change portal" on step 1 returns to the portal choice and focuses the h2.
		await button(page, 'Change portal').click();
		await expect(h2(page)).toBeFocused();
		await expect(guide(page)).toContainText('Where do you want to start?');

		await startTour(page, p);
		await button(page, 'Skip tour').click();
		await expect(h3(page, s3)).toBeFocused();
		await expect(guide(page)).toContainText('Step 3 of 3');
		await expectNeverModal(page, `${p} step 3`);

		// Step 3 actions in DOM order: Back first, then the two exits.
		const actions = guide(page).locator('h3 ~ div').last().locator('a, button');
		const names = await actions.evaluateAll((els) =>
			els.map((el) => (el.textContent ?? '').trim())
		);
		expect(names[0]).toBe('Back');
		const sample = guide(page).getByRole('link', { name: 'Try sample data', exact: true });
		await expect(sample).toHaveAttribute('href', /\?source=sample$/);
		expect(await sample.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
			`${base()}${p}/?source=sample`
		);
		if (p === 'agent') {
			const empty = guide(page).getByRole('link', {
				name: 'Start with an empty pipeline',
				exact: true
			});
			expect(await empty.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(`${base()}agent/`);
			expect(names).toEqual(['Back', 'Try sample data', 'Start with an empty pipeline']);
			await expect(guide(page).getByRole('link', { name: /RentCast key/ })).toHaveCount(0);
		} else {
			const key = guide(page).getByRole('link', {
				name: 'Connect a free RentCast key',
				exact: true
			});
			await expect(key).toHaveAttribute('href', new RegExp(`setup/rentcast/\\?portal=${p}$`));
			expect(await key.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(
				`${base()}setup/rentcast/?portal=${p}`
			);
			expect(names).toEqual(['Back', 'Try sample data', 'Connect a free RentCast key']);
		}

		// Reload keeps the tour step.
		await page.reload();
		await expect(guide(page)).toHaveAttribute('data-ready', '');
		await expect(guide(page).getByRole('heading', { level: 3, name: s3 })).toBeVisible();
		expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
	});
}

test('try sample data exit: renter opens in sample mode, cleans the URL and announces', async ({
	page
}) => {
	await openLanding(page);
	await startTour(page, 'renter');
	await button(page, 'Skip tour').click();
	await guide(page).getByRole('link', { name: 'Try sample data', exact: true }).click();

	await expect(page).toHaveURL(/\/renter\/$/);
	expect(new URL(page.url()).searchParams.has('source')).toBe(false);
	await expect(announcer(page)).toContainText('Showing sample data.');
	await expect(page.getByRole('region', { name: 'Data source' })).toContainText('Sample data');
	expect(await storedState(page)).toEqual({ status: 'done', lastPortal: 'renter' });

	await openLanding(page);
	await expect(guide(page)).toContainText('New here, or want a refresher?');
	const open = guide(page).getByRole('link', { name: 'Open renter portal', exact: true });
	expect(await open.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(`${base()}renter/`);
	await expectNeverModal(page, 'compact row');
});

test('connect a free RentCast key exit: investor lands on the setup page for that portal', async ({
	page
}) => {
	await openLanding(page);
	await startTour(page, 'investor');
	await button(page, 'Skip tour').click();
	await guide(page).getByRole('link', { name: 'Connect a free RentCast key', exact: true }).click();

	await expect(page).toHaveURL(/\/setup\/rentcast\/\?portal=investor$/);
	await expect(page.locator('[data-setup-page][data-hydrated="true"]')).toBeAttached();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect a free RentCast key');
	await expect(page.getByRole('link', { name: 'Open investor portal', exact: true })).toBeVisible();
	expect(await storedState(page)).toEqual({ status: 'done', lastPortal: 'investor' });
});

test('hide and show: compact row, focus, announcement, reload persistence, Show me around', async ({
	page
}) => {
	await openLanding(page);
	await button(page, 'Hide this guide').click();
	const show = button(page, 'Show me around');
	await expect(show).toBeFocused();
	await expect(guide(page)).toContainText('New here, or want a refresher?');
	await expect(announcer(page)).toContainText(
		'Guide hidden. You can show it again from Settings or here.'
	);
	expect(await storedState(page)).toEqual({ status: 'hidden' });
	// No last portal yet, so no "Open … portal" link.
	await expect(guide(page).getByRole('link', { name: /^Open .* portal$/ })).toHaveCount(0);
	await expectNeverModal(page, 'compact row');

	await page.reload();
	await expect(guide(page)).toHaveAttribute('data-ready', '');
	await expect(guide(page)).toContainText('New here, or want a refresher?');
	await expect(guide(page)).not.toContainText('Where do you want to start?');

	await button(page, 'Show me around').click();
	await expect(h2(page)).toBeFocused();
	await expect(guide(page)).toContainText('Where do you want to start?');
	expect(await storedState(page)).toEqual({ status: 'new', step: 0 });
});

test('hero Show me around: hash #get-started, h2 focused, guide reset from a tour', async ({
	page
}) => {
	await openLanding(page);
	await startTour(page, 'agent');
	const hero = page.getByRole('link', { name: 'Show me around', exact: true });
	await hero.click();
	await expect(page).toHaveURL(/#get-started$/);
	await expect(h2(page)).toBeFocused();
	await expect(guide(page)).toContainText('Where do you want to start?');

	// Again while already at #get-started (no hashchange): still resets and focuses.
	await startTour(page, 'agent');
	await hero.click();
	await expect(h2(page)).toBeFocused();
	await expect(guide(page)).toContainText('Where do you want to start?');
	expect(await storedState(page)).toEqual({ status: 'new', step: 0 });

	// Arriving at /#get-started from elsewhere focuses the h2 too.
	await page.goto('#get-started');
	await page.reload();
	await expect(guide(page)).toHaveAttribute('data-ready', '');
	await expect(h2(page)).toBeFocused();
});

// Regression for the guide.spec.ts "hero Show me around" flake (10-13/10-14/10-16): the first tour
// click awaits the lazily loaded tour panel, and the stale step-1 write used to land after a later
// "Show me around" or "Hide this guide", so the guide jumped back into the tour. The tour chunk is
// held back here to make that ordering certain.
for (const later of ['hero Show me around', 'Hide this guide'] as const) {
	test(`a slow tour load never overrides a later ${later}`, async ({ page }) => {
		await openLanding(page);
		const held: string[] = [];
		await page.route(/\.js(\?.*)?$/, async (route) => {
			held.push(route.request().url());
			await new Promise((r) => setTimeout(r, 1_500));
			await route.continue().catch(() => {});
		});

		await tile(page, 'agent').click();
		if (later === 'hero Show me around') {
			await page.getByRole('link', { name: 'Show me around', exact: true }).click();
			await expect(h2(page)).toBeFocused();
		} else {
			await button(page, 'Hide this guide').click();
			await expect(button(page, 'Show me around')).toBeFocused();
		}
		// The later action ran while the tour chunk was still held back.
		await expect
			.poll(() => held.length, { message: 'the tour chunk was not requested' })
			.toBeGreaterThan(0);
		// Wait until every held chunk has actually arrived (resource timing entry), then let the
		// import continuation and a render run before reading the final state.
		await expect
			.poll(() =>
				page.evaluate((urls) => urls.every((u) => performance.getEntriesByName(u).length > 0), held)
			)
			.toBe(true);
		await page.evaluate(
			() =>
				new Promise((r) =>
					setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 50)
				)
		);

		if (later === 'hero Show me around') {
			// Instant reads, not retrying assertions: the stale write must never have happened.
			expect(await storedState(page)).toEqual({ status: 'new', step: 0 });
			expect(await guide(page).getByRole('heading', { level: 3 }).count()).toBe(0);
			expect(await tile(page, 'agent').isVisible()).toBe(true);
			await expect(h2(page)).toBeFocused();
		} else {
			expect(await storedState(page)).toEqual({ status: 'hidden' });
			expect(await guide(page).getByRole('heading', { level: 3 }).count()).toBe(0);
			expect(await guide(page).innerText()).toContain('New here, or want a refresher?');
			await expect(button(page, 'Show me around')).toBeFocused();
		}
	});
}

test('never modal: no dialog or inert in any state, and Tab leaves the guide', async ({ page }) => {
	await openLanding(page);
	await expectNeverModal(page, 'step 0');
	await startTour(page, 'renter');
	for (const name of TOUR_H3.renter) {
		await expect(h3(page, name)).toBeFocused();
		await expectNeverModal(page, name);
		// Tabbing forward from the step heading reaches the page after the guide: no focus trap.
		let left = false;
		for (let i = 0; i < 12 && !left; i++) {
			await page.keyboard.press('Tab');
			left = await page.evaluate(
				() => !document.getElementById('get-started')?.contains(document.activeElement)
			);
		}
		expect(left, `Tab never left the guide from "${name}"`).toBe(true);
		const after = await page.evaluate(
			() =>
				!!(
					document.getElementById('get-started')!.compareDocumentPosition(document.activeElement!) &
					Node.DOCUMENT_POSITION_FOLLOWING
				)
		);
		expect(after, `focus after the guide from "${name}"`).toBe(true);
		if (name !== TOUR_H3.renter[2]) {
			await h3(page, name).focus();
			await button(page, 'Next').click();
		}
	}
	await button(page, 'Hide this guide').click();
	await expectNeverModal(page, 'compact row');
});

test('a corrupt stored value renders the first-visit step', async ({ page }) => {
	await page.addInitScript((k) => localStorage.setItem(k, '{oops'), KEY);
	await openLanding(page);
	await expect(guide(page)).toContainText('Where do you want to start?');
	await expect(tile(page, 'renter')).toBeVisible();
	await expect(guide(page)).not.toContainText('New here, or want a refresher?');
});

for (const vp of VIEWPORTS) {
	const at = `${vp.width}px`;

	test(`axe guide at ${at}: step 0 and the compact row`, async ({ page }) => {
		await page.setViewportSize(vp);
		await openLanding(page);
		await axeGuide(page, `guide step 0 at ${at}`);
		await button(page, 'Hide this guide').click();
		await expect(guide(page)).toContainText('New here, or want a refresher?');
		await axeGuide(page, `guide compact row at ${at}`);
	});

	for (const p of PORTALS) {
		test(`axe tour at ${at}: ${p} steps 1-3`, async ({ page }) => {
			await page.setViewportSize(vp);
			await openLanding(page);
			await startTour(page, p);
			for (const [i, name] of TOUR_H3[p].entries()) {
				await expect(h3(page, name)).toBeFocused();
				await axeGuide(page, `${p} tour step ${i + 1} at ${at}`);
				if (i < 2) await button(page, 'Next').click();
			}
		});
	}
}
