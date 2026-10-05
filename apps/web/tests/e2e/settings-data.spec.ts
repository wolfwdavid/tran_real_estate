import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
	FAKE_RENTCAST_KEY,
	blockRentCast,
	mockRentCast,
	openSettingsPage,
	saveCap,
	saveRentCastKey,
	seedLedger,
	type RentCastAnswer
} from './helpers/data';

// Settings "RentCast usage" section and the RentCast "Test key" (04-23) on the real built site,
// both bases (DATA-02, DATA-03, DATA-05; 04-UI-SPEC "RentCast usage section", "KeyTestResult",
// "CallMeter", "CapAboveLimitDialog"). RentCast is never reached: blockRentCast aborts every
// request, and the Test key tests answer from mockRentCast and count requests.

test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

const usage = (page: Page) => page.locator('#rentcast-usage');
const rentcastCard = (page: Page) => page.locator('#key-rentcast');

/** Raises the cap past 50 through CapAboveLimitDialog (typed "overage"). */
async function saveOverageCap(page: Page, cap: number): Promise<void> {
	await usage(page).getByLabel('Monthly call cap', { exact: true }).fill(String(cap));
	await usage(page).getByRole('button', { name: 'Save cap', exact: true }).click();
	const dialog = page.getByRole('alertdialog');
	await dialog.getByLabel('Type overage to confirm', { exact: true }).fill('overage');
	await dialog.getByRole('button', { name: `Set cap to ${cap}`, exact: true }).click();
	await expect(dialog).toBeHidden();
	await expect(usage(page).getByText(`Cap saved: ${cap} calls a month.`)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
	await blockRentCast(page);
});

test('keyless: RentCast usage is section 2 with the no-key line, axe clean', async ({ page }) => {
	await openSettingsPage(page);
	await expect(page.getByRole('heading', { level: 2, name: 'RentCast usage' })).toBeVisible();
	const second = page.locator('nav[aria-label="Settings sections"] a').nth(1);
	await expect(second).toHaveText('RentCast usage');
	await expect(second).toHaveAttribute('href', /#rentcast-usage$/);
	await expect(
		usage(page).getByText('Using sample data because no RentCast key is available.')
	).toBeVisible();
	await expect(usage(page).getByRole('link', { name: 'Add a RentCast key' })).toBeVisible();
	await expect(usage(page).getByRole('radio')).toHaveCount(0);
	await expectAxeClean(page, 'settings/ (keyless)');
});

// Every Test key outcome: one request to the zero-cost probe, the key only in the header.
const KEY_TESTS: { name: string; answer: RentCastAnswer; line: string }[] = [
	{
		name: '404',
		answer: { status: 404 },
		line: "RentCast accepted this key. The test didn't use a call."
	},
	{
		name: '200',
		answer: { status: 200, body: {} },
		line: 'RentCast accepted this key. The test returned data, so it counted as 1 call.'
	},
	{
		name: '401',
		answer: { status: 401 },
		line: "RentCast didn't accept this key. Check that you copied all of it, or create a new key."
	},
	{
		name: '403',
		answer: { status: 403 },
		line: 'RentCast recognized this key but refused the test request.'
	},
	{
		name: '429',
		answer: { status: 429 },
		line: 'RentCast is limiting requests right now. Wait a minute, then try again.'
	},
	{ name: 'network failure', answer: 'abort', line: "Couldn't check this key, because" }
];

for (const { name, answer, line } of KEY_TESTS) {
	test(`Test key (0 calls), RentCast answers ${name}: result line, one probe request, axe clean`, async ({
		page
	}) => {
		const calls = await mockRentCast(page, () => answer);
		await saveRentCastKey(page);
		const card = rentcastCard(page);
		const button = card.getByRole('button', { name: 'Test key (0 calls)' });
		await expect(button).toBeVisible();
		await expect(card).toContainText('Usage, cap, and data source are in RentCast usage.');

		await button.click();
		await expect(card.getByText(line)).toBeVisible();
		await expect(card.getByText('Tested just now')).toBeVisible();
		await expect(button).toBeFocused();

		expect(calls).toHaveLength(1);
		const [{ url, headers }] = calls;
		expect(url.origin).toBe('https://api.rentcast.io');
		expect(url.pathname).toBe('/v1/markets');
		expect(url.searchParams.get('zipCode')).toBe('00000');
		expect(url.searchParams.get('suppressLogging')).toBe('true');
		expect(headers['x-api-key']).toBe(FAKE_RENTCAST_KEY);
		expect(url.href).not.toContain(FAKE_RENTCAST_KEY);

		if (name === '200') {
			// The billed edge case is counted at once.
			await expect(usage(page).getByText('1 of 50 calls used this month')).toBeVisible();
		}
		await expectAxeClean(page, `settings/ (Test key ${name})`);
	});
}

const METER_STATES: {
	state: string;
	cap: number;
	used: number;
	expected: string[];
}[] = [
	{
		state: 'OK',
		cap: 40,
		used: 12,
		expected: ['12 of 50 calls used this month', 'Cap: 40 · 28 left before your cap']
	},
	{ state: 'Near', cap: 40, used: 36, expected: ['4 calls left before your cap.'] },
	{
		state: 'At',
		cap: 40,
		used: 40,
		expected: ["You've reached your cap. Tran asks before each extra call."]
	},
	{
		state: 'Past',
		cap: 60,
		used: 52,
		expected: [
			'52 of 50 calls used this month',
			"You're past the 50 calls in RentCast's free plan."
		]
	}
];

for (const { state, cap, used, expected } of METER_STATES) {
	test(`meter ${state}: cap ${cap}, ${used} used, axe clean`, async ({ page }) => {
		await saveRentCastKey(page);
		if (cap > 50) await saveOverageCap(page, cap);
		else await saveCap(page, cap);
		await seedLedger(page, used);
		await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
		for (const text of expected) await expect(usage(page)).toContainText(text);
		await expectAxeClean(page, `settings/ (meter ${state})`);
	});
}

test('CapAboveLimitDialog: focus on Keep, typed confirmation, then the cap saves', async ({
	page
}) => {
	await saveRentCastKey(page);
	const input = usage(page).getByLabel('Monthly call cap', { exact: true });
	await input.fill('60');
	await usage(page).getByRole('button', { name: 'Save cap', exact: true }).click();

	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole('heading', { name: "Allow calls past RentCast's free 50?" })
	).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Keep cap at 40', exact: true })).toBeFocused();
	await expectAxeClean(page, 'settings/ (CapAboveLimitDialog)');

	const typed = dialog.getByLabel('Type overage to confirm', { exact: true });
	const confirm = dialog.getByRole('button', { name: 'Set cap to 60', exact: true });
	await typed.fill('overag');
	await confirm.click();
	await expect(
		dialog.getByText('Type the word overage to confirm, or choose Keep cap at 40.')
	).toBeVisible();
	await expect(dialog).toBeVisible();

	await typed.fill('Overage');
	await confirm.click();
	await expect(dialog).toBeHidden();
	await expect(usage(page).getByText('Cap saved: 60 calls a month.')).toBeVisible();
	await expect(usage(page)).toContainText('Cap: 60 · 60 left before your cap');
});

test('choosing Sample data in Settings shows "You chose sample data." on the portals', async ({
	page
}) => {
	await saveRentCastKey(page);
	await usage(page).getByRole('radio', { name: 'Sample data', exact: true }).click();
	await expect(page.getByTestId('live-announcer')).toHaveText('Showing sample data.');

	await page.goto('renter/');
	const bar = page.getByRole('region', { name: 'Data source' });
	await expect(bar).toContainText('Sample data');
	await expect(bar).toContainText('You chose sample data.');
	await expect(bar.getByRole('link', { name: 'Switch to RentCast' })).toBeVisible();
	await expectAxeClean(page, 'renter/ (sample by choice)');
});
