import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Request } from '@playwright/test';
import { TOOLS, type ToolSlug } from '../../src/lib/content/tools';
import { faqPage, webApplication } from '../../src/lib/seo/jsonld';
import { TOOL_ROUTES } from './routes';

// GTM-03 end to end (10-14): the four free calculators and the /tools/ hub. Proves, on root and
// sub, that the pages make zero network calls while used, reproduce the UI-SPEC example figures
// exactly, show the empty / invalid / not-applicable states with the Accessibility Contract
// wiring, announce politely, carry intact JSON-LD at runtime with no CSP violation, pass axe in
// every state at 375 and 1280, and that the footer Tools links resolve.

declare global {
	interface Window {
		/** `violatedDirective` per securitypolicyviolation event (csp.spec pattern). */
		__csp: string[];
	}
}

const CALCULATORS = ['cap-rate', 'cash-on-cash', 'dscr'] as const;
type CalcSlug = (typeof CALCULATORS)[number];
const TOOL_PAGES: readonly ToolSlug[] = ['affordability', ...CALCULATORS];

const MINUS = String.fromCharCode(0x2212);
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Loads a route and waits for hydration (PortalSwitcher sets data-hydrated after mount). */
async function open(page: Page, route: string) {
	const res = await page.goto(route);
	expect(res?.status(), `status for ${route}`).toBe(200);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('nav[data-hydrated]')).toHaveCount(1);
}

const results = (page: Page, slug: CalcSlug) =>
	page.locator(`section[aria-labelledby="${slug}-results"]`);
const field = (page: Page, slug: CalcSlug, id: string) => page.locator(`#${slug}-${id}`);
const fillExample = (page: Page) =>
	page.getByRole('button', { name: 'Fill in an example' }).click();
const clear = (page: Page) => page.getByRole('button', { name: 'Clear', exact: true }).click();
const announcer = (page: Page) => page.getByTestId('live-announcer');

/** Requests that would break "zero API calls": any XHR-class request or any other origin. */
function offending(page: Page, req: Request): boolean {
	const type = req.resourceType();
	if (['fetch', 'xhr', 'websocket', 'eventsource'].includes(type)) return true;
	const url = req.url();
	if (url.startsWith('data:') || url.startsWith('blob:')) return false;
	return new URL(url).origin !== new URL(page.url()).origin;
}

async function recordOffending(page: Page): Promise<string[]> {
	const seen: string[] = [];
	page.on('request', (req) => {
		if (offending(page, req)) seen.push(`${req.resourceType()} ${req.url()}`);
	});
	return seen;
}

/** Uses a page the way a visitor would: example, typing, blur, clear (or the affordability inputs). */
async function exercise(page: Page, route: string) {
	const slug = route.replace(/^tools\//, '').replace(/\/$/, '');
	if (slug === '') return; // the hub has no inputs
	if (slug === 'affordability') {
		await page.getByRole('textbox', { name: 'Income before taxes' }).fill('72,000');
		await page.getByRole('textbox', { name: 'Monthly debt payments' }).fill('400');
		await page.getByRole('textbox', { name: 'Savings for moving' }).fill('3,000');
		await page.getByRole('textbox', { name: 'Savings for moving' }).blur();
		await expect(
			page.getByRole('heading', { name: 'Rent that fits: $1,500 to $1,800 a month' })
		).toBeVisible();
		await page.getByRole('spinbutton', { name: 'Try a rent amount a month' }).fill('2100');
		await expect(page.getByText('above the 40% check')).toBeVisible();
		return;
	}
	const calc = slug as CalcSlug;
	await fillExample(page);
	const first = field(page, calc, TOOLS[calc].fields[0].id);
	await first.fill('123456');
	await first.blur();
	await clear(page);
}

for (const route of TOOL_ROUTES) {
	test(`zero network on ${route}`, async ({ page }) => {
		await open(page, route);
		await page.waitForLoadState('networkidle');
		const seen = await recordOffending(page);
		await exercise(page, route);
		await page.waitForTimeout(1000);
		expect(seen).toEqual([]);
	});
}

test('zero-network recorder is not vacuous: a same-origin fetch is caught', async ({ page }) => {
	await open(page, 'tools/cap-rate/');
	await page.waitForLoadState('networkidle');
	const seen = await recordOffending(page);
	await page.evaluate(() =>
		// eslint-disable-next-line no-restricted-syntax -- control request proving the recorder catches fetches
		fetch(new URL('../../sitemap.xml', location.href)).then((r) => r.status)
	);
	await expect.poll(() => seen.length).toBe(1);
	expect(seen[0]).toMatch(/^fetch .*\/sitemap\.xml$/);
});

const EXAMPLES: Record<CalcSlug, string[]> = {
	'cap-rate': ['6.24%', '$15,600', '$22,800', '$7,200'],
	'cash-on-cash': ['0.90%', '$631', '$53', '$70,000', '$1,247', '$15,600'],
	dscr: ['1.04', '$15,600', '$14,969', '$1,247', '$631', 'The income covers the loan payments.']
};

for (const slug of CALCULATORS) {
	test(`example figures on ${slug}`, async ({ page }) => {
		await open(page, `tools/${slug}/`);
		await fillExample(page);
		const card = results(page, slug);
		for (const figure of EXAMPLES[slug]) await expect(card).toContainText(figure);
		const note = page.getByText('Example numbers, not market data.');
		await expect(note).toBeVisible();
		// Editing one value means these are no longer the example numbers.
		await field(page, slug, TOOLS[slug].fields[0].id).fill('260,000');
		await expect(note).toHaveCount(0);
	});

	test(`empty state on ${slug}`, async ({ page }) => {
		await open(page, `tools/${slug}/`);
		const card = results(page, slug);
		await expect(card).toContainText(TOOLS[slug].emptyBody ?? '');
		expect(await card.innerText()).not.toMatch(/\d/);
	});

	test(`clear focuses the first input and announces on ${slug}`, async ({ page }) => {
		await open(page, `tools/${slug}/`);
		await fillExample(page);
		await clear(page);
		const firstId = `${slug}-${TOOLS[slug].fields[0].id}`;
		await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe(firstId);
		await expect(announcer(page)).toHaveText('Calculator cleared.');
		await expect(results(page, slug)).toContainText(TOOLS[slug].emptyBody ?? '');
	});
}

for (const slug of ['cap-rate', 'cash-on-cash'] as const) {
	test(`invalid and zero purchase price on ${slug}`, async ({ page }) => {
		await open(page, `tools/${slug}/`);
		const price = field(page, slug, 'price');
		await price.fill('abc');
		await price.blur();
		await expect(page.getByText('Use numbers only, like 250,000.')).toBeVisible();
		await expect(price).toHaveAttribute('aria-invalid', 'true');
		await expect(price).toHaveAttribute(
			'aria-describedby',
			new RegExp(`\\b${slug}-price-error\\b`)
		);
		await expect(page.locator(`#${slug}-price-error`)).toHaveText(
			'Use numbers only, like 250,000.'
		);
		await price.fill('0');
		await price.blur();
		await expect(page.locator(`#${slug}-price-error`)).toHaveText(
			'Enter a purchase price above $0.'
		);
	});
}

test('DSCR with a $0 loan shows the not-applicable sentence', async ({ page }) => {
	await open(page, 'tools/dscr/');
	await fillExample(page);
	await field(page, 'dscr', 'loanAmount').fill('0');
	await expect(results(page, 'dscr')).toContainText(
		"There's no loan, so there are no loan payments to cover and DSCR doesn't apply."
	);
});

test('cash-on-cash marks a negative cash flow with a minus sign and words', async ({ page }) => {
	await open(page, 'tools/cash-on-cash/');
	await fillExample(page);
	await field(page, 'cash-on-cash', 'monthlyRent').fill('1,200');
	const card = results(page, 'cash-on-cash');
	await expect(card).toContainText(MINUS);
	await expect(card).toContainText('(negative)');
	await expect(card).toContainText(new RegExp(`${MINUS}\\$[\\d,]+ \\(negative\\)`));
});

test('cap rate example is announced politely 750 ms after Fill in an example', async ({ page }) => {
	await open(page, 'tools/cap-rate/');
	await fillExample(page);
	await expect(announcer(page)).toHaveText('Cap rate 6.24%. Net operating income $15,600 a year.');
	await expect(announcer(page)).toHaveAttribute('aria-live', 'polite');
});

for (const slug of TOOL_PAGES) {
	test(`JSON-LD and FAQ agree at runtime with no CSP violation on tools/${slug}/`, async ({
		page
	}) => {
		await page.addInitScript(() => {
			window.__csp = [];
			document.addEventListener('securitypolicyviolation', (e) =>
				window.__csp.push(e.violatedDirective)
			);
		});
		await open(page, `tools/${slug}/`);
		const blocks = page.locator('script[type="application/ld+json"]');
		await expect(blocks).toHaveCount(2);
		const parsed = (await blocks.allTextContents()).map((t) => JSON.parse(t));
		const app = parsed.find((b) => b['@type'] === 'WebApplication');
		const faq = parsed.find((b) => b['@type'] === 'FAQPage');
		expect(app, 'one WebApplication block').toBeTruthy();
		expect(faq, 'one FAQPage block').toBeTruthy();
		expect(app.url).toMatch(new RegExp(`/tools/${slug}/$`));

		const tool = TOOLS[slug];
		// Serialized back, each block equals the object built from the page's own content module.
		expect(app).toEqual(
			webApplication({ name: tool.h1, description: tool.description, url: app.url })
		);
		expect(faq).toEqual(faqPage(tool.faq));

		const names = faq.mainEntity.map((q: { name: string }) => q.name);
		const answers = faq.mainEntity.map(
			(q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text
		);
		expect(await page.locator('#questions h3').allInnerTexts()).toEqual(names);
		expect(await page.locator('#questions h3 + p').allInnerTexts()).toEqual(answers);

		expect(await page.evaluate(() => window.__csp)).toEqual([]);
	});
}

type State = 'empty' | 'example' | 'invalid' | 'not applicable' | 'filled';

async function reach(page: Page, slug: ToolSlug, state: State) {
	if (state === 'empty') return;
	if (slug === 'affordability') {
		await page.getByRole('textbox', { name: 'Income before taxes' }).fill('72,000');
		await page.getByRole('textbox', { name: 'Monthly debt payments' }).fill('400');
		await expect(
			page.getByRole('heading', { name: 'Rent that fits: $1,500 to $1,800 a month' })
		).toBeVisible();
		await expect(page.getByRole('slider', { name: 'Try a rent amount' })).toHaveAttribute(
			'aria-valuetext',
			'$1,800 a month'
		);
		return;
	}
	if (state === 'example') {
		await fillExample(page);
		await expect(page.getByText('Example numbers, not market data.')).toBeVisible();
	} else if (state === 'invalid') {
		const first = field(page, slug, TOOLS[slug].fields[0].id);
		await first.fill('abc');
		await first.blur();
		await expect(first).toHaveAttribute('aria-invalid', 'true');
	} else if (state === 'not applicable') {
		await fillExample(page);
		await field(page, 'dscr', 'loanAmount').fill('0');
		await expect(results(page, 'dscr')).toContainText("DSCR doesn't apply.");
	}
}

const STATES: Record<ToolSlug, State[]> = {
	affordability: ['empty', 'filled'],
	'cap-rate': ['empty', 'example', 'invalid'],
	'cash-on-cash': ['empty', 'example', 'invalid'],
	dscr: ['empty', 'example', 'invalid', 'not applicable']
};

for (const slug of TOOL_PAGES) {
	for (const state of STATES[slug]) {
		for (const width of [375, 1280]) {
			test(`axe: ${slug} calculator ${state} at ${width}px on "tools/${slug}/"`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 900 });
				await open(page, `tools/${slug}/`);
				await reach(page, slug, state);
				const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
				expect(
					violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)
				).toEqual([]);
			});
		}
	}
}

test('footer Tools links: five links in the Footer landmark, each resolving with 200', async ({
	page
}) => {
	await open(page, '');
	const nav = page.getByRole('contentinfo').getByRole('navigation', { name: 'Footer' });
	const expected = [
		'Rent affordability',
		'Cap rate',
		'Cash-on-cash return',
		'DSCR',
		'All calculators'
	];
	const tools = nav.getByRole('heading', { name: 'Tools' });
	await expect(tools).toBeVisible();
	const links = tools.locator('xpath=following-sibling::ul[1]').getByRole('link');
	expect(await links.allInnerTexts()).toEqual(expected);
	for (const name of expected) {
		const href = await nav.getByRole('link', { name, exact: true }).getAttribute('href');
		expect(href, name).toBeTruthy();
		const res = await page.request.get(new URL(href!, page.url()).href);
		expect(res.status(), `${name} -> ${href}`).toBe(200);
	}
});

test('footer columns: one column at 375, 2 x 2 at 800, four in a row at 1280', async ({ page }) => {
	const corners = async () => {
		const footer = page.getByRole('contentinfo');
		const boxes = await Promise.all([
			footer.getByText('Tran Real Estate Tools', { exact: true }).first().boundingBox(),
			footer.getByRole('heading', { name: 'Portals' }).boundingBox(),
			footer.getByRole('heading', { name: 'Tools' }).boundingBox(),
			footer.getByRole('heading', { name: 'Legal' }).boundingBox()
		]);
		return boxes.map((b) => ({ x: Math.round(b!.x), y: Math.round(b!.y) }));
	};
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page, '');
	let b = await corners();
	expect(new Set(b.map((p) => p.y)).size, '1280: one row').toBe(1);
	expect(b[0].x < b[1].x && b[1].x < b[2].x && b[2].x < b[3].x, '1280: left to right').toBe(true);

	await page.setViewportSize({ width: 800, height: 900 });
	b = await corners();
	expect(b[0].y, '800: wordmark and Portals share a row').toBe(b[1].y);
	expect(b[2].y, '800: Tools and Legal share a row').toBe(b[3].y);
	expect(b[2].y).toBeGreaterThan(b[0].y);
	expect(b[0].x, '800: Tools sits under the wordmark').toBe(b[2].x);

	await page.setViewportSize({ width: 375, height: 900 });
	b = await corners();
	expect(new Set(b.map((p) => p.x)).size, '375: one column').toBe(1);
	expect(b[0].y < b[1].y && b[1].y < b[2].y && b[2].y < b[3].y, '375: stacked').toBe(true);
});
