import { test, expect, type Page } from '@playwright/test';
import { findBanned } from '../../../../scripts/lib/banned-terms-rules.mjs';
import { ROUTES, CHROME_ROUTES } from './routes';

// BRND-01/02/04 content contracts, proven on the built site under both bases. Every goto is
// relative so the same spec runs at '/' and '/tran_real_estate/'; prerendered hrefs are
// base-relative, so links are resolved against page.url() before their pathname is asserted.

const AUDIENCES = [
	{
		route: 'for-renters/',
		cardLabel: 'Explore renter tools',
		h1: 'Find rentals that fit, without refreshing all day',
		openLabel: 'Open renter portal',
		portal: 'renter'
	},
	{
		route: 'for-investors/',
		cardLabel: 'Explore investor tools',
		h1: 'Run the numbers before you spend a weekend on a listing',
		openLabel: 'Open investor portal',
		portal: 'investor'
	},
	{
		route: 'for-agents/',
		cardLabel: 'Explore agent tools',
		h1: 'Leads, follow-ups, and content in one place',
		openLabel: 'Open agent portal',
		portal: 'agent'
	}
] as const;

const TERMS_SENTENCE =
	'Tran Real Estate Tools is not a real estate brokerage and does not act as an agent for anyone. Nothing in the app is investment, legal, or tax advice.';
const DATA_COVERAGE = [
	'No MLS or IDX feeds',
	'No listing photos',
	'No CoStar or LoopNet data',
	'They are not professional valuations of a property and can be wrong.'
];
const LAST_UPDATED: Record<string, string> = {
	'legal/privacy/': 'Last updated: 30 October 2026',
	'legal/terms/': 'Last updated: 4 October 2026',
	'legal/fair-housing/': 'Last updated: 4 October 2026',
	'legal/data-coverage/': 'Last updated: 4 October 2026'
};

/** The pathname a link's href resolves to from the current page. */
async function resolvedPath(page: Page, link: ReturnType<Page['getByRole']>): Promise<string> {
	const href = await link.getAttribute('href');
	expect(href, 'link has an href').toBeTruthy();
	return new URL(href!, page.url()).pathname;
}

async function metaDescription(page: Page): Promise<string> {
	// The print surface has no description; read it without waiting so absence yields ''.
	const meta = page.locator('meta[name="description"]');
	if ((await meta.count()) === 0) return '';
	return (await meta.first().getAttribute('content')) ?? '';
}

test('landing explains the product and routes to every portal', async ({ page }) => {
	await page.goto('');
	await expect(page.locator('h1')).toHaveText('Real estate tools that do the refreshing for you');

	const choose = page.getByRole('link', { name: 'Choose your portal', exact: true });
	await expect(choose).toHaveAttribute('href', '#portals');
	await expect(page.locator('#portals')).toHaveCount(1);
	const tour = page.getByRole('link', { name: 'Show me around', exact: true });
	await expect(tour).toHaveAttribute('href', '#get-started');
	await expect(page.locator('#get-started')).toHaveCount(1);
	await expect(page.locator('#how-it-works')).toHaveCount(1);

	await expect(page.getByRole('heading', { name: 'Three steps, no account' })).toBeVisible();
	for (const trust of [
		'Your keys stay in your browser',
		'Not a brokerage',
		'Legitimate data only'
	]) {
		await expect(page.getByRole('heading', { name: trust, level: 3 })).toBeVisible();
	}

	// Collect every card target first, then visit each one (navigating detaches the landing DOM).
	const targets: { url: string; h1: string }[] = [];
	for (const a of AUDIENCES) {
		const link = page.getByRole('link', { name: a.cardLabel, exact: true });
		await expect(link).toBeVisible();
		const path = await resolvedPath(page, link);
		expect(path, `${a.cardLabel} target`).toMatch(new RegExp(`/${a.route}$`));
		targets.push({ url: new URL(path, page.url()).href, h1: a.h1 });
	}
	for (const t of targets) {
		const res = await page.request.get(t.url);
		expect(res.status(), `status for ${t.url}`).toBe(200);
		await page.goto(t.url);
		await expect(page.locator('h1')).toHaveText(t.h1);
	}
});

for (const a of AUDIENCES) {
	test(`audience page ${a.route} sends visitors to the ${a.portal} portal`, async ({ page }) => {
		await page.goto(a.route);
		await expect(page.locator('h1')).toHaveText(a.h1);

		const open = page.getByRole('link', { name: a.openLabel }).first();
		const sample = page.getByRole('link', { name: 'Try sample data', exact: true });
		await expect(open).toBeVisible();
		await expect(sample).toBeVisible();
		expect(await resolvedPath(page, open)).toMatch(new RegExp(`/${a.portal}/$`));
		expect(await resolvedPath(page, sample)).toMatch(new RegExp(`/${a.portal}/$`));

		const heading = page.getByRole('heading', { name: 'Good to know', level: 2 });
		await expect(heading).toBeVisible();
		await expect(page.locator('section[aria-labelledby="limits-heading"] li')).toHaveCount(3);
	});
}

test('terms page carries the verbatim not-a-brokerage, not-advice sentence', async ({ page }) => {
	await page.goto('legal/terms/');
	// innerText collapses the Prettier line wrap in the source into single spaces.
	await expect(page.locator('main')).toContainText(TERMS_SENTENCE);
});

test('data coverage names the MLS, photo and CoStar exclusions and the estimate limits', async ({
	page
}) => {
	await page.goto('legal/data-coverage/');
	for (const s of DATA_COVERAGE) await expect(page.locator('main')).toContainText(s);
});

test('fair housing statement links HUD in the same tab', async ({ page }) => {
	await page.goto('legal/fair-housing/');
	const hud = page.locator('a[href^="https://www.hud.gov/"]');
	await expect(hud).toHaveCount(1);
	expect(await hud.getAttribute('target')).toBeNull();
});

test('privacy policy says there is no Tran server holding user data', async ({ page }) => {
	await page.goto('legal/privacy/');
	await expect(page.locator('main')).toContainText('no server that stores your data');
});

for (const route of Object.keys(LAST_UPDATED)) {
	test(`legal page ${route} shows its last-updated date`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('main')).toContainText(LAST_UPDATED[route]);
	});
}

test('the banned-terms rules catch a known bad phrase (control)', () => {
	expect(findBanned('x', 'Our guaranteed returns')).toHaveLength(1);
});

for (const route of ROUTES) {
	test(`rendered copy passes the banned-terms rules on ${JSON.stringify(route)}`, async ({
		page
	}) => {
		await page.goto(route);
		await expect(page.locator('h1')).toBeVisible();
		const text = [
			await page.title(),
			await metaDescription(page),
			await page.locator('body').innerText()
		].join('\n');
		expect(findBanned(route || 'index', text)).toEqual([]);
	});
}

test('every page except print has a unique meta description', async ({ page }) => {
	const descriptions: string[] = [];
	for (const route of CHROME_ROUTES) {
		await page.goto(route);
		const d = await metaDescription(page);
		expect(d.trim(), `meta description on ${JSON.stringify(route)}`).not.toBe('');
		descriptions.push(d);
	}
	expect(new Set(descriptions).size, descriptions.join('\n')).toBe(CHROME_ROUTES.length);
});
