import { test, expect, type Page } from '@playwright/test';
import { AGENT_ROUTES, PUBLIC_ROUTES } from './routes';
import {
	TEST_ACCESS_KEY,
	expectAxeClean,
	expectNoHorizontalScroll,
	inquiryPath,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// Phase 8 gate (08-26, success criterion 5): every agent route and the public inquiry page pass
// axe (WCAG 2.0/2.1/2.2 A and AA) with exactly one visible h1, at 1280 and at 375 with no
// horizontal scroll, both with an empty CRM and with the 12 sample contacts loaded, on both bases.
// The route list comes from routes.ts, so a new agent route joins the sweep automatically. The
// contact detail opens a real sample contact (?id=) when samples exist and shows its not-found
// block when the CRM is empty and no id is given. Zero RentCast requests in every case.

const ROUTES = ['agent/', ...AGENT_ROUTES] as const;
const STATES = ['empty', 'samples'] as const;
const WIDTHS = [1280, 375] as const;
const SAMPLE_NAME = 'Jordan Example';

/** Waits for the frame guard, hydration and the first live query (no loading line left). */
async function settle(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1:visible')).toHaveCount(1);
	await expect(page.getByText(/^Loading (your|this) /)).toHaveCount(0);
	await page.evaluate(() => document.fonts.ready);
}

/** The ?id= of a sample contact, read from its link in the contacts list. */
async function sampleContactId(page: Page): Promise<string> {
	await page.goto('agent/contacts/');
	await settle(page);
	const href = await page
		.getByRole('link', { name: SAMPLE_NAME, exact: true })
		.first()
		.getAttribute('href');
	const id = new URL(href ?? '', 'http://x/').searchParams.get('id');
	expect(id, 'sample contact link carries ?id=').toBeTruthy();
	return id as string;
}

let rentcastHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
});

test('the sweep covers every agent route and the public inquiry page', () => {
	expect(ROUTES).toHaveLength(7);
	expect(ROUTES).toContain('agent/contact/');
	expect(PUBLIC_ROUTES).toEqual(['agent/inquire/']);
});

for (const width of WIDTHS) {
	test.describe(`${width}px`, () => {
		test.use({ viewport: { width, height: width === 375 ? 812 : 900 } });

		for (const state of STATES) {
			for (const route of ROUTES) {
				test(`${route} (${state}) is axe clean`, async ({ page }) => {
					let path: string = route;
					if (state === 'samples') {
						await loadSampleContacts(page);
						if (route === 'agent/contact/') path = `${route}?id=${await sampleContactId(page)}`;
					}
					await page.goto(path);
					await settle(page);
					if (route === 'agent/contact/') {
						await expect(page.getByRole('heading', { level: 1 })).toHaveText(
							state === 'samples' ? SAMPLE_NAME : "This contact isn't here"
						);
					}
					if (state === 'samples') {
						await expect(page.getByRole('region', { name: 'Sample contacts' })).toBeVisible();
					}
					await expectAxeClean(page, `${path} (${state}, ${width}px)`);
					if (width === 375) await expectNoHorizontalScroll(page);
				});
			}
		}

		const inquiry = [
			[
				'share link',
				inquiryPath({ v: '1', k: TEST_ACCESS_KEY, n: 'Sample Agent', b: 'Example Realty' }),
				'Contact Sample Agent'
			],
			['demo', inquiryPath({ demo: '1' }), 'Contact Avery Sample'],
			['no params', 'agent/inquire/', "This inquiry link isn't complete"]
		] as const;
		for (const [label, path, h1] of inquiry) {
			test(`public inquiry page (${label}) is axe clean`, async ({ page }) => {
				await page.goto(path);
				await settle(page);
				await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
				await expectAxeClean(page, `inquiry ${label} (${width}px)`);
				if (width === 375) await expectNoHorizontalScroll(page);
			});
		}
	});
}
