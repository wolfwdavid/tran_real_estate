import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_TAGS } from './agent-helpers';
import { PRINT_SNAPSHOT, STUDIO_ROUTES } from './routes';

// Phase 9 gate (09-23, ROADMAP SC5): every Studio route and the sample printout on the real built
// site, root and sub bases, with no keys. Every request is routed: RentCast and the four AI provider
// hosts must see zero requests in every test, and nothing may leave the local origin.
//
// Covered: each route in STUDIO_ROUTES plus print/snapshot/?id=sample answers 200 with its UI-SPEC
// h1 and is axe-clean at 1280x800 and 375x812 with no horizontal scroll; the listing, social and
// reel generators stream "Sample output" with no Must fix finding (and the reel view never shows
// its parse failure while the script is still streaming); the hub's empty and "1 draft saved"
// states with the incomplete disclosure, and the ready disclosure; a snapshot saved from the
// builder with the EHO statement, the Tran footer and Market notes turned off prints without them
// but keeps the not-removable labels; profile brand colors that fail contrast never reach the
// printout (Tran fallbacks) while a passing one is kept; and a saved record whose agent has a logo
// loads the profile logo and waits for it to decode before printing is enabled.

test.use({ serviceWorkers: 'block' });

/** RentCast and every AI provider host the app can reach (CSP connect-src). */
const PROVIDER_HOSTS = [
	'api.rentcast.io',
	'api.anthropic.com',
	'api.openai.com',
	'generativelanguage.googleapis.com',
	'openrouter.ai'
];
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

const SAMPLE_PRINT = `${PRINT_SNAPSHOT}?id=sample`;
/** UI-SPEC h1 per page (the print h1 is the report title of the sample record). */
const H1: Record<string, string> = {
	'agent/studio/': 'Studio',
	'agent/studio/listing/': 'Listing description',
	'agent/studio/social/': 'Social post pack',
	'agent/studio/reel/': 'Reel script',
	'agent/studio/snapshot/': 'Market Snapshot',
	[SAMPLE_PRINT]: 'Market Snapshot: ZIP 74201'
};
const PAGES: readonly string[] = [...STUDIO_ROUTES, SAMPLE_PRINT];

const SHORT_LABEL =
	'Market information only. Not a comparative market analysis or a professional valuation of any property.';
const EHO_TITLE = 'Equal Housing Opportunity.';
const TRAN_FOOTER = 'Prepared with Tran Real Estate Tools.';
const PRINT_URL = new RegExp(`/${PRINT_SNAPSHOT}\\?id=[0-9a-f-]{36}$`);
/** Tran's fallback brand tokens (terracotta / sand) as the print band receives them. */
const FALLBACK_PRIMARY = '#A4452A';
const FALLBACK_ACCENT = '#F6E3D8';
/** A 200 x 100 SVG logo; the profile rasterizes it to a 200 x 100 PNG. */
const SVG_LOGO =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#4F6449"/></svg>';

let external: string[];
let pageErrors: string[];

test.beforeEach(async ({ page }) => {
	external = [];
	pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(e.message));
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		if (LOCAL_HOSTS.has(url.hostname)) return route.fallback();
		external.push(url.href);
		return route.abort();
	});
});

test.afterEach(() => {
	const providerHits = external.filter((u) => PROVIDER_HOSTS.includes(new URL(u).hostname));
	expect(providerHits, 'the Studio must never reach RentCast or an AI provider').toHaveLength(0);
	expect(external, 'no request may leave the local origin').toEqual([]);
	expect(pageErrors, 'no uncaught page errors').toEqual([]);
});

async function expectAxe(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

async function expectNoPageScroll(page: Page, width: number, label: string): Promise<void> {
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth, `${label}: page scrollWidth`).toBeLessThanOrEqual(width);
}

/** Opens a Studio page or the printout and waits until the browser reads are done. */
async function open(page: Page, path: string): Promise<void> {
	const response = await page.goto(path);
	expect(response?.status(), `${path} status`).toBe(200);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	if (path.startsWith(PRINT_SNAPSHOT)) {
		await expect(page.locator('[data-ready]')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeEnabled();
		await expect(page.locator('article.print-sheet h1')).toHaveText(H1[path]!);
	} else {
		await expect(page.locator('h1')).toHaveText(H1[path]!);
		await expect(page.getByText('Loading your studio')).toHaveCount(0);
	}
	await expect(page.locator('h1:visible')).toHaveCount(1);
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	// The first interaction right after hydration can land before handlers settle.
	await page.waitForTimeout(200);
}

const panelByTitle = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** After a keyless run: the Sample output chip is shown and nothing is marked Must fix. */
async function expectSampleRun(page: Page, panelName: string): Promise<void> {
	const p = panelByTitle(page, panelName);
	await expect(p.getByText('Draft ready.', { exact: true })).toBeVisible({ timeout: 60_000 });
	await expect(p.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);
	await expect(p.getByText('Sample output', { exact: true }).first()).toBeVisible();
	await expect(p.getByText('Must fix', { exact: true })).toHaveCount(0);
}

const toolMeta = (page: Page, key: 'listing' | 'social' | 'reel' | 'snapshot') =>
	page.locator(`[data-studio-card="${key}"] [data-studio-tool-meta]`);

/** Writes one keyless listing description from the sample facts. */
async function writeSampleListing(page: Page): Promise<void> {
	await open(page, 'agent/studio/listing/');
	await page.getByRole('button', { name: 'Fill with sample facts' }).click();
	await expect(page.getByLabel('Street or area name')).toHaveValue('12 Example Lane');
	await page.getByRole('button', { name: 'Write description', exact: true }).click();
	await expectSampleRun(page, 'Listing description');
}

/** Saves a complete Texas profile through the Phase 8 profile page, with optional brand colors. */
async function saveProfile(
	page: Page,
	colors: { primary?: string; accent?: string } = {},
	logo?: string
): Promise<void> {
	await page.goto('agent/profile/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your profile');
	await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	await page.waitForTimeout(200);
	const field = (label: string) => page.getByLabel(label, { exact: true });
	await field('Full name').fill('Sample Agent');
	await field('Brokerage').fill('Example Realty');
	await field('License type').selectOption('salesperson');
	await field('License number').fill('SAMPLE-0001');
	await field('License state').selectOption('TX');
	await field('Brokerage phone').fill('(555) 555-0100');
	await field('Street address').fill('12 Sample Lane');
	await field('City').fill('Austin');
	await field('State').selectOption('TX');
	await field('ZIP code').fill('78701');
	if (colors.primary !== undefined) {
		await field('Primary color').fill(colors.primary);
		await field('Primary color').blur();
	}
	if (colors.accent !== undefined) {
		await field('Accent color').fill(colors.accent);
		await field('Accent color').blur();
	}
	if (logo !== undefined) {
		await page.locator('#profile-logo-file').setInputFiles({
			name: 'logo.svg',
			mimeType: 'image/svg+xml',
			buffer: Buffer.from(logo)
		});
		await expect(page.getByTestId('logo-preview').locator('img')).toHaveAttribute('src', /^blob:/);
	}
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByTestId('profile-status')).toHaveText('Saved.');
}

const step = (page: Page, n: number) => page.locator(`[data-step="${n}"]`);
const loadZipButton = (page: Page) => page.getByRole('button', { name: /^Load ZIP data/ });

/**
 * Keyless builder: loads the first sample ZIP (0 calls), turns Market notes off (plus any other
 * listed step 2 checkbox), saves and lands on the printout of the new record.
 */
async function saveSampleSnapshot(page: Page, uncheck: readonly string[] = []): Promise<void> {
	await open(page, 'agent/studio/snapshot/');
	await expect(page.locator('[data-snapshot-builder]')).toBeVisible();
	const first = step(page, 1).getByRole('radio').first();
	const zip = (await first.getAttribute('value')) ?? '';
	expect(zip).toMatch(/^\d{5}$/);
	await first.check();
	await expect(loadZipButton(page)).toHaveAccessibleName('Load ZIP data (0 calls · sample data)');
	await loadZipButton(page).click();
	await expect(
		step(page, 1).getByRole('heading', { level: 3, name: `ZIP ${zip}`, exact: true })
	).toBeFocused();
	for (const label of ['Market notes', ...uncheck]) {
		const box = step(page, 2).getByLabel(label, { exact: true });
		await box.uncheck();
		await expect(box).not.toBeChecked();
	}
	await expect(page.locator('[data-save-reason]')).toHaveCount(0);
	await page.locator('[data-save-snapshot]').click();
	await expect(page).toHaveURL(PRINT_URL);
	await expect(page.locator('[data-ready]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeEnabled();
}

/** The print band's effective brand tokens and the colors they paint. */
function printBrand(page: Page) {
	return page.evaluate(() => {
		const band = document.querySelector('[data-brand-band]') as HTMLElement;
		const title = document.querySelector('#report-title') as HTMLElement;
		const css = getComputedStyle(band);
		return {
			primary: css.getPropertyValue('--brand-primary-effective').trim().toUpperCase(),
			accent: css.getPropertyValue('--brand-accent-effective').trim().toUpperCase(),
			bandBackground: css.backgroundColor,
			bandRule: css.borderBottomColor,
			titleColor: getComputedStyle(title).color
		};
	});
}

for (const [width, height] of [
	[1280, 800],
	[375, 812]
] as const) {
	test.describe(`every Studio page at ${width}px`, () => {
		test.use({ viewport: { width, height } });

		test(`STUDIO_ROUTES and the sample printout: 200, h1, axe-clean, no sideways scroll`, async ({
			page
		}) => {
			// About 6 s per page on one core (load, hydration, axe): budget by the pages walked.
			test.setTimeout(PAGES.length * 20_000);
			expect(PAGES.length).toBe(STUDIO_ROUTES.length + 1);
			for (const path of PAGES) {
				await open(page, path);
				await expectAxe(page, `${path} (${width}px)`);
				await expectNoPageScroll(page, width, `${path} (${width}px)`);
			}
		});
	});
}

test('hub: empty meta lines and incomplete disclosure, then "1 draft saved" after a listing draft', async ({
	page
}) => {
	test.setTimeout(240_000);
	await open(page, 'agent/studio/');
	await expect(toolMeta(page, 'listing')).toHaveText('No drafts yet');
	await expect(toolMeta(page, 'social')).toHaveText('No drafts yet');
	await expect(toolMeta(page, 'reel')).toHaveText('No drafts yet');
	await expect(toolMeta(page, 'snapshot')).toHaveText('No snapshots yet');
	const disclosure = page.locator('[data-disclosure-status="incomplete"]');
	await expect(disclosure).toBeVisible();
	await expect(disclosure).toContainText('Finish your profile to copy studio content');
	for (const [w, h] of [
		[1280, 800],
		[375, 812]
	] as const) {
		await page.setViewportSize({ width: w, height: h });
		await expectAxe(page, `hub with no drafts (${w}px)`);
		await expectNoPageScroll(page, w, `hub with no drafts (${w}px)`);
	}
	await page.setViewportSize({ width: 1280, height: 800 });

	await writeSampleListing(page);

	await open(page, 'agent/studio/');
	await expect(toolMeta(page, 'listing')).toHaveText('1 draft saved');
	await expect(toolMeta(page, 'social')).toHaveText('No drafts yet');
	await expect(toolMeta(page, 'reel')).toHaveText('No drafts yet');
	await expect(toolMeta(page, 'snapshot')).toHaveText('No snapshots yet');
	await expect(page.locator('[data-disclosure-status="incomplete"]')).toContainText(
		'Finish your profile to copy studio content'
	);
	for (const [w, h] of [
		[1280, 800],
		[375, 812]
	] as const) {
		await page.setViewportSize({ width: w, height: h });
		await expectAxe(page, `hub with a draft (${w}px)`);
		await expectNoPageScroll(page, w, `hub with a draft (${w}px)`);
	}
});

test('social: the sample brief streams three Sample output cards with no Must fix', async ({
	page
}) => {
	test.setTimeout(240_000);
	await open(page, 'agent/studio/social/');
	await page.getByRole('button', { name: 'Use a sample brief' }).click();
	await expect(page.locator('[data-social-studio] [data-sample-chip]')).toBeVisible();
	await page.getByRole('button', { name: 'Write post pack', exact: true }).click();
	await expectSampleRun(page, 'Post pack');
	const cards = panelByTitle(page, 'Post pack').locator('article[data-platform-card]');
	await expect(cards).toHaveCount(3);
	for (const platform of ['Instagram', 'Facebook', 'LinkedIn']) {
		const copy = panelByTitle(page, 'Post pack').getByRole('button', {
			name: `Copy ${platform} post`
		});
		await expect(copy).not.toHaveAttribute('aria-disabled', 'true');
	}
});

test('reel: the sample beats stream a Sample output script; the parse failure never flashes', async ({
	page
}) => {
	test.setTimeout(240_000);
	// Records every state the Script at a glance view shows while the script streams in.
	await page.addInitScript(() => {
		const w = window as Window & { __reelStates?: string[] };
		w.__reelStates = [];
		const record = () => {
			const el = document.querySelector('[data-reel-view-state]');
			const state = el?.getAttribute('data-reel-view-state') ?? (el ? '' : null);
			const now = state ?? (document.querySelector('[data-reel-table]') ? 'beats' : null);
			if (now && w.__reelStates!.at(-1) !== now) w.__reelStates!.push(now);
		};
		new MutationObserver(record).observe(document, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['data-reel-view-state']
		});
	});
	await open(page, 'agent/studio/reel/');
	await page.getByRole('button', { name: 'Fill with sample beats' }).click();
	await expect(page.locator('[data-reel-studio] [data-sample-chip]')).toBeVisible();
	await page.getByRole('button', { name: 'Write reel script', exact: true }).click();
	await expectSampleRun(page, 'Reel script');
	const glance = page.getByRole('region', { name: 'Script at a glance' });
	await expect(glance.locator('[data-reel-table]')).toBeAttached();
	await expect(glance.getByText("Tran couldn't split this script into beats")).toHaveCount(0);
	const states = await page.evaluate(
		() => (window as Window & { __reelStates?: string[] }).__reelStates ?? []
	);
	expect(states, 'Script at a glance states during the run').not.toContain('unparsed');
	expect(states.at(-1), 'the finished script shows its beats').toBe('beats');
	expect(states[0], 'before the run the view shows its empty line').toBe('empty');
});

test('saved record: EHO, the Tran footer and Market notes turned off are honored in print', async ({
	page
}) => {
	test.setTimeout(240_000);
	await saveSampleSnapshot(page, [
		'Include the Equal Housing Opportunity statement',
		'Include "Prepared with Tran Real Estate Tools" at the bottom'
	]);
	const sheet = page.locator('article.print-sheet');
	await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
	await page.emulateMedia({ media: 'print' });
	await expect(sheet.getByText(SHORT_LABEL, { exact: true })).toBeVisible();
	await expect(sheet.getByRole('heading', { name: 'Prepared by', exact: true })).toBeVisible();
	await expect(sheet.getByRole('heading', { name: 'Data sources', exact: true })).toBeVisible();
	await expect(sheet.getByText(EHO_TITLE, { exact: true })).toHaveCount(0);
	await expect(sheet.getByText(TRAN_FOOTER, { exact: true })).toHaveCount(0);
	await expect(sheet.getByRole('heading', { name: 'Market notes' })).toHaveCount(0);
	// Non-vacuity: the sections that stayed on did print.
	await expect(sheet.getByRole('heading', { name: 'Rent trend by bedroom count' })).toBeVisible();
	await page.emulateMedia({ media: 'screen' });
	await expectAxe(page, 'printout of a saved record with statements off');
});

test('brand colors that fail contrast never reach the printout; a passing primary is kept', async ({
	page
}) => {
	test.setTimeout(300_000);
	await saveProfile(page, { primary: '#FFFF00', accent: '#000000' });
	// The profile form keeps the typed colors and says reports use Tran's colors instead.
	await expect(page.getByTestId('verdict-primary')).toContainText('Too low');
	await expect(page.getByTestId('verdict-accent')).toContainText('Too low');

	// The hub's disclosure is now ready (axe-clean in that state too).
	await open(page, 'agent/studio/');
	await expect(page.locator('[data-disclosure-status="ready"]')).toBeVisible();
	await expectAxe(page, 'hub with a ready disclosure');

	await saveSampleSnapshot(page);
	expect(await printBrand(page)).toEqual({
		primary: FALLBACK_PRIMARY,
		accent: FALLBACK_ACCENT,
		bandBackground: 'rgb(246, 227, 216)',
		bandRule: 'rgb(164, 69, 42)',
		titleColor: 'rgb(164, 69, 42)'
	});
	await expect(page.locator('article.print-sheet')).toContainText('Example Realty');

	await saveProfile(page, { primary: '#1F4E79' });
	await expect(page.getByTestId('verdict-primary')).toContainText('Passes');
	await saveSampleSnapshot(page);
	expect(await printBrand(page)).toEqual({
		primary: '#1F4E79',
		accent: FALLBACK_ACCENT,
		bandBackground: 'rgb(246, 227, 216)',
		bandRule: 'rgb(31, 78, 121)',
		titleColor: 'rgb(31, 78, 121)'
	});
});

/** A frozen, non-sample record whose agent had a logo (synthetic, made-up values). */
function logoRecord(id: string) {
	const at = '2026-09-15T15:00:00.000Z';
	return {
		id,
		zip: '74201',
		placeName: null,
		createdAt: at,
		sample: false,
		source: 'rentcast',
		fetchedAt: at,
		metrics: {
			zip: '74201',
			lastUpdated: '2026-09-14',
			medianRent: 1600,
			medianPrice: 320000,
			priceToRent: 16.7,
			rentChangePct: 2.1,
			rentChangeFrom: '2025-09',
			rentChangeTo: '2026-08',
			months: 12,
			saleDom: 30,
			rentalDom: 20,
			saleTotal: 80,
			saleNew: 15,
			rentalTotal: 110,
			rentalNew: 25,
			rentByBedroom: [{ beds: 2, median: 1550, listings: 30 }]
		},
		series: { rentTrend: null, priceToRent: null },
		listingsSample: null,
		listingsFetchedAt: null,
		narrative: null,
		options: { eho: true, tranFooter: true, sections: ['keyFigures'] },
		agent: {
			disclosure: {
				fullName: 'Sample Agent',
				brokerage: 'Example Realty',
				licenseType: 'Licensed Real Estate Salesperson',
				licenseNumber: 'SAMPLE-0001',
				licenseState: 'TX',
				brokeragePhone: '(555) 555-0100'
			},
			brandPrimary: '#1F4E79',
			brandAccent: FALLBACK_ACCENT,
			hasLogo: true
		},
		ownerId: 'local',
		updatedAt: at,
		schemaVersion: 1
	};
}

test('a saved record with a logo loads the profile logo and enables printing once it decodes', async ({
	page
}) => {
	test.setTimeout(240_000);
	await page.addInitScript(() => {
		const w = window as Window & { __csp?: string[] };
		w.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			w.__csp!.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
	await saveProfile(page, {}, SVG_LOGO);

	const id = '7a1e3c5b-2d4f-4e6a-8b9c-0d1e2f3a4b5c';
	await page.evaluate(async (row) => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('tran');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('snapshots', 'readwrite');
			tx.objectStore('snapshots').put(row);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	}, logoRecord(id));

	await page.goto(`${PRINT_SNAPSHOT}?id=${id}`);
	await expect(page.locator('[data-ready]')).toBeVisible();
	const button = page.getByRole('button', { name: 'Print or save as PDF' });
	await expect(button).toBeEnabled();
	await expect(button).toBeFocused();
	// The button is enabled only after img.decode() settled: the logo is complete and decoded.
	const logo = page.locator('[data-brand-band] img[data-brand-logo]');
	await expect(logo).toHaveAttribute('src', /^blob:/);
	await expect(logo).toHaveAttribute('alt', 'Example Realty logo');
	expect(
		await logo.evaluate((img: HTMLImageElement) => ({
			complete: img.complete,
			width: img.naturalWidth,
			height: img.naturalHeight
		}))
	).toEqual({ complete: true, width: 200, height: 100 });
	await expect(logo).toBeVisible();
	await page.emulateMedia({ media: 'print' });
	await expect(logo).toBeVisible();
	await page.emulateMedia({ media: 'screen' });
	expect(await page.evaluate(() => (window as Window & { __csp?: string[] }).__csp)).toEqual([]);
	await expectAxe(page, 'printout of a saved record with a logo');
});
