import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls, type Net } from './support/network';
import { mockRentCast } from './support/rentcast-mocks';
import { expectLiveMode, expectSampleMode, withRentCastKey } from './support/seed';
import { RENTER_ROUTES } from './routes';

// The Phase 6 demo-credibility matrix (06-22, ROADMAP criterion 5): every renter route x
// {sample, live (mocked key)} x {root, sub} base (the two Playwright projects). Each cell:
//   - zero CSP violations (securitypolicyviolation collector installed before navigation),
//   - zero WCAG 2.2 AA axe violations at 1280px AND at 375px,
//   - no horizontal scroll at 375px (scrollWidth <= 375),
//   - in sample mode, every [data-provenance="sample"] block carries a visible Sample data chip,
//     and the search and listing routes do show sample data,
//   - zero third-party requests (the net fixture's deny-all asserts net.external is empty at
//     teardown; map tiles are the synthetic mock, never OSM),
//   - sample mode spends 0 RentCast calls; live mode spends only the calls its setup makes.

test.use(RENTER_TEST_OPTIONS);
test.describe.configure({ timeout: 90_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** 3 bedrooms, Townhouse, $1,475, ZIP 74201 (Active in the fixtures). */
const FIXTURE_ID = 'SAMPLE-74201-R017';
const MODES = ['sample', 'live'] as const;
type Mode = (typeof MODES)[number];
type RenterRoute = (typeof RENTER_ROUTES)[number];

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event. */
		__csp: string[];
	}
}

/** Before the first navigation: the boot-time violations fire long before test code could listen. */
async function installCollector(page: Page) {
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
}

const cspViolations = (page: Page) => page.evaluate(() => window.__csp ?? []);

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** The Phase 4 rule: every [data-provenance="sample"] block shows a visible Sample data chip. */
async function unbadgedSampleCards(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			Array.from(document.querySelectorAll('[data-provenance="sample"]')).filter(
				(card) =>
					!Array.from(card.querySelectorAll('[data-provenance-chip="sample"]')).some(
						(chip) => chip.getClientRects().length > 0
					)
			).length
	);
}

const sampleBlocks = (page: Page) => page.locator('[data-provenance="sample"]');
const resultsHeading = (page: Page) => page.locator('#results-heading');

async function goto(page: Page, path: string) {
	await page.goto(path);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1').first()).toBeVisible();
}

async function searchFor74201(page: Page) {
	await page.getByRole('textbox', { name: 'City and state, or ZIP code' }).fill('74201');
	await page
		.getByRole('search', { name: 'Search rentals' })
		.getByRole('button', { name: /^Search rentals/ })
		.click();
	await expect(resultsHeading(page)).toHaveText(/^\d+ rentals? in 74201$/);
}

async function openListing(page: Page) {
	await goto(page, `renter/listing/?id=${encodeURIComponent(FIXTURE_ID)}`);
	await expect(page.getByText('Loading listing…')).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Listing not found');
}

/**
 * Brings the route into its demo state and returns the number of RentCast calls the setup is
 * allowed to have spent: sample = 0 everywhere; live = 1 listings call for the search that every
 * live route except affordability starts from (the listing then resolves from the cache).
 */
async function prepare(page: Page, net: Net, route: RenterRoute, mode: Mode): Promise<number> {
	if (mode === 'live') {
		await mockRentCast(page, net);
		await withRentCastKey(page);
	}
	const live = mode === 'live';

	if (route === 'renter/affordability/') {
		await goto(page, route);
		await page.getByRole('textbox', { name: 'Income before taxes' }).fill('72,000');
		await expect(page.getByRole('link', { name: /^Search rentals up to \$/ })).toBeVisible();
		return 0;
	}

	await goto(page, 'renter/');
	if (live) {
		await expectLiveMode(page);
		await searchFor74201(page);
	} else {
		await expectSampleMode(page);
		await page.getByRole('button', { name: 'Try a sample search' }).click();
		await expect(resultsHeading(page)).toHaveText(/^\d+ rentals? in /);
	}
	expect(await cspViolations(page), `CSP violations on renter/ (${mode})`).toEqual([]);
	if (route === 'renter/') return live ? 1 : 0;

	await openListing(page);
	if (route === 'renter/listing/') return live ? 1 : 0;

	// renter/shortlist/: one saved listing so the page renders a real card, not the empty state.
	await page.getByRole('button', { name: 'Save to shortlist' }).click();
	await expect(page.getByRole('button', { name: 'On your shortlist' })).toBeVisible();
	expect(await cspViolations(page), `CSP violations on renter/listing/ (${mode})`).toEqual([]);
	await goto(page, route);
	await expect(page.getByRole('heading', { level: 1, name: 'Your shortlist' })).toBeVisible();
	await expect(page.locator('article[data-shortlist-card]')).toHaveCount(1);
	return live ? 1 : 0;
}

for (const route of RENTER_ROUTES) {
	for (const mode of MODES) {
		test(`${route} (${mode}): axe at 1280 and 375, zero CSP violations, sample chips, no horizontal scroll`, async ({
			page,
			net
		}) => {
			await installCollector(page);
			const allowedCalls = await prepare(page, net, route, mode);
			const label = `${route} (${mode})`;

			if (mode === 'live') await expectLiveMode(page);
			else await expectSampleMode(page);

			// Sample provenance: every sample block is badged; search and listing do show sample data.
			if (mode === 'sample') {
				if (route === 'renter/' || route === 'renter/listing/') {
					expect(await sampleBlocks(page).count(), `no sample data on ${label}`).toBeGreaterThan(0);
				}
				expect(await unbadgedSampleCards(page), `unbadged sample blocks on ${label}`).toBe(0);
			} else {
				// Live data is never dressed up as sample data.
				expect(await sampleBlocks(page).count(), `sample blocks on ${label}`).toBe(0);
			}

			await expectNoViolations(page, `${label} at 1280px`);
			expect(await cspViolations(page), `CSP violations on ${label}`).toEqual([]);

			// 375px: no horizontal scroll, still axe clean.
			await page.setViewportSize({ width: 375, height: 812 });
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
					message: `horizontal scroll on ${label} at 375px`
				})
				.toBeLessThanOrEqual(375);
			await expectNoViolations(page, `${label} at 375px`);
			if (mode === 'sample') {
				expect(await unbadgedSampleCards(page), `unbadged sample blocks on ${label} at 375`).toBe(
					0
				);
			}
			expect(await cspViolations(page), `CSP violations on ${label} at 375px`).toEqual([]);

			expect(rentcastCalls(net), `RentCast calls on ${label}`).toBe(allowedCalls);
			// net.external (zero third-party requests) is asserted by the fixture at teardown.
		});
	}
}
