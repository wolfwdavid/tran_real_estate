// The Phase 7 demo-credibility sweep (07-20, ROADMAP SC5; 07-UI-SPEC Accessibility Contract).
// Mirrors 06-22's renter-demo-credible matrix: every investor route plus the memo print route x
// {keyless, mocked key} x {root, sub} base (the two Playwright projects), WITH REAL DATA LOADED.
//
// Each mode seeds once, through the shipped UI, then sweeps all nine URLs in the same page:
//   Try a sample deal -> Save deal -> Save as a new deal (two deals to compare); Draft a memo on
//   the first and wait for the stream to end; watch one ZIP; create and check one buy box.
// Each URL, after its ready marker (h1 visible, "Loading your investor data…" gone, both chart SVGs
// on the market dashboard, [data-ready] on print):
//   - zero `securitypolicyviolation` events (collector installed before the first navigation),
//   - axe WCAG 2.0/2.1/2.2 A+AA clean at 1280px,
//   - every [data-provenance="sample"] block carries a visible Sample data chip,
//   - at 375px with the WCAG 1.4.12 text-spacing overrides: no horizontal scroll, axe clean.
// Keyless spends 0 RentCast calls overall (blockRentCast) and makes no AI request (the harness
// denies every unmocked host). Mocked mode spends only its seeding calls: the sweep itself is 0.
import type { Page } from '@playwright/test';
import {
	INVESTOR_TEST_OPTIONS,
	MOCK_CITY,
	MOCK_ZIP,
	blockRentCast,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	marketStatsBody,
	mockAnthropicText,
	mockRentCast,
	test,
	useMockedAnthropicKey,
	useMockedRentCastKey,
	type MockResult
} from './helpers';
import { expectLiveMode, expectSampleMode } from '../support/seed';

test.use(INVESTOR_TEST_OPTIONS);

/** A clean mocked memo: its only figure comes from the analysis. */
const MOCKED_MEMO = 'Monthly cash flow is $184.';
/** The live-mode ZIP (outside the sample fixtures, answered by the relabelled markets mock). */
const LIVE_ZIP = '79999';
const LOADING = 'Loading your investor data…';
const TEXT_SPACING =
	'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event. */
		__csp: string[];
	}
}

/** Before the first navigation: boot-time violations fire long before test code could listen. */
async function installCollector(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
}

const cspViolations = (page: Page) => page.evaluate(() => window.__csp ?? []);

/**
 * The Phase 4 rule: every RENDERED [data-provenance="sample"] block shows a visible Sample data chip.
 * A layout hidden with display:none at this width (compare's table vs stacked view) is skipped: it
 * is not presented, and its twin in the visible layout is checked instead.
 */
function unbadgedSampleBlocks(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			Array.from(document.querySelectorAll('[data-provenance="sample"]')).filter(
				(block) =>
					block.getClientRects().length > 0 &&
					!Array.from(block.querySelectorAll('[data-provenance-chip="sample"]')).some(
						(chip) => chip.getClientRects().length > 0
					)
			).length
	);
}

/** Rendered sample blocks with a visible chip (proves the rule above is not vacuous). */
function badgedSampleChips(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			Array.from(document.querySelectorAll('[data-provenance-chip="sample"]')).filter(
				(chip) => chip.getClientRects().length > 0
			).length
	);
}

/** WCAG 1.4.12 overrides. An injected <style> is refused by the CSP, so use an adopted sheet. */
async function applyTextSpacing(page: Page): Promise<void> {
	await page.evaluate((css) => {
		const s = new CSSStyleSheet();
		s.replaceSync(css);
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
	}, TEXT_SPACING);
	await expect(page.locator('h1').first()).not.toHaveCSS('word-spacing', '0px');
}

/**
 * The deepest visible elements whose box ends past the viewport's right edge, ignoring content
 * inside a scroll or clip container (a wide data table in an overflow-x-auto region scrolls inside
 * itself; the page does not). Names the cause when the page scrolls sideways.
 */
function overflowCulprits(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const w = window.innerWidth;
		const clipped = (el: Element) => {
			for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
				if (getComputedStyle(p).overflowX !== 'visible') return true;
			}
			return false;
		};
		const wide = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
			(el) =>
				el.getClientRects().length > 0 && el.getBoundingClientRect().right > w + 0.5 && !clipped(el)
		);
		return wide
			.filter((el) => !wide.some((o) => o !== el && el.contains(o)))
			.slice(0, 8)
			.map((el) => {
				const r = el.getBoundingClientRect();
				const text = (el.textContent ?? '').trim().slice(0, 40);
				const control = el.closest('button, a');
				const within = control
					? ` in <${control.tagName.toLowerCase()}> "${(control.textContent ?? '').trim().slice(0, 60)}"`
					: '';
				return `<${el.tagName.toLowerCase()} class="${el.className}"> right=${Math.round(r.right)} "${text}"${within}`;
			});
	});
}

/** The MOCK_ZIP market body relabelled for any ZIP (the 07-13 markets.spec approach). */
async function marketsFor(url: URL): Promise<MockResult> {
	const zip = url.searchParams.get('zipCode') ?? '';
	const body = (await marketStatsBody(MOCK_ZIP)) as Record<string, unknown>;
	return { status: 200, body: { ...body, id: zip, zipCode: zip } };
}

interface Seeded {
	deal: string;
	deal2: string;
	memo: string;
	zip: string;
}

const idFrom = (url: string) => new URL(url).searchParams.get('id') ?? '';

/** Seeds every investor area through the UI. Returns the ids the sweep URLs need. */
async function seed(page: Page, mode: 'keyless' | 'mocked'): Promise<Seeded> {
	// Two saved deals (the second is "Save as a new deal" of the first).
	await page.goto('investor/analyze/');
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	const deal = idFrom(page.url());
	await page.getByRole('button', { name: 'Save as a new deal' }).click();
	await expect.poll(() => idFrom(page.url())).not.toBe(deal);
	const deal2 = idFrom(page.url());
	expect(deal2).not.toBe('');

	// A drafted memo on the first deal, stream finished and every check passed.
	await page.goto(`investor/memo/?id=${encodeURIComponent(deal)}`);
	await expect(page.locator('[data-memo-page]')).toBeVisible();
	const panel = page.getByRole('region', { name: 'Memo draft' });
	await panel.getByRole('button', { name: 'Draft memo', exact: true }).click();
	// The keyless sample memo streams word by word (20-60ms each).
	await expect(panel.getByText('Draft ready.', { exact: true })).toBeVisible({ timeout: 60_000 });
	await expect(panel.getByText('Number check passed')).toBeVisible();
	await expect(page.locator('[data-memo-print-link]')).toHaveAttribute('href', /&memo=/);
	const memo = (await page.locator('[data-memo-print]').getAttribute('data-artifact-id')) ?? '';
	expect(memo).not.toBe('');

	// One watched ZIP.
	const zip = mode === 'keyless' ? MOCK_ZIP : LIVE_ZIP;
	await page.goto('investor/markets/');
	await expect(page.getByText('0 of 5 ZIP codes watched')).toBeVisible();
	await page.getByLabel('ZIP code').fill(zip);
	const watch = page.getByRole('button', { name: /^Watch ZIP/ });
	await expect(watch).toHaveAccessibleName(
		mode === 'keyless' ? 'Watch ZIP (0 calls · sample data)' : 'Watch ZIP (1 call)'
	);
	await watch.click();
	await expect(
		page.getByRole('heading', { level: 2, name: `ZIP ${zip}`, exact: true })
	).toBeFocused();

	// One buy box, checked.
	await page.goto('investor/buy-boxes/');
	await expect(page.getByText(LOADING)).toHaveCount(0);
	await page.getByRole('button', { name: 'New buy box' }).click();
	const form = page.locator('[data-buy-box-form]');
	await expect(form.getByLabel('Name', { exact: true })).toBeFocused();
	await form.getByLabel('Name', { exact: true }).fill('Sweep box');
	const location = form.getByLabel('Location', { exact: true });
	await location.fill(mode === 'keyless' ? MOCK_CITY : MOCK_ZIP);
	await location.press('Tab');
	const save = form.getByRole('button', { name: /^Save and check now/ });
	await expect(save).toHaveAccessibleName(
		mode === 'keyless'
			? 'Save and check now (0 calls · sample data)'
			: 'Save and check now (1 call)'
	);
	// The open form, cost label included, fits 375px with the text-spacing overrides.
	await page.setViewportSize({ width: 375, height: 812 });
	await applyTextSpacing(page);
	expect(await overflowCulprits(page), `elements past 375px on the buy-box form (${mode})`).toEqual(
		[]
	);
	await expectNoHorizontalScroll(page);
	await page.setViewportSize({ width: 1280, height: 900 });
	await save.click();
	const boxHeading = page.getByRole('heading', { level: 2, name: 'Sweep box', exact: true });
	await expect(boxHeading).toBeFocused();
	await expect(
		page.locator('article[data-buy-box]', { has: boxHeading }).locator('[data-match-row]').first()
	).toBeAttached();

	return { deal, deal2, memo, zip };
}

interface SweepTarget {
	url: string;
	label: string;
	/** Waits for the route's data to be on screen. */
	ready(page: Page): Promise<void>;
}

const noLoading = async (page: Page) => {
	await expect(page.getByText(LOADING)).toHaveCount(0);
};

function targets(s: Seeded): SweepTarget[] {
	const id = encodeURIComponent(s.deal);
	const id2 = encodeURIComponent(s.deal2);
	return [
		{
			url: 'investor/',
			label: 'overview',
			ready: async (page) => {
				await noLoading(page);
				await expect(page.locator('[data-overview-card="deals"] [data-overview-count]')).toHaveText(
					'2 saved'
				);
				await expect(
					page.locator('[data-overview-card="markets"] [data-overview-count]')
				).toHaveText('1 of 5 ZIP codes watched');
				await expect(
					page.locator('[data-overview-card="buyBoxes"] [data-overview-count]')
				).not.toHaveText('No buy boxes yet');
			}
		},
		{
			url: `investor/analyze/?id=${id}`,
			label: 'analyze',
			ready: async (page) => {
				await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
				await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
			}
		},
		{
			url: 'investor/deals/',
			label: 'deals',
			ready: async (page) => {
				await noLoading(page);
				await expect(page.getByRole('link', { name: /^Open / })).toHaveCount(2);
			}
		},
		{
			url: `investor/compare/?ids=${id},${id2}`,
			label: 'compare',
			ready: async (page) => {
				await noLoading(page);
				await expect(page.locator('table th[scope="row"]').first()).toBeAttached();
			}
		},
		{
			url: `investor/memo/?id=${id}`,
			label: 'memo',
			ready: async (page) => {
				await noLoading(page);
				await expect(page.locator('[data-memo-page]')).toBeVisible();
				await expect(page.locator('[data-memo-metrics] [data-metric="cashFlow"]')).toContainText(
					'$184'
				);
				// The stored memo is listed; opening it puts the checked draft back in the panel.
				await expect(page.getByText('1 saved in this browser')).toBeVisible();
				await page.getByRole('button', { name: 'Open', exact: true }).click();
				await expect(page.locator('[data-memo-print-link]')).toHaveAttribute('href', /&memo=/);
			}
		},
		{
			url: 'investor/buy-boxes/',
			label: 'buy boxes',
			ready: async (page) => {
				await noLoading(page);
				await expect(
					page.getByRole('heading', { level: 2, name: 'Sweep box', exact: true })
				).toBeVisible();
			}
		},
		{
			url: 'investor/markets/',
			label: 'markets',
			ready: async (page) => {
				await noLoading(page);
				await expect(page.getByText('1 of 5 ZIP codes watched')).toBeVisible();
				await expect(
					page.getByRole('heading', { level: 2, name: `ZIP ${s.zip}`, exact: true })
				).toBeVisible();
			}
		},
		{
			url: `investor/market/?zip=${s.zip}`,
			label: 'market dashboard',
			ready: async (page) => {
				await noLoading(page);
				await expect(page.locator('h1')).toHaveText(`ZIP ${s.zip} market`);
				await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
			}
		},
		{
			url: `print/memo/?id=${id}&memo=${encodeURIComponent(s.memo)}`,
			label: 'memo printout',
			ready: async (page) => {
				await expect(page.locator('[data-ready]')).toBeVisible();
			}
		}
	];
}

/** Sweeps the nine URLs; returns how many visible Sample data chips it saw at 1280px. */
async function sweep(page: Page, s: Seeded, mode: 'keyless' | 'mocked'): Promise<number> {
	let chips = 0;
	for (const t of targets(s)) {
		await test.step(`${t.label} (${mode})`, async () => {
			const label = `${t.url} (${mode})`;
			await page.setViewportSize({ width: 1280, height: 900 });
			await page.goto(t.url);
			await expect(page.locator('html')).not.toHaveAttribute('hidden');
			await expect(page.locator('h1').first()).toBeVisible();
			await t.ready(page);

			// The app routes carry the Data source bar; the chrome-free print route does not.
			if (!t.url.startsWith('print/')) {
				if (mode === 'keyless') await expectSampleMode(page);
				else await expectLiveMode(page);
			}
			expect(await unbadgedSampleBlocks(page), `unbadged sample blocks on ${label}`).toBe(0);
			chips += await badgedSampleChips(page);
			await expectNoAxeViolations(page, `${label} at 1280px`);
			expect(await cspViolations(page), `CSP violations on ${label}`).toEqual([]);

			await page.setViewportSize({ width: 375, height: 812 });
			await applyTextSpacing(page);
			expect(await overflowCulprits(page), `elements past 375px on ${label}`).toEqual([]);
			await expectNoHorizontalScroll(page);
			await expectNoAxeViolations(page, `${label} at 375px with text spacing`);
			expect(await unbadgedSampleBlocks(page), `unbadged sample blocks on ${label} at 375`).toBe(0);
			expect(await cspViolations(page), `CSP violations on ${label} at 375px`).toEqual([]);
		});
	}
	return chips;
}

test.describe('keyless', () => {
	test.describe.configure({ mode: 'serial', timeout: 300_000 });

	test('every investor route and the print route: axe, CSP, 375px, sample chips, 0 calls', async ({
		page
	}) => {
		await installCollector(page);
		const blocked = await blockRentCast(page);
		await page.goto('investor/');
		await expectSampleMode(page);

		const s = await seed(page, 'keyless');
		// The sample chips are really there on the data routes.
		await page.goto(`investor/market/?zip=${s.zip}`);
		await expect(page.locator('figure svg[role="img"]')).toHaveCount(2);
		await expect(page.locator('figure').first()).toContainText('(sample data)');

		const chips = await sweep(page, s, 'keyless');
		expect(chips, 'visible Sample data chips across the keyless sweep').toBeGreaterThan(0);
		expect(blocked.urls).toEqual([]);
	});
});

test.describe('mocked', () => {
	test.describe.configure({ mode: 'serial', timeout: 300_000 });

	test('every investor route and the print route: axe, CSP, 375px, the sweep spends 0 calls', async ({
		page,
		net
	}) => {
		await installCollector(page);
		const rc = await mockRentCast(page, net, { respond: { markets: marketsFor } });
		const aiCalls = await mockAnthropicText(page, MOCKED_MEMO);
		await useMockedRentCastKey(page);
		await useMockedAnthropicKey(page);
		await page.goto('investor/');
		await expectLiveMode(page);

		const s = await seed(page, 'mocked');
		expect(
			aiCalls.filter((c) => c.kind === 'generate'),
			'memo drafted through the mocked provider'
		).toHaveLength(1);
		const seeded = rc.count();
		expect(seeded, 'seeding spends the watch and the check').toBeGreaterThan(0);

		await sweep(page, s, 'mocked');
		expect(rc.count(), 'RentCast calls during the sweep').toBe(seeded);
	});
});
