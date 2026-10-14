import { test, expect, type Page } from '@playwright/test';
import { expectAxeClean } from './agent-helpers';
import { openSettings } from './helpers/settings';
import { siteEnv } from './site-env';
import { mailtoHref } from '../../src/lib/components/forms/form-gate';

// GTM-02 feedback and GTM-01 Settings re-entry (10-18) on a build WITHOUT the owner's Web3Forms key
// (root locally, sub always): /feedback/ is an honest coming-soon panel with no fields; the footer
// link carries the current portal; Settings "Getting started" restarts the guide and links to the
// RentCast setup page. The open form is covered by feedback.configured.spec.ts.

const ONBOARDING_KEY = 'tran.onboarding.v1';

test.beforeEach(() => {
	const env = siteEnv(test.info().project.name);
	test.skip(
		!!env.web3formsKey,
		'owner key configured on this build; open state covered by the configured project'
	);
});

const footer = (page: Page) =>
	page.getByRole('contentinfo').getByRole('navigation', { name: 'Footer' });
const gettingStarted = (page: Page) => page.locator('#getting-started');

test("feedback/ is a coming-soon panel with no fields: The feedback form isn't open yet", async ({
	page
}) => {
	const env = siteEnv(test.info().project.name);
	const web3forms: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('api.web3forms.com')) web3forms.push(r.url());
	});

	await page.goto('feedback/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Send feedback');
	const main = page.getByRole('main');
	await expect(main).toContainText("The feedback form isn't open yet");
	await expect(main.locator('textarea')).toHaveCount(0);
	await expect(main.locator('input')).toHaveCount(0);
	await expect(main.locator('form')).toHaveCount(0);

	const mailto = main.locator('a[href^="mailto:"]');
	if (env.contactEmail === '') {
		await expect(mailto).toHaveCount(0);
		await expect(main).toContainText('Please check back later.');
	} else {
		await expect(mailto).toHaveAttribute('href', mailtoHref(env.contactEmail, 'Tran feedback'));
	}

	await page.waitForLoadState('networkidle');
	expect(web3forms).toEqual([]);
});

test('axe: feedback coming-soon state', async ({ page }) => {
	await page.goto('feedback/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expectAxeClean(page, 'feedback/ coming soon');
});

test('footer Send feedback carries the portal on portal pages and resolves with 200', async ({
	page
}) => {
	for (const [route, query] of [
		['investor/', '?portal=investor'],
		['renter/shortlist/', '?portal=renter'],
		['agent/', '?portal=agent'],
		['tools/', ''],
		['settings/', '']
	] as const) {
		await page.goto(route);
		const link = footer(page).getByRole('link', { name: 'Send feedback', exact: true });
		const href = await link.getAttribute('href');
		expect(href, route).toMatch(new RegExp(`feedback/${query.replace('?', '\\?')}$`));
		const target = new URL(href!, page.url());
		expect(target.searchParams.get('portal') ?? '', route).toBe(query.replace('?portal=', ''));
		const res = await page.request.get(target.href);
		expect(res.status(), `${route} -> ${target.href}`).toBe(200);
	}

	// Prerendered: the investor page's static HTML already carries the query.
	const html = await (await page.request.get('investor/')).text();
	expect(html).toContain('feedback/?portal=investor');
});

test('footer Send feedback is marked current on the feedback page', async ({ page }) => {
	await page.goto('feedback/');
	await expect(
		footer(page).getByRole('link', { name: 'Send feedback', exact: true })
	).toHaveAttribute('aria-current', 'page');
});

test('Settings Getting started: Show the tour again resets the guide and focuses its heading', async ({
	page
}) => {
	// A returning visitor who finished the guide: the landing would show the compact row.
	await page.addInitScript(
		([k, v]) => {
			if (sessionStorage.getItem('seeded') === null) {
				localStorage.setItem(k, v);
				sessionStorage.setItem('seeded', '1');
			}
		},
		[ONBOARDING_KEY, JSON.stringify({ status: 'done', lastPortal: 'investor' })]
	);
	await openSettings(page);

	const section = gettingStarted(page);
	await expect(section.getByRole('heading', { level: 2 })).toHaveText('Getting started');
	await expect(section).toContainText(
		'Take the short tour again, or set up a RentCast key step by step.'
	);
	// Last section on the page and last entry of the section nav.
	await expect(page.getByRole('main').locator('section > h2').last()).toHaveText('Getting started');
	const nav = page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link');
	await expect(nav.last()).toHaveText('Getting started');
	await expect(nav.last()).toHaveAttribute('href', /#getting-started$/);

	await section.getByRole('link', { name: 'Show the tour again', exact: true }).click();
	await page.waitForURL(/#get-started$/);
	expect(new URL(page.url()).pathname).toMatch(/\/$/);
	expect(new URL(page.url()).pathname).not.toMatch(/settings/);

	const guide = page.locator('#get-started');
	await expect(guide).toHaveAttribute('data-ready', '');
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.id))
		.toBe('get-started-heading');
	await expect(guide).toContainText('Where do you want to start?');
	for (const name of ['Renter Start the tour', 'Investor Start the tour', 'Agent Start the tour']) {
		await expect(guide.getByRole('button', { name })).toBeVisible();
	}
	const stored = await page.evaluate((k) => localStorage.getItem(k), ONBOARDING_KEY);
	expect(JSON.parse(stored ?? 'null')).toEqual({ status: 'new', lastPortal: 'investor' });
});

test('Settings Getting started: Set up a RentCast key and Send feedback links resolve', async ({
	page
}) => {
	await openSettings(page);
	const section = gettingStarted(page);

	const setup = section.getByRole('link', { name: 'Set up a RentCast key', exact: true });
	await expect(setup).toHaveAttribute('href', /\/setup\/rentcast\/$/);
	const feedback = section.getByRole('link', { name: 'Send feedback', exact: true });
	await expect(feedback).toHaveAttribute('href', /\/feedback\/$/);
	await expect(section).toContainText('Have an idea or found a problem? Send feedback.');

	const res = await page.request.get(
		new URL((await feedback.getAttribute('href'))!, page.url()).href
	);
	expect(res.status()).toBe(200);

	await setup.click();
	await page.waitForURL(/\/setup\/rentcast\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect a free RentCast key');
	const setupRes = await page.request.get(page.url());
	expect(setupRes.status()).toBe(200);
});
