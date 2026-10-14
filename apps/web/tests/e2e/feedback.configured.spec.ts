import { test, expect, type Page, type Route } from '@playwright/test';
import { expectAxeClean } from './agent-helpers';
import { siteEnv } from './site-env';

// GTM-02 feedback form (10-18) on the configured build (test owner key + contact email baked in).
// Web3Forms is mocked with page.route(); nothing reaches the network. Playwright's clock drives the
// 3-second gate (the form reads Date.now()). Key-shaped strings are built at runtime, never written
// out as literals.

const env = siteEnv('configured');
const KEY = '00000000-0000-4000-8000-000000000000';

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'content-type, accept',
	'access-control-allow-methods': 'POST'
};

type Reply = (route: Route) => Promise<void>;

const ok: Reply = (route) =>
	route.fulfill({
		status: 200,
		headers: CORS,
		contentType: 'application/json',
		body: '{"success":true}'
	});

/** Records every POST body to the Web3Forms endpoint and answers it with `reply`. */
async function mockSubmit(page: Page, reply: Reply = ok): Promise<unknown[]> {
	const posts: unknown[] = [];
	await page.route('https://api.web3forms.com/submit', async (route) => {
		const req = route.request();
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		posts.push(req.postDataJSON());
		return reply(route);
	});
	return posts;
}

async function open(page: Page, query = '') {
	await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
	await page.goto(`feedback/${query}`);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	// Wait for hydration: the prerendered form is inert until onMount runs.
	await expect(page.locator('main form[data-ready]')).toHaveCount(1);
}

const main = (page: Page) => page.getByRole('main');
const topics = (page: Page) => page.getByRole('radiogroup');
const message = (page: Page) => page.getByLabel('Your feedback', { exact: true });
const email = (page: Page) => page.getByLabel('Email (optional)', { exact: true });
const button = (page: Page) => main(page).getByRole('button', { name: 'Send feedback' });
const counter = (page: Page) => page.locator('#feedback-message-counter');
const announcer = (page: Page) => page.getByTestId('live-announcer');

/** Runtime-built key-shaped text: matches the Anthropic key shape the backup scanner knows. */
const keyShaped = () => 'sk-ant-api03-' + 'A'.repeat(40);

async function send(page: Page) {
	await page.clock.fastForward(3500);
	await button(page).click();
}

test('the configured build carries the test key and contact email', () => {
	expect(env.web3formsKey).toBe(KEY);
	expect(env.contactEmail).toBe('hello@example.com');
});

test('open state: topic radios, message with counter, optional email', async ({ page }) => {
	await open(page);
	await expect(main(page)).not.toContainText("The feedback form isn't open yet");
	await expect(
		page.getByRole('group', { name: 'Which part of Tran is this about?' })
	).toBeVisible();
	await expect(topics(page).getByRole('radio')).toHaveCount(5);
	for (const name of [
		'Renter portal',
		'Investor portal',
		'Agent portal',
		'Free calculators',
		'Something else'
	]) {
		await expect(page.getByRole('radio', { name, exact: true })).toBeVisible();
	}
	// No ?portal=: Something else.
	await expect(page.getByRole('radio', { name: 'Something else', exact: true })).toBeChecked();
	await expect(message(page)).toHaveAttribute('maxlength', '2000');
	await expect(message(page)).toHaveAttribute('required', '');
	await expect(counter(page)).toHaveText('0 of 2,000 characters');
	await expect(counter(page)).toHaveAttribute('aria-live', 'off');
	await expect(email(page)).toHaveAttribute('type', 'email');
	// Personal fields carry no name, so a pre-hydration submit can't leak them into the URL.
	await expect(message(page)).not.toHaveAttribute('name');
	await expect(email(page)).not.toHaveAttribute('name');
	await expect(main(page).locator('input[name="botcheck"]')).toBeHidden();
});

test('?portal=investor pre-selects Investor portal; ?portal=tools pre-selects Free calculators', async ({
	page
}) => {
	await open(page, '?portal=investor');
	await expect(page.getByRole('radio', { name: 'Investor portal', exact: true })).toBeChecked();
	await page.goto('feedback/?portal=tools');
	await expect(page.locator('main form[data-ready]')).toHaveCount(1);
	await expect(page.getByRole('radio', { name: 'Free calculators', exact: true })).toBeChecked();
});

test('counter: switches to "100 characters left" and announces the crossing once', async ({
	page
}) => {
	await open(page);
	await page.evaluate(() => {
		const region = document.querySelector('[data-testid="live-announcer"]')!;
		const seen: string[] = [];
		(window as unknown as { __announced: string[] }).__announced = seen;
		new MutationObserver(() => {
			const t = region.textContent?.trim() ?? '';
			if (t !== '') seen.push(t);
		}).observe(region, { childList: true, subtree: true, characterData: true });
	});

	await message(page).fill('a'.repeat(1899));
	await expect(counter(page)).toHaveText('1,899 of 2,000 characters');
	await message(page).press('End');
	await message(page).pressSequentially('b');
	await expect(counter(page)).toHaveText('100 characters left');
	await expect(announcer(page)).toHaveText('100 characters left.');
	await message(page).pressSequentially('cc');
	await expect(counter(page)).toHaveText('98 characters left');
	await page.clock.runFor(500);

	const announced = await page.evaluate(
		() => (window as unknown as { __announced: string[] }).__announced
	);
	expect(announced.filter((t) => t === '100 characters left.')).toHaveLength(1);
});

test('validation: empty message, bad email; nothing is sent', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page);
	await send(page);
	await expect(main(page)).toContainText('Write a few words before sending.');
	await expect(message(page)).toBeFocused();
	await expect(message(page)).toHaveAttribute('aria-invalid', 'true');

	await message(page).fill('Works well');
	await email(page).fill('name@example');
	await button(page).click();
	await expect(main(page)).toContainText(
		'Enter an email address like name@example.com, or leave it blank.'
	);
	await expect(email(page)).toBeFocused();
	expect(posts).toHaveLength(0);
});

test('key scan: an API key in the message blocks the send with a field error', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page);
	await message(page).fill(`My key is ${keyShaped()} please help`);
	await send(page);
	await expect(main(page)).toContainText(
		'This looks like it contains an API key. Remove it, then send again.'
	);
	await expect(message(page)).toBeFocused();
	await expect(message(page)).toHaveAttribute('aria-invalid', 'true');
	await page.clock.runFor(500);
	expect(posts).toHaveLength(0);
});

test('key scan: a key pasted into the email field is blocked too', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page);
	await message(page).fill('Works well');
	await email(page).fill(`${keyShaped()}@example.com`);
	await send(page);
	await expect(main(page)).toContainText('This looks like it contains an API key');
	await page.clock.runFor(500);
	expect(posts).toHaveLength(0);
});

test('happy path: exactly one request with the exact body, then Send more feedback', async ({
	page
}) => {
	const posts = await mockSubmit(page);
	await open(page, '?portal=investor');
	await message(page).fill('Works well');
	await send(page);

	const title = main(page).getByText('Thanks. Your feedback was sent.', { exact: true });
	await expect(title).toBeFocused();
	await expect(announcer(page)).toHaveText('Thanks. Your feedback was sent.');
	await expect(main(page)).toContainText('If you left an email, we may write back.');
	await expect(main(page).locator('form')).toHaveCount(0);
	await expect(
		main(page).getByRole('link', { name: 'Back to the home page', exact: true })
	).toHaveAttribute('href', /\/$/);

	expect(posts).toHaveLength(1);
	expect(posts[0]).toStrictEqual({
		access_key: KEY,
		subject: 'Tran feedback: Investor portal',
		from_name: 'Tran Real Estate Tools',
		topic: 'investor',
		message: 'Works well',
		botcheck: false
	});
	expect(new URL(page.url()).search).toBe('?portal=investor');

	await main(page).getByRole('button', { name: 'Send more feedback' }).click();
	await expect(message(page)).toHaveValue('');
	await expect(email(page)).toHaveValue('');
	await expect(counter(page)).toHaveText('0 of 2,000 characters');
	await expect(page.getByRole('radio', { name: 'Investor portal', exact: true })).toBeFocused();
});

test('with an email filled in, the body carries it', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page);
	await page.getByRole('radio', { name: 'Agent portal', exact: true }).click();
	await message(page).fill('Please add a calendar export.');
	await email(page).fill('  reply@example.com ');
	await send(page);
	await expect(main(page)).toContainText('Thanks. Your feedback was sent.');
	expect(posts).toHaveLength(1);
	expect(posts[0]).toStrictEqual({
		access_key: KEY,
		subject: 'Tran feedback: Agent portal',
		from_name: 'Tran Real Estate Tools',
		topic: 'agent',
		message: 'Please add a calendar export.',
		email: 'reply@example.com',
		botcheck: false
	});
});

test('honeypot: a checked trap shows success and sends nothing', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page);
	await message(page).fill('Works well');
	await page.evaluate(() => {
		const el = document.querySelector('input[name=botcheck]') as HTMLInputElement;
		el.checked = true;
		el.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await send(page);
	await expect(main(page)).toContainText('Thanks. Your feedback was sent.');
	await page.clock.runFor(500);
	expect(posts).toHaveLength(0);
});

test('too fast: a submit under 3 seconds sends nothing', async ({ page }) => {
	const posts = await mockSubmit(page);
	await open(page);
	await message(page).fill('Works well');
	await button(page).click();
	await expect(main(page)).toContainText(
		'That was quicker than expected. Check your message, then select Send feedback again.'
	);
	await expect(message(page)).toHaveValue('Works well');
	await page.clock.runFor(500);
	expect(posts).toHaveLength(0);
});

test("network failure: Your message wasn't sent, with the contact address", async ({ page }) => {
	const posts = await mockSubmit(page, (route) => route.abort('failed'));
	await open(page);
	await message(page).fill('Works well');
	await send(page);
	await expect(main(page)).toContainText("Your message wasn't sent");
	await expect(main(page)).toContainText(
		'Check your connection, then try again. Nothing was saved.'
	);
	await expect(main(page)).toContainText('Or email hello@example.com.');
	await expect(main(page).locator('a[href^="mailto:hello@example.com"]')).toHaveCount(1);
	await expect(message(page)).toHaveValue('Works well');
	await expect(button(page)).toBeFocused();
	expect(posts).toHaveLength(1);
});

test.describe('axe on feedback states', () => {
	test('axe: feedback open state', async ({ page }) => {
		await open(page);
		await expectAxeClean(page, 'feedback open');
	});

	test('axe: feedback invalid state', async ({ page }) => {
		await open(page);
		await message(page).fill('Works well');
		await email(page).fill('name@example');
		await send(page);
		await expect(main(page)).toContainText(
			'Enter an email address like name@example.com, or leave it blank.'
		);
		await expectAxeClean(page, 'feedback invalid');
	});

	test('axe: feedback sending state', async ({ page }) => {
		let release: () => void = () => {};
		const held = new Promise<void>((r) => (release = r));
		await mockSubmit(page, async (route) => {
			await held;
			await ok(route);
		});
		await open(page);
		await message(page).fill('Works well');
		await send(page);
		const form = main(page).locator('form');
		await expect(form).toHaveAttribute('aria-busy', 'true');
		await expect(form.getByRole('button', { name: 'Sending…' })).toBeDisabled();
		await expect(message(page)).toBeDisabled();
		await expectAxeClean(page, 'feedback sending');
		release();
		await expect(main(page)).toContainText('Thanks. Your feedback was sent.');
	});

	test('axe: feedback success state', async ({ page }) => {
		await mockSubmit(page);
		await open(page);
		await message(page).fill('Works well');
		await send(page);
		await expect(main(page)).toContainText('Thanks. Your feedback was sent.');
		await expectAxeClean(page, 'feedback success');
	});

	test('axe: feedback error state', async ({ page }) => {
		await mockSubmit(page, (route) => route.abort('failed'));
		await open(page);
		await message(page).fill('Works well');
		await send(page);
		await expect(main(page)).toContainText("Your message wasn't sent");
		await expectAxeClean(page, 'feedback error');
	});
});
