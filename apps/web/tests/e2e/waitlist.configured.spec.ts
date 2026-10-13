import { test, expect, type Page, type Route } from '@playwright/test';
import { expectAxeClean } from './agent-helpers';
import { siteEnv } from './site-env';

// GTM-02 waitlist on the configured build (test owner key + contact email baked in). Web3Forms is
// mocked with page.route(); nothing reaches the network. Playwright's clock drives the 3-second
// gate (the form reads Date.now()).

const env = siteEnv('configured');
const KEY = '00000000-0000-4000-8000-000000000000';
const EMAIL = 'a@example.com';

const PAGES = [
	{ route: 'for-renters/', portal: 'renter', subject: 'Tran waitlist: Renter' },
	{ route: 'for-investors/', portal: 'investor', subject: 'Tran waitlist: Investor' },
	{ route: 'for-agents/', portal: 'agent', subject: 'Tran waitlist: Agent' }
] as const;

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'content-type, accept',
	'access-control-allow-methods': 'POST'
};

interface Recorded {
	body: unknown;
	headers: Record<string, string>;
}

type Reply = (route: Route) => Promise<void>;

const ok: Reply = (route) =>
	route.fulfill({
		status: 200,
		headers: CORS,
		contentType: 'application/json',
		body: '{"success":true}'
	});

/** Records every POST to the Web3Forms endpoint and answers it with `reply`. */
async function mockSubmit(page: Page, reply: Reply = ok): Promise<Recorded[]> {
	const posts: Recorded[] = [];
	await page.route('https://api.web3forms.com/submit', async (route) => {
		const req = route.request();
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		posts.push({ body: req.postDataJSON(), headers: await req.allHeaders() });
		return reply(route);
	});
	return posts;
}

async function open(page: Page, route: string) {
	await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
	await page.goto(route);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	// Wait for hydration: the prerendered form is inert until onMount runs.
	await expect(page.locator('#waitlist form[data-ready]')).toHaveCount(1);
}

const input = (page: Page) => page.locator('#waitlist').getByLabel('Email', { exact: true });
const button = (page: Page) =>
	page.locator('#waitlist').getByRole('button', { name: 'Join the waitlist' });
const announcer = (page: Page) => page.getByTestId('live-announcer');

test('the configured build carries the test key and contact email', () => {
	expect(env.web3formsKey).toBe(KEY);
	expect(env.contactEmail).toBe('hello@example.com');
});

test('open state: one labelled email field and the join button', async ({ page }) => {
	await open(page, 'for-renters/');
	const section = page.locator('#waitlist');
	await expect(section.locator('input:not([name="botcheck"])')).toHaveCount(1);
	await expect(input(page)).toHaveAttribute('type', 'email');
	await expect(input(page)).toHaveAttribute('autocomplete', 'email');
	await expect(button(page)).toBeVisible();
	await expect(section).not.toContainText("The waitlist isn't open yet");
	// The honeypot is display:none: out of the tab order and the accessibility tree.
	await expect(section.locator('input[name="botcheck"]')).toBeHidden();
});

test('validation: empty and badly shaped addresses', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page, 'for-renters/');
	await page.clock.fastForward(3500);

	await button(page).click();
	await expect(page.locator('#waitlist')).toContainText('Enter your email address.');
	await expect(input(page)).toBeFocused();
	await expect(input(page)).toHaveAttribute('aria-invalid', 'true');

	await input(page).fill('name@example');
	await input(page).blur();
	await expect(page.locator('#waitlist')).toContainText(
		'Enter an email address like name@example.com.'
	);
	expect(posts).toHaveLength(0);
});

test('too fast: a submit under 3 seconds sends nothing', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page, 'for-renters/');
	await input(page).fill(EMAIL);
	await button(page).click();
	await expect(page.locator('#waitlist')).toContainText(
		'That was quicker than expected. Check your email address, then select Join the waitlist again.'
	);
	await expect(input(page)).toHaveValue(EMAIL);
	expect(posts).toHaveLength(0);
});

for (const p of PAGES) {
	test(`happy path on ${p.route}: exactly one request with the exact body`, async ({ page }) => {
		const posts = await mockSubmit(page);
		await open(page, p.route);
		await input(page).fill(EMAIL);
		await page.clock.fastForward(3500);
		await button(page).click();

		const title = page.locator('#waitlist').getByText(`You're on the ${p.portal} waitlist`, {
			exact: true
		});
		await expect(title).toBeFocused();
		await expect(announcer(page)).toHaveText(`You're on the ${p.portal} waitlist.`);
		await expect(page.locator('#waitlist form')).toHaveCount(0);

		expect(posts).toHaveLength(1);
		expect(posts[0]!.body).toStrictEqual({
			access_key: KEY,
			subject: p.subject,
			from_name: 'Tran Real Estate Tools',
			email: EMAIL,
			portal: p.portal,
			botcheck: false
		});
		expect(posts[0]!.headers['content-type']).toBe('application/json');
		expect(posts[0]!.headers['accept']).toBe('application/json');
		// Nothing about the visitor is left in the URL.
		expect(new URL(page.url()).search).toBe('');
	});
}

test('honeypot: a checked trap shows success and sends nothing', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page, 'for-renters/');
	await input(page).fill(EMAIL);
	await page.evaluate(() => {
		const el = document.querySelector('input[name=botcheck]') as HTMLInputElement;
		el.checked = true;
		el.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await page.clock.fastForward(3500);
	await button(page).click();
	await expect(page.locator('#waitlist')).toContainText("You're on the renter waitlist");
	await page.waitForTimeout(300);
	expect(posts).toHaveLength(0);
});

test('network failure keeps the email and offers the contact address', async ({ page }) => {
	const posts = await mockSubmit(page, (route) => route.abort('failed'));
	await open(page, 'for-renters/');
	await input(page).fill(EMAIL);
	await page.clock.fastForward(3500);
	await button(page).click();

	const section = page.locator('#waitlist');
	await expect(section).toContainText("Your email wasn't sent");
	await expect(section).toContainText('Check your connection, then try again. Nothing was saved.');
	await expect(section).toContainText('Or email hello@example.com.');
	await expect(section.locator('a[href^="mailto:hello@example.com"]')).toHaveCount(1);
	await expect(input(page)).toHaveValue(EMAIL);
	await expect(button(page)).toBeFocused();
	await expect(announcer(page)).toHaveText(
		"Your email wasn't sent. Check your connection, then try again. Nothing was saved."
	);
	expect(posts).toHaveLength(1);
});

test('a Web3Forms rejection explains what to do', async ({ page }) => {
	await mockSubmit(page, (route) =>
		route.fulfill({
			status: 400,
			headers: CORS,
			contentType: 'application/json',
			body: '{"success":false,"message":"x"}'
		})
	);
	await open(page, 'for-investors/');
	await input(page).fill(EMAIL);
	await page.clock.fastForward(3500);
	await button(page).click();

	const section = page.locator('#waitlist');
	await expect(section).toContainText("The form service didn't accept this");
	await expect(section).toContainText('Try again in a few minutes.');
	await expect(section).toContainText('Or email hello@example.com.');
	await expect(input(page)).toHaveValue(EMAIL);
});

test.describe('axe on waitlist states', () => {
	test('axe: waitlist open state', async ({ page }) => {
		await open(page, 'for-renters/');
		await page.locator('#waitlist').scrollIntoViewIfNeeded();
		await expectAxeClean(page, 'waitlist open');
	});

	test('axe: waitlist invalid state', async ({ page }) => {
		await open(page, 'for-agents/');
		await page.clock.fastForward(3500);
		await input(page).fill('name@example');
		await button(page).click();
		await expect(page.locator('#waitlist')).toContainText(
			'Enter an email address like name@example.com.'
		);
		await expectAxeClean(page, 'waitlist invalid');
	});

	test('axe: waitlist sending state', async ({ page }) => {
		let release: () => void = () => {};
		const held = new Promise<void>((r) => (release = r));
		await mockSubmit(page, async (route) => {
			await held;
			await ok(route);
		});
		await open(page, 'for-renters/');
		await input(page).fill(EMAIL);
		await page.clock.fastForward(3500);
		await button(page).click();
		const form = page.locator('#waitlist form');
		await expect(form).toHaveAttribute('aria-busy', 'true');
		await expect(form.getByRole('button', { name: 'Joining…' })).toBeDisabled();
		await expect(input(page)).toBeDisabled();
		await expectAxeClean(page, 'waitlist sending');
		release();
		await expect(page.locator('#waitlist')).toContainText("You're on the renter waitlist");
	});

	test('axe: waitlist success state', async ({ page }) => {
		await mockSubmit(page);
		await open(page, 'for-investors/');
		await input(page).fill(EMAIL);
		await page.clock.fastForward(3500);
		await button(page).click();
		await expect(page.locator('#waitlist')).toContainText("You're on the investor waitlist");
		await expectAxeClean(page, 'waitlist success');
	});

	test('axe: waitlist error state', async ({ page }) => {
		await mockSubmit(page, (route) => route.abort('failed'));
		await open(page, 'for-agents/');
		await input(page).fill(EMAIL);
		await page.clock.fastForward(3500);
		await button(page).click();
		await expect(page.locator('#waitlist')).toContainText("Your email wasn't sent");
		await expectAxeClean(page, 'waitlist error');
	});
});
