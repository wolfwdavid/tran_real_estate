import { test, expect, type Page } from '@playwright/test';
import {
	TEST_ACCESS_KEY,
	expectAxeClean,
	expectNoHorizontalScroll,
	inquiryPath,
	mockWeb3Forms,
	rentcastTripwire
} from './agent-helpers';

// The public inquiry page (AGT-02) against a mocked Web3Forms endpoint: request shape and count,
// the honeypot and 3-second gates, failure copy, demo and incomplete links, and axe at 375px.
// Real delivery to an inbox is a HUMAN-UAT item; this suite never reaches the network.

const VALID = {
	v: '1',
	k: TEST_ACCESS_KEY,
	n: 'Sample Agent',
	b: 'Example Realty',
	t: 's',
	st: 'TX',
	lic: 'SAMPLE-0001',
	ph: '(555) 555-0100'
};

const MESSAGE = 'Is the two-bedroom on Sample Lane still available in November?';

/** Load the page and wait for the frame guard and the onMount render. */
async function open(page: Page, params: Record<string, string>, h1: string | RegExp) {
	await page.goto(inquiryPath(params));
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
}

async function fillForm(page: Page) {
	await page.getByLabel('Your name').fill('Jordan Example');
	await page.getByLabel('Email').fill('jordan@example.com');
	await page.getByLabel('Phone (optional)').fill('555-555-0123');
	await page.getByLabel('Message').fill(MESSAGE);
	await page.getByLabel('I agree to be contacted about my inquiry.').check();
}

const send = (page: Page) => page.getByRole('button', { name: 'Send message' }).click();
const successHeading = (page: Page) =>
	page.getByRole('heading', { level: 2, name: 'Message sent' });
const TOO_FAST = "Your message hasn't been sent yet.";

test('valid link shows brokerage first, disclosure, noindex, no app chrome', async ({ page }) => {
	await open(page, VALID, 'Contact Sample Agent');
	const brokerage = page.locator('[data-inquiry-brokerage]');
	await expect(brokerage).toHaveText('Example Realty');
	// DOM order: the brokerage line precedes the h1.
	const brokerageFirst = await page.evaluate(() => {
		const b = document.querySelector('[data-inquiry-brokerage]');
		const h = document.querySelector('h1');
		return !!b && !!h && !!(b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
	});
	expect(brokerageFirst).toBe(true);
	const size = (sel: string) =>
		page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
	expect(await size('[data-inquiry-brokerage]')).toBeGreaterThanOrEqual(await size('h1'));
	await expect(page.locator('[data-inquiry-disclosure]')).toContainText('Lic. #SAMPLE-0001 (TX)');
	await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
	await expect(page.locator('meta[name="referrer"][content="no-referrer"]')).toHaveCount(1);
	await expect(page.locator('nav[aria-label="Portals"]')).toHaveCount(0);
	await expect(page.locator('nav[aria-label="Agent tools"]')).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toContainText("doesn't verify agents");
	await expect(page).toHaveTitle('Contact Sample Agent: inquiry form');
});

test('submits one TRAN-LEAD payload to the mocked endpoint', async ({ page }) => {
	const rentcast = await rentcastTripwire(page);
	const posts = await mockWeb3Forms(page, 'ok');
	await page.clock.install();
	await open(page, { ...VALID, p: '12 Sample Lane' }, 'Contact Sample Agent');
	await expect(page.getByLabel("Property you're asking about (optional)")).toHaveValue(
		'12 Sample Lane'
	);
	await fillForm(page);
	await page.clock.fastForward(3500);
	await send(page);
	await expect(successHeading(page)).toBeFocused();
	expect(posts).toHaveLength(1);
	const body = posts[0]!;
	expect(body.access_key).toBe(TEST_ACCESS_KEY);
	expect(body.email).toBe('jordan@example.com');
	expect(body.subject).toBe('New inquiry for Sample Agent from Jordan Example');
	expect(body.from_name).toBe('Tran inquiry form');
	expect(body.property_of_interest).toBe('12 Sample Lane');
	expect(body.message).toBe(MESSAGE);
	expect(body.tran_lead_v1).toMatch(/^TRAN-LEAD v1[\s\S]*END TRAN-LEAD$/);
	expect(body.tran_lead_v1).toContain('email: jordan@example.com');
	expect(body).not.toHaveProperty('botcheck');
	await expect(page.locator('[data-inquiry-success]')).toContainText(
		'Sample Agent will get your message by email.'
	);
	expect(rentcast).toEqual([]);

	// Send another message restores an empty form and keeps the prefilled property.
	await page.getByRole('button', { name: 'Send another message' }).click();
	await expect(page.getByLabel('Your name')).toHaveValue('');
	await expect(page.getByLabel("Property you're asking about (optional)")).toHaveValue(
		'12 Sample Lane'
	);
});

test('honeypot sends nothing but shows success', async ({ page }) => {
	const posts = await mockWeb3Forms(page, 'ok');
	await page.clock.install();
	await open(page, VALID, 'Contact Sample Agent');
	await fillForm(page);
	await page.clock.fastForward(3500);
	// The trap is off-screen and out of the tab order, so a bot (not a person) ticks it.
	await page.locator('input[name="botcheck"]').evaluate((el) => (el as HTMLInputElement).click());
	await expect(page.locator('input[name="botcheck"]')).toBeChecked();
	await send(page);
	await expect(successHeading(page)).toBeVisible();
	expect(posts).toHaveLength(0);
});

test('too fast sends nothing, then a resend after 3 s goes through', async ({ page }) => {
	const posts = await mockWeb3Forms(page, 'ok');
	await page.clock.install();
	await open(page, VALID, 'Contact Sample Agent');
	await fillForm(page);
	await send(page);
	await expect(page.locator('[data-inquiry-too-fast]')).toContainText(TOO_FAST);
	expect(posts).toHaveLength(0);
	await page.clock.fastForward(3500);
	await send(page);
	await expect(successHeading(page)).toBeVisible();
	expect(posts).toHaveLength(1);
});

for (const [mode, title] of [
	['rejected', "This form can't send messages right now"],
	['captcha', "This form can't send messages right now"],
	['network', "Your message wasn't sent"]
] as const) {
	test(`${mode} failure keeps the typed message`, async ({ page }) => {
		const posts = await mockWeb3Forms(page, mode);
		await page.clock.install();
		await open(page, VALID, 'Contact Sample Agent');
		await fillForm(page);
		await page.clock.fastForward(3500);
		await send(page);
		await expect(page.locator('[data-inquiry-failure]')).toContainText(title);
		await expect(page.getByLabel('Message')).toHaveValue(MESSAGE);
		await expect(page.getByRole('button', { name: 'Send message' })).toBeFocused();
		expect(posts).toHaveLength(1);
	});
}

test('validation errors move focus to the first invalid field', async ({ page }) => {
	const posts = await mockWeb3Forms(page, 'ok');
	await open(page, VALID, 'Contact Sample Agent');
	await send(page);
	await expect(page.getByLabel('Your name')).toBeFocused();
	await expect(page.getByText('Add your name.')).toBeVisible();
	await expect(page.getByText('Add your email address so Sample Agent can reply.')).toBeVisible();
	await expect(page.getByLabel('Your name')).toHaveAttribute('aria-invalid', 'true');
	expect(posts).toHaveLength(0);
});

test('demo page sends nothing', async ({ page }) => {
	const posts = await mockWeb3Forms(page, 'ok');
	await page.clock.install();
	await open(page, { demo: '1' }, 'Contact Avery Sample');
	await expect(page.locator('[data-inquiry-brokerage]')).toHaveText('Sample Realty');
	await expect(page.getByText('Sample data')).toBeVisible();
	await expect(
		page.getByText("This is a sample page. Messages aren't sent anywhere.")
	).toBeVisible();
	await fillForm(page);
	await page.clock.fastForward(3500);
	await send(page);
	await expect(successHeading(page)).toBeFocused();
	await expect(page.locator('[data-inquiry-success]')).toContainText(
		'Sample page: nothing was sent.'
	);
	expect(posts).toHaveLength(0);
});

test('incomplete and newer-version links show no form', async ({ page }) => {
	const { b: _b, ...noBrokerage } = VALID;
	void _b;
	await open(page, noBrokerage, "This inquiry link isn't complete");
	await expect(page.locator('form')).toHaveCount(0);
	await expect(page.getByText('The link is missing some details')).toBeVisible();
	await open(page, { ...VALID, v: '2' }, "This inquiry link isn't complete");
	await expect(page.locator('form')).toHaveCount(0);
	await expect(page.getByText('made by a newer version')).toBeVisible();
});

test('hostile params render as text', async ({ page }) => {
	const hostile = '<img src=x onerror=alert(1)>';
	await open(page, { ...VALID, n: hostile }, `Contact ${hostile}`);
	await expect(page.locator('main img')).toHaveCount(0);
});

test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	async function check(page: Page, label: string) {
		await expectAxeClean(page, label);
		await expectNoHorizontalScroll(page);
	}

	test('axe clean at 375px in every state', async ({ page }) => {
		await mockWeb3Forms(page, 'rejected');
		await page.clock.install();

		await open(page, VALID, 'Contact Sample Agent');
		await check(page, 'valid');

		await fillForm(page);
		await send(page);
		await expect(page.locator('[data-inquiry-too-fast]')).toBeVisible();
		await check(page, 'too-fast');

		await page.clock.fastForward(3500);
		await send(page);
		await expect(page.locator('[data-inquiry-failure]')).toBeVisible();
		await check(page, 'refused failure');

		await open(page, { demo: '1' }, 'Contact Avery Sample');
		await check(page, 'demo');
		await fillForm(page);
		await page.clock.fastForward(3500);
		await send(page);
		await expect(successHeading(page)).toBeVisible();
		await check(page, 'success');

		await open(page, { v: '1', n: 'Sample Agent' }, "This inquiry link isn't complete");
		await check(page, 'incomplete');
	});
});
