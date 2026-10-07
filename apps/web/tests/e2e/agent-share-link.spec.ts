import { test, expect, type Page } from '@playwright/test';
import {
	TEST_ACCESS_KEY,
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	mockWeb3Forms,
	rentcastTripwire
} from './agent-helpers';

// The share-link builder on /agent/profile/ (AGT-02, plan 08-24): key validation, the blocked
// states, which params the link carries, the clipboard copy, and the round trip from the built link
// to the public inquiry page and a mocked Web3Forms delivery. Real delivery stays a HUMAN-UAT item.

/** Every query param the link may carry (inquiry-params); anything else is a leak. */
const PUBLIC_PARAMS = ['v', 'k', 'n', 'b', 'tm', 't', 'st', 'lic', 'ph', 'p'];

const section = (page: Page) => page.locator('#inquiry-page');
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const keyField = (page: Page) => section(page).getByLabel('Web3Forms access key', { exact: true });
const saveKey = (page: Page) => section(page).getByRole('button', { name: 'Save key' }).click();
const linkField = (page: Page) => section(page).getByLabel('Your link', { exact: true });
const keyStatus = (page: Page) => section(page).locator('[data-key-status]');
const copyStatus = (page: Page) => section(page).locator('[data-copy-status]');

const BLOCKERS = [
	'Add your full name in Your details to build your link.',
	'Add your brokerage in Your details to build your link.',
	'Add your Web3Forms access key to build your link.'
];
const KEY_ERROR = "That doesn't look like a Web3Forms access key.";

/** Loads the profile page and waits for hydration (the first interaction must not be lost). */
async function open(page: Page) {
	await page.goto('agent/profile/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your profile');
	await expect(section(page).getByRole('heading', { level: 2 })).toHaveText('Your inquiry page');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready);
}

/** Fills and saves a full TX profile, including the fields that must never reach the link. */
async function saveFullProfile(page: Page) {
	await field(page, 'Full name').fill('Sample Agent');
	await field(page, 'Brokerage').fill('Example Realty');
	await field(page, 'Team name (optional)').fill('The Sample Team');
	await field(page, 'License type').selectOption('salesperson');
	await field(page, 'License number').fill('SAMPLE-0001');
	await field(page, 'License state').selectOption('TX');
	await field(page, 'Brokerage phone').fill('(555) 555-0100');
	await field(page, 'Phone').fill('(555) 555-0199');
	await field(page, 'Email').fill('sample.agent@example.com');
	await field(page, 'Street address').fill('12 Sample Lane');
	await field(page, 'Address line 2 (optional)').fill('Suite 4');
	await field(page, 'City').fill('Austin');
	await field(page, 'State').selectOption('TX');
	await field(page, 'ZIP code').fill('78701');
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByTestId('profile-status')).toHaveText('Saved.');
}

async function saveTestKey(page: Page) {
	await keyField(page).fill(TEST_ACCESS_KEY);
	await saveKey(page);
	await expect(keyStatus(page)).toHaveText('Access key saved.');
	await expect(announcer(page)).toHaveText('Access key saved.');
}

/** From an empty browser to a ready link with a property. Returns the link. */
async function makeReady(page: Page): Promise<string> {
	await saveFullProfile(page);
	await saveTestKey(page);
	await field(page, 'Property (optional)').fill('12 Sample Lane');
	await expect(linkField(page)).toHaveValue(/[?&]p=12\+Sample\+Lane/);
	return linkField(page).inputValue();
}

test('blocked until name, brokerage and key exist', async ({ page }) => {
	const rentcast = await rentcastTripwire(page);
	await open(page);
	for (const line of BLOCKERS) await expect(section(page).getByText(line)).toBeVisible();
	await expect(linkField(page)).toHaveCount(0);
	await expect(section(page).getByRole('link', { name: 'Open your inquiry page' })).toHaveCount(0);
	const preview = section(page).getByRole('link', { name: 'Preview the page with sample details' });
	await expect(preview).toHaveAttribute('href', /agent\/inquire\/\?demo=1$/);

	// Honest setup copy, present before anything is saved.
	await expect(section(page).getByText('Web3Forms keys are meant to be public.')).toBeVisible();
	await expect(section(page).getByText('Leave captcha off in Web3Forms.')).toBeVisible();
	await expect(section(page).getByText(/If you start getting spam/)).toBeVisible();
	await expect(section(page).getByText(/free plan has a monthly limit/)).toBeVisible();
	const external = section(page).getByRole('link', { name: /Get a free Web3Forms key/ });
	await expect(external).toHaveAttribute('href', 'https://web3forms.com');
	await expect(external).not.toHaveAttribute('target');
	await expect(section(page).getByRole('link', { name: 'Import leads' })).toHaveAttribute(
		'href',
		/agent\/import\/#paste$/
	);

	// Saving the key alone resolves one blocker and leaves the other two.
	await saveTestKey(page);
	await expect(section(page).getByText(BLOCKERS[0]!)).toBeVisible();
	await expect(section(page).getByText(BLOCKERS[1]!)).toBeVisible();
	await expect(section(page).getByText(BLOCKERS[2]!)).toHaveCount(0);
	await expect(linkField(page)).toHaveCount(0);

	// The sample-details preview opens the demo page, which sends nothing.
	await preview.click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact Avery Sample');
	await expect(
		page.getByText("This is a sample page. Messages aren't sent anywhere.")
	).toBeVisible();
	expect(rentcast).toEqual([]);
});

test('invalid key is refused', async ({ page }) => {
	await open(page);
	await keyField(page).fill('not-a-key');
	await saveKey(page);
	await expect(section(page).getByText(KEY_ERROR)).toBeVisible();
	await expect(section(page).getByText(/36 characters with dashes/)).toBeVisible();
	await expect(keyField(page)).toBeFocused();
	await expect(keyField(page)).toHaveAttribute('aria-invalid', 'true');
	await expect(keyStatus(page)).toHaveCount(0);
	await expect(section(page).getByText(BLOCKERS[2]!)).toBeVisible();

	// A key with 36 characters but the wrong shape is refused too; the real one clears the error.
	await keyField(page).fill('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz');
	await saveKey(page);
	await expect(section(page).getByText(KEY_ERROR)).toBeVisible();
	await keyField(page).fill(TEST_ACCESS_KEY.toUpperCase());
	await saveKey(page);
	await expect(keyStatus(page)).toHaveText('Access key saved.');
	await expect(section(page).getByText(KEY_ERROR)).toHaveCount(0);
	await expect(keyField(page)).not.toHaveAttribute('aria-invalid', 'true');
	// Stored lowercased; the field adopts the stored copy after a reload.
	await page.reload();
	await open(page);
	await expect(keyField(page)).toHaveValue(TEST_ACCESS_KEY);
	await expect(section(page).getByText(BLOCKERS[2]!)).toHaveCount(0);
});

test('link carries only public fields and round-trips to the public page', async ({
	page,
	baseURL
}) => {
	const rentcast = await rentcastTripwire(page);
	const posts = await mockWeb3Forms(page, 'ok');
	await page.clock.install();
	await open(page);
	const link = await makeReady(page);

	const url = new URL(link);
	expect(url.origin).toBe(new URL(baseURL!).origin);
	expect(url.pathname).toBe(
		test.info().project.name === 'sub' ? '/tran_real_estate/agent/inquire/' : '/agent/inquire/'
	);
	expect(url.hash).toBe('');

	const names = [...url.searchParams.keys()];
	for (const n of names) expect(PUBLIC_PARAMS, `unexpected param ${n}`).toContain(n);
	expect(names).toEqual(PUBLIC_PARAMS);
	expect(url.searchParams.get('v')).toBe('1');
	expect(url.searchParams.get('k')).toBe(TEST_ACCESS_KEY);
	expect(url.searchParams.get('n')).toBe('Sample Agent');
	expect(url.searchParams.get('b')).toBe('Example Realty');
	expect(url.searchParams.get('tm')).toBe('The Sample Team');
	expect(url.searchParams.get('t')).toBe('s');
	expect(url.searchParams.get('st')).toBe('TX');
	expect(url.searchParams.get('lic')).toBe('SAMPLE-0001');
	expect(url.searchParams.get('ph')).toBe('(555) 555-0100');
	expect(url.searchParams.get('p')).toBe('12 Sample Lane');

	const decoded = decodeURIComponent(link.replace(/\+/g, ' '));
	for (const secret of ['sample.agent@example.com', '0199', 'Suite 4', 'Austin', '78701']) {
		expect(decoded, `link must not contain ${secret}`).not.toContain(secret);
	}
	// The property is the only street-like value, there because the agent asked for it.
	expect(decoded.split('12 Sample Lane')).toHaveLength(2);

	// Saving the form again after the key was saved must not wipe the key (the form has no key
	// field, so its draft takes the stored key).
	await field(page, 'Website (optional)').fill('https://sample-agent.example.com');
	await expect(page.getByTestId('profile-status')).toHaveText('You have unsaved changes.');
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByTestId('profile-status')).toHaveText('Saved.');
	await expect(keyField(page)).toHaveValue(TEST_ACCESS_KEY);
	await expect(linkField(page)).toHaveValue(link);
	expect(await linkField(page).inputValue()).not.toContain('sample-agent.example.com');

	// Open the page the link points at.
	const openLink = section(page).getByRole('link', { name: 'Open your inquiry page' });
	await expect(openLink).toHaveAttribute('href', link);
	await openLink.click();
	await expect(page).toHaveURL(link);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact Sample Agent');
	await expect(page.locator('[data-inquiry-brokerage]')).toHaveText(
		'The Sample Team at Example Realty'
	);
	await expect(page.locator('[data-inquiry-disclosure]')).toContainText('Lic. #SAMPLE-0001 (TX)');
	await expect(page.locator('[data-inquiry-disclosure]')).toContainText('(555) 555-0100');
	await expect(page.getByLabel("Property you're asking about (optional)")).toHaveValue(
		'12 Sample Lane'
	);
	await expect(page.getByText('Sample data')).toHaveCount(0);

	// A visitor sends a message: it posts with the agent's key.
	await page.getByLabel('Your name').fill('Jordan Example');
	await page.getByLabel('Email').fill('jordan@example.com');
	await page
		.getByLabel('Message')
		.fill('Is the two-bedroom on Sample Lane still open in November?');
	await page.getByLabel('I agree to be contacted about my inquiry.').check();
	await page.clock.fastForward(3500);
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('heading', { level: 2, name: 'Message sent' })).toBeVisible();
	expect(posts).toHaveLength(1);
	expect(posts[0]!.access_key).toBe(TEST_ACCESS_KEY);
	expect(posts[0]!.subject).toBe('New inquiry for Sample Agent from Jordan Example');
	expect(posts[0]!.property_of_interest).toBe('12 Sample Lane');
	expect(rentcast).toEqual([]);
});

test('copy link', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'clipboard permissions can only be granted in Chromium');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await open(page);
	const link = await makeReady(page);

	await section(page).getByRole('button', { name: 'Copy link' }).click();
	await expect(copyStatus(page)).toHaveText('Link copied.');
	await expect(announcer(page)).toHaveText('Link copied.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

	// Changing the property changes the link and clears the stale status.
	await field(page, 'Property (optional)').fill('');
	await expect(linkField(page)).not.toHaveValue(/[?&]p=/);
	await expect(copyStatus(page)).toHaveCount(0);
	await section(page).getByRole('button', { name: 'Copy link' }).click();
	await expect(copyStatus(page)).toHaveText('Link copied.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).not.toContain('p=');
});

// Axe over the long profile page is slow on a single core, so each state gets its own test.
test('axe clean and no horizontal scroll while blocked, at 1280 and 375', async ({ page }) => {
	test.slow();
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page);
	await expectAxeClean(page, 'agent/profile/ blocked at 1280');
	await expectNoHorizontalScroll(page);

	await keyField(page).fill('not-a-key');
	await saveKey(page);
	await expect(section(page).getByText(KEY_ERROR)).toBeVisible();
	await expectAxeClean(page, 'agent/profile/ with a key error at 1280');

	await page.setViewportSize({ width: 375, height: 812 });
	await expect(section(page).getByText(BLOCKERS[0]!)).toBeVisible();
	await expectAxeClean(page, 'agent/profile/ blocked at 375');
	await expectNoHorizontalScroll(page);
});

test('axe clean and no horizontal scroll with a ready link, at 1280 and 375', async ({ page }) => {
	test.slow();
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page);
	await makeReady(page);
	await expectAxeClean(page, 'agent/profile/ ready at 1280');
	await expectNoHorizontalScroll(page);

	await page.setViewportSize({ width: 375, height: 812 });
	await expect(linkField(page)).toBeVisible();
	await expectAxeClean(page, 'agent/profile/ ready at 375');
	await expectNoHorizontalScroll(page);
	// The long URL scrolls inside its field rather than widening the page.
	const fits = await linkField(page).evaluate(
		(el) => el.scrollWidth > el.clientWidth && el.getBoundingClientRect().right <= innerWidth
	);
	expect(fits).toBe(true);
});
