import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls, type Net } from './support/network';
import { MARKETS_PATH, mockRentCast, RENT_ESTIMATE_PATH } from './support/rentcast-mocks';
import { withRentCastKey } from './support/seed';

// RENT-06 end to end on both bases: the fair-rent check on the listing detail. Tier 1 (ZIP median)
// is free when the ZIP's market stats are cached and always free in sample mode; when they are not
// cached, "Load {zip} rent data (1 call)" shows the cost first and spends exactly one
// /v1/markets?zipCode=..&dataType=All&historyRange=24 call. Tier 2 "Get rent estimate (1 call)"
// spends exactly one /v1/avm/rent/long-term call. The copy is a comparison, never a judgment.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** 3 bedrooms, $1,475, ZIP 74201; its estimate fixture has 5 comparables. */
const FIXTURE_ID = 'SAMPLE-74201-R017';
const SENTENCE =
	/is (\d+% (above|below)|about the same as) the median rent of \$[\d,]+ for (\d+-bedroom rentals|studios) in \d{5}\./;
const INTRO =
	"RentCast estimates rent from similar rentals nearby. It's an automated estimate, not a professional valuation, and it isn't a figure a landlord has to accept.";
const JUDGMENT = /appraisal|apprais|value|overpriced|underpriced|good deal|bargain/i;

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

async function openListing(page: Page, id: string) {
	await page.goto(`renter/listing/?id=${encodeURIComponent(id)}`);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByText('Loading listing…')).toHaveCount(0);
}

/** Live mode: the listing is not cached yet, so "Look it up again (1 call)" brings it in. */
async function openLiveListing(page: Page, net: Net) {
	await openListing(page, FIXTURE_ID);
	await page.getByRole('button', { name: 'Look it up again (1 call)' }).click();
	await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Listing not found');
	expect(rentcastCalls(net)).toBe(1);
}

const section = (page: Page) => page.locator('[data-fair-rent]');
const tier1 = (page: Page) => page.locator('[data-fair-rent-tier="zip-median"]');
const tier2 = (page: Page) => page.locator('[data-fair-rent-tier="rent-estimate"]');
/** The Tier 1 result sentence with markup whitespace collapsed ('' until it renders). */
const sentence = async (page: Page) => {
	const el = tier1(page).locator('[data-fair-rent-sentence]').first();
	return (await el.count()) ? ((await el.textContent()) ?? '').replace(/\s+/g, ' ') : '';
};
const sectionText = async (page: Page) =>
	((await section(page).textContent()) ?? '').replace(/\s+/g, ' ');

test('keyless: both tiers render from sample data at 0 calls', async ({ page, net }) => {
	await openListing(page, FIXTURE_ID);

	await expect(section(page).getByRole('heading', { level: 2 })).toHaveText(
		'How this rent compares'
	);
	await expect(
		tier1(page).getByRole('heading', { level: 3, name: 'Compared with the ZIP median' })
	).toBeVisible();
	await expect.poll(() => sentence(page)).toMatch(SENTENCE);
	await expect(tier1(page)).toContainText(
		"Based on 26 rental listings in RentCast's data for 74201"
	);

	await expect(
		tier2(page).getByRole('heading', { level: 3, name: 'Rent estimate for this home' })
	).toBeVisible();
	// Sample mode reads the estimate fixture for free: no button to press.
	await expect(tier2(page).getByText(/^Estimate: \$[\d,]+ a month$/)).toBeVisible();
	await expect(tier2(page).getByText(/^Likely range: \$[\d,]+ to \$[\d,]+$/)).toBeVisible();
	await expect(tier2(page).getByRole('button', { name: /Get rent estimate/ })).toHaveCount(0);

	await expect(section(page).getByText('Sample data').first()).toBeVisible();
	await expect(
		tier2(page).getByRole('table', { name: 'Similar rentals RentCast compared' })
	).toContainText('Sample data');

	expect(await sectionText(page)).not.toMatch(JUDGMENT);
	expect(rentcastCalls(net)).toBe(0);
	await expectNoViolations(page, 'sample fair-rent check');
});

test('live: Tier 1 shows its cost, spends exactly one markets call, then reads from cache', async ({
	page,
	net
}) => {
	await withRentCastKey(page);
	await mockRentCast(page, net);
	await openLiveListing(page, net);

	const load = tier1(page).getByRole('button', { name: 'Load 74201 rent data (1 call)' });
	await expect(load).toBeVisible();
	await expect(tier1(page)).toContainText('ZIP data is saved for 30 days');
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(0);
	await expectNoViolations(page, 'live Tier 1 not cached');

	await load.click();
	await expect.poll(() => sentence(page)).toMatch(SENTENCE);
	await expect(tier1(page).locator('[data-fair-rent-sentence]')).toContainText(
		'for 3-bedroom rentals in 74201.'
	);
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(1);
	const marketsUrl = new URL(
		net.requests.find((r) => new URL(r.url).pathname === MARKETS_PATH)!.url
	);
	expect(marketsUrl.searchParams.get('zipCode')).toBe('74201');
	expect(marketsUrl.searchParams.get('dataType')).toBe('All');
	expect(marketsUrl.searchParams.get('historyRange')).toBe('24');
	expect(marketsUrl.search).toContain('historyRange=24');
	expect(marketsUrl.search).toContain('dataType=All');
	await expect(tier1(page).getByRole('button', { name: 'Refresh (1 call)' })).toBeVisible();

	// A reload reads the ZIP stats from the 30-day cache: the sentence, and no new call.
	const before = rentcastCalls(net);
	await page.reload();
	await expect.poll(() => sentence(page)).toMatch(SENTENCE);
	expect(rentcastCalls(net)).toBe(before);
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(1);
});

test('live: Tier 2 shows its cost first and spends exactly one estimate call', async ({
	page,
	net
}) => {
	await withRentCastKey(page);
	await mockRentCast(page, net, { estimateComps: 2 });
	await openLiveListing(page, net);

	const get = tier2(page).getByRole('button', { name: 'Get rent estimate (1 call)' });
	await expect(get).toBeVisible();
	await expect(tier2(page)).toContainText(INTRO);
	expect(rentcastCalls(net, RENT_ESTIMATE_PATH)).toBe(0);

	await get.click();
	await expect(tier2(page).getByText(/^Estimate: \$[\d,]+ a month$/)).toBeVisible();
	await expect(tier2(page).getByText(/^Likely range: \$[\d,]+ to \$[\d,]+$/)).toBeVisible();
	await expect(tier2(page).getByText('Low confidence: 2 comparables')).toBeVisible();
	expect(rentcastCalls(net, RENT_ESTIMATE_PATH)).toBe(1);
	expect(net.requests.filter((r) => r.url.includes('/v1/avm/rent/long-term'))).toHaveLength(1);

	const rows = tier2(page)
		.getByRole('table', { name: 'Similar rentals RentCast compared' })
		.locator('tbody tr');
	const count = await rows.count();
	expect(count).toBeGreaterThan(0);
	expect(count).toBeLessThanOrEqual(10);
	const distances = (await rows.locator('td:nth-child(3)').allTextContents()).map((t) =>
		Number.parseFloat(t)
	);
	expect(distances).toEqual([...distances].sort((a, b) => a - b));
	await expectNoViolations(page, 'live Tier 2 low confidence');

	const text = (await sectionText(page)).replace(INTRO, '');
	expect(text).not.toMatch(JUDGMENT);
});

test('live: a ZIP with no RentCast data explains that the estimate compares nearby rentals', async ({
	page,
	net
}) => {
	await withRentCastKey(page);
	await mockRentCast(page, net, { markets: 'none' });
	await openLiveListing(page, net);

	await tier1(page).getByRole('button', { name: 'Load 74201 rent data (1 call)' }).click();
	await expect(tier1(page)).toContainText('RentCast has no rent data for 74201 yet.');
	await expect(tier1(page)).toContainText(
		'The rent estimate below compares this home with nearby rentals instead.'
	);
	await expect(tier1(page).getByRole('button', { name: 'Edit search' })).toHaveCount(0);
	expect(rentcastCalls(net, MARKETS_PATH)).toBe(1);
});
