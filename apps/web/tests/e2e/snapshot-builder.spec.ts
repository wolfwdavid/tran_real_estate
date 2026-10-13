// Market Snapshot builder E2E (09-17, STU-04) on the real build, root and sub bases, through the
// 06-09 no-network harness: any request that is not mocked fails the test, so the keyless runs
// prove zero requests to RentCast or any AI host.
//
// Proves: the four steps (steps 2-4 wait for step 1's data); keyless sample ZIP at
// "(0 calls · sample data)"; the market notes drafted by the sample provider pass the number
// check, a planted "$9,999" gates Save with the Must fix reason, and removing it unlocks Save,
// which stores one frozen record and opens /print/snapshot/?id=. With a mocked RentCast key a new
// ZIP is exactly 1 call, the listings summary 1 more (2 in total), and after a reload the same ZIP
// is "(0 calls · cached)" with the total still 2. The gate, Delete flow, axe states and the 375px
// layout are covered too. The print body itself is asserted by snapshot-print.spec.ts (09-18).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
	AI_HOSTS,
	INVESTOR_TEST_OPTIONS,
	MOCK_ZIP,
	collectRequests,
	expect,
	expectNoHorizontalScroll,
	marketStatsBody,
	mockRentCast,
	saleListingsBody,
	test,
	useMockedRentCastKey,
	type MockResult,
	type Net
} from './investor/helpers';

test.use(INVESTOR_TEST_OPTIONS);

const LIVE_ZIP = '00199';
const PRINT_PATH = 'print/snapshot/';
/** `${base}/print/snapshot/?id={uuid}` on either base. */
const PRINT_URL = new RegExp(`/${PRINT_PATH}\\?id=[0-9a-f-]{36}$`);
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MARKETS = '/v1/markets';
const SALE = '/v1/listings/sale';
const PLANTED = ' Median rent is $9,999.';
const NOTES_REASON = /Fix the \d+ items marked Must fix in the market notes/;

const builder = (page: Page) => page.locator('[data-snapshot-builder]');
const stepSection = (page: Page, n: number) => page.locator(`[data-step="${n}"]`);
const loadZip = (page: Page) => page.getByRole('button', { name: /^Load ZIP data/ });
const zipHeading = (page: Page, zip: string) =>
	stepSection(page, 1).getByRole('heading', { level: 3, name: `ZIP ${zip}`, exact: true });
const notesPanel = (page: Page) => page.getByRole('region', { name: 'Market notes', exact: true });
const draftButton = (page: Page) =>
	notesPanel(page).getByRole('button', { name: 'Draft market notes', exact: true });
const saveButton = (page: Page) => page.locator('[data-save-snapshot]');
const saveReason = (page: Page) => page.locator('[data-save-reason]');
const list = (page: Page) => page.locator('[data-snapshot-list]');

async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** Opens the builder and waits until the browser reads are done and step 1 is interactive. */
async function openBuilder(page: Page): Promise<void> {
	await page.goto('agent/studio/snapshot/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(builder(page)).toBeVisible();
	await expect(page.getByText('Loading your studio')).toHaveCount(0);
	await expect(loadZip(page)).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
}

/** The MOCK_ZIP fixture market body re-labelled for the requested ZIP. */
async function marketsFor(url: URL): Promise<MockResult> {
	const zip = url.searchParams.get('zipCode') ?? '';
	const body = (await marketStatsBody(MOCK_ZIP)) as Record<string, unknown>;
	return { status: 200, body: { ...body, id: zip, zipCode: zip } };
}

async function liveRentCast(page: Page, net: Net, markets?: MockResult) {
	const rc = await mockRentCast(page, net, {
		respond: {
			markets: markets ?? marketsFor,
			saleListings: async () => ({ status: 200, body: await saleListingsBody() })
		}
	});
	await useMockedRentCastKey(page);
	return rc;
}

/** Keyless: picks the first sample ZIP row and loads it (0 calls). Returns the ZIP. */
async function loadFirstSampleZip(page: Page): Promise<string> {
	const first = stepSection(page, 1).getByRole('radio').first();
	const zip = (await first.getAttribute('value')) ?? '';
	expect(zip).toMatch(/^\d{5}$/);
	await first.check();
	await expect(loadZip(page)).toHaveAccessibleName('Load ZIP data (0 calls · sample data)');
	await loadZip(page).click();
	await expect(zipHeading(page, zip)).toBeFocused();
	return zip;
}

/**
 * Activates the gated Save from the keyboard. Playwright's click refuses aria-disabled controls,
 * but the button stays focusable and its handler moves focus to the reason line.
 */
async function activateGated(page: Page): Promise<void> {
	await saveButton(page).focus();
	await page.keyboard.press('Enter');
}

async function draftNotes(page: Page): Promise<void> {
	await draftButton(page).click();
	// The sample notes stream word by word, so allow for a long draft.
	await expect(notesPanel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 60_000
	});
}

async function editNotes(page: Page, edit: (text: string) => string): Promise<void> {
	await notesPanel(page).getByRole('button', { name: 'Edit draft' }).click();
	const box = notesPanel(page).getByLabel('Edit your draft');
	await box.fill(edit(await box.inputValue()));
	await notesPanel(page).getByRole('button', { name: 'Done editing' }).click();
}

test('keyless: sample ZIP, notes with a planted number gate Save, then save opens the print view', async ({
	page
}) => {
	test.slow();
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await openBuilder(page);

	await expect(page.getByRole('region', { name: 'Data source' })).toBeVisible();
	await expect(
		page.getByText(
			'Market information only. Not a comparative market analysis or a professional valuation of any property.'
		)
	).toBeVisible();
	for (const [n, title] of [
		[1, '1. Choose a ZIP code'],
		[2, '2. Choose what to include'],
		[3, '3. Market notes'],
		[4, '4. Save and print']
	] as const) {
		await expect(stepSection(page, n).getByRole('heading', { level: 2 })).toHaveText(title);
	}
	for (const n of [2, 3, 4]) {
		await expect(stepSection(page, n).getByText("Load a ZIP code's data first.")).toBeVisible();
	}
	await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(list(page).getByText('No saved snapshots yet.')).toBeVisible();
	await expectNoAxeViolations(page, 'snapshot builder before load');

	const zip = await loadFirstSampleZip(page);
	await expect(stepSection(page, 1).getByText('Median rent', { exact: true })).toBeVisible();
	await expect(stepSection(page, 4).locator('[data-cost-zip]')).toContainText(
		'0 calls · sample data · as of'
	);
	await expect(stepSection(page, 4).locator('[data-cost-notes]')).toHaveText('Not drafted yet');
	await expect(saveReason(page)).toHaveText('Draft the market notes, or turn them off in step 2.');
	await expectNoAxeViolations(page, 'snapshot builder loaded (sample)');

	await draftNotes(page);
	await expect(
		notesPanel(page)
			.getByText(/Sample output/)
			.first()
	).toBeVisible();
	await expect(notesPanel(page).getByText('Number check passed')).toBeVisible();
	await expect(saveReason(page)).toHaveCount(0);
	await expect(saveButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	// A number Tran didn't calculate gates Save.
	await editNotes(page, (t) => t + PLANTED);
	await expect(notesPanel(page).getByText('Number check: 1 to fix')).toBeVisible();
	await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(saveReason(page)).toHaveText(NOTES_REASON);
	await expect(saveReason(page)).toContainText('Must fix');
	await expectNoAxeViolations(page, 'snapshot notes with a number finding, Save gated');

	// Activating the gated button focuses the reason line; nothing is saved.
	await activateGated(page);
	await expect(saveReason(page)).toBeFocused();
	await expect(page).toHaveURL(/\/agent\/studio\/snapshot\/$/);

	await editNotes(page, (t) => t.replace(PLANTED, ''));
	await expect(notesPanel(page).getByText('Number check passed')).toBeVisible();
	await expect(saveButton(page)).not.toHaveAttribute('aria-disabled', 'true');
	await expect(stepSection(page, 4).locator('[data-cost-notes]')).toHaveText('Drafted');
	await expectNoAxeViolations(page, 'snapshot Save enabled');

	// A Review phrase typed while still editing gates Save at once, not after the 300 ms recheck.
	await notesPanel(page).getByRole('button', { name: 'Edit draft' }).click();
	const notesBox = notesPanel(page).getByLabel('Edit your draft');
	const cleanNotes = await notesBox.inputValue();
	await notesBox.fill(`${cleanNotes} Walking distance to church.`);
	await activateGated(page);
	await expect(saveReason(page)).toBeFocused();
	// Match a stable substring only: for a Review-only gate the current wording reads "Fix the 0
	// items marked Must fix..." (a tracked follow-up), so do not lock it in here.
	await expect(saveReason(page)).toContainText('in the market notes');
	await expect(page).toHaveURL(/\/agent\/studio\/snapshot\/$/);
	await notesBox.fill(cleanNotes);
	await notesPanel(page).getByRole('button', { name: 'Done editing' }).click();
	await expect(saveButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	await page.setViewportSize({ width: 375, height: 812 });
	await expectNoHorizontalScroll(page);

	await saveButton(page).click();
	await expect(page).toHaveURL(PRINT_URL);
	await expect(page.locator('h1').first()).toBeVisible();

	// Back in the builder, the saved record is listed as sample data.
	await openBuilder(page);
	const row = list(page).locator('[data-snapshot-row]');
	await expect(row).toHaveCount(1);
	await expect(row.getByRole('heading', { name: `ZIP ${zip}` })).toBeVisible();
	await expect(row.getByText('Sample data')).toBeVisible();
	await expect(row.getByRole('link', { name: /^Open print view/ })).toHaveAttribute(
		'href',
		PRINT_URL
	);

	expect(outbound).toEqual([]);
});

test('Choose a different ZIP drops the old figures and notes and gates Save', async ({ page }) => {
	test.slow();
	await openBuilder(page);
	const zip = await loadFirstSampleZip(page);
	await draftNotes(page);
	await expect(saveButton(page)).not.toHaveAttribute('aria-disabled', 'true');

	await stepSection(page, 1).getByRole('button', { name: 'Choose a different ZIP' }).click();
	await expect(loadZip(page)).toBeFocused();
	await expect(zipHeading(page, zip)).toHaveCount(0);
	await expect(stepSection(page, 1).getByText('Median rent', { exact: true })).toHaveCount(0);
	for (const n of [2, 3, 4]) {
		await expect(stepSection(page, n).getByText("Load a ZIP code's data first.")).toBeVisible();
	}
	await expect(notesPanel(page)).toHaveCount(0);
	await expect(stepSection(page, 4).locator('dl')).toHaveCount(0);
	await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(saveReason(page)).toHaveText("Load a ZIP code's data first.");
	await activateGated(page);
	await expect(saveReason(page)).toBeFocused();
	await expect(page).toHaveURL(/\/agent\/studio\/snapshot\/$/);

	// Loading again starts the notes from scratch.
	await loadZip(page).click();
	await expect(zipHeading(page, zip)).toBeFocused();
	await expect(draftButton(page)).toBeVisible();
	await expect(notesPanel(page).getByText('Draft ready.', { exact: true })).toHaveCount(0);
	await expect(saveReason(page)).toHaveText('Draft the market notes, or turn them off in step 2.');
});

test('save gate: no data section; Delete asks first, removes the row and announces it', async ({
	page
}) => {
	test.slow();
	await openBuilder(page);
	await loadFirstSampleZip(page);

	// Market notes off, then every data section off.
	const toggles = stepSection(page, 2);
	await toggles.getByLabel('Market notes', { exact: true }).uncheck();
	await expect(
		stepSection(page, 3).getByText('Market notes are turned off in step 2.')
	).toBeVisible();
	await expect(stepSection(page, 4).locator('[data-cost-notes]')).toHaveText('Not included');
	for (const label of [
		'Key figures',
		'Rent trend chart',
		'Price-to-rent chart',
		'Rent by bedroom table',
		'Days on market and inventory table'
	]) {
		await toggles.getByLabel(label, { exact: true }).uncheck();
	}
	await expect(saveReason(page)).toHaveText('Choose at least one section with market data.');
	await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expectNoAxeViolations(page, 'snapshot Save gated (no data section)');

	await toggles.getByLabel('Key figures', { exact: true }).check();
	await expect(saveReason(page)).toHaveCount(0);
	await saveButton(page).click();
	await expect(page).toHaveURL(PRINT_URL);

	await openBuilder(page);
	const row = list(page).locator('[data-snapshot-row]');
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('1 section');
	await row.getByRole('button', { name: /^Delete/ }).click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText(/Delete the ZIP \d{5} snapshot from [A-Z][a-z]{2} \d{1,2}\?/);
	await expect(dialog.getByRole('button', { name: 'Keep snapshot' })).toBeFocused();
	await expectNoAxeViolations(page, 'snapshot Delete confirm open');
	await dialog.getByRole('button', { name: 'Delete snapshot' }).click();
	await expect(row).toHaveCount(0);
	await expect(list(page).getByRole('heading', { name: 'Your snapshots' })).toBeFocused();
	await expect(page.locator('[role="status"][aria-live="polite"]').first()).toContainText(
		/Deleted the ZIP \d{5} snapshot\./
	);
	await expect(list(page).getByText('No saved snapshots yet.')).toBeVisible();
});

test('mocked key: new ZIP 1 call, listings summary 1 more, cached reload 0 (2 in total)', async ({
	page,
	net
}) => {
	test.slow();
	const rc = await liveRentCast(page, net);
	await openBuilder(page);
	expect(rc.count()).toBe(0);

	const input = stepSection(page, 1).getByLabel('ZIP code to load', { exact: true });
	await input.fill(LIVE_ZIP);
	await expect(loadZip(page)).toHaveAccessibleName('Load ZIP data (1 call)');
	expect(rc.count()).toBe(0); // the label is free
	await loadZip(page).click();
	await expect(zipHeading(page, LIVE_ZIP)).toBeFocused();
	expect(rc.count(MARKETS)).toBe(1);
	expect(rc.count()).toBe(1);
	await expect(stepSection(page, 4).locator('[data-cost-zip]')).toContainText('1 call · as of');

	await stepSection(page, 2).getByLabel('Active listings summary (1 call)').check();
	const loadSummary = stepSection(page, 2).getByRole('button', { name: /^Load listings summary/ });
	await expect(loadSummary).toHaveAccessibleName('Load listings summary (1 call)');
	expect(rc.count()).toBe(1);
	await loadSummary.click();
	await expect(stepSection(page, 2).locator('table')).toBeVisible();
	expect(rc.count(SALE)).toBe(1);
	expect(rc.count()).toBe(2);
	await expect(stepSection(page, 4).locator('[data-cost-listings]')).toHaveText('1 call');
	// Live data with no saved profile: Save waits for the disclosure fields (after the notes).
	await stepSection(page, 2).getByLabel('Market notes', { exact: true }).uncheck();
	await expect(saveReason(page)).toContainText('in your profile so your disclosure can be added.');
	await expectNoAxeViolations(page, 'snapshot listings summary loaded (mocked live)');

	await page.reload();
	await expect(builder(page)).toBeVisible();
	await expect(page.getByText('Loading your studio')).toHaveCount(0);
	await input.fill(LIVE_ZIP);
	await expect(loadZip(page)).toHaveAccessibleName('Load ZIP data (0 calls · cached)');
	await loadZip(page).click();
	await expect(zipHeading(page, LIVE_ZIP)).toBeFocused();
	await expect(stepSection(page, 4).locator('[data-cost-zip]')).toContainText(
		'0 calls · cached · as of'
	);
	expect(rc.count()).toBe(2);
});

test('mocked key: a RentCast error shows GatewayError and passes axe', async ({ page, net }) => {
	await liveRentCast(page, net, { status: 500, body: {} });
	await openBuilder(page);
	await stepSection(page, 1).getByLabel('ZIP code to load', { exact: true }).fill(LIVE_ZIP);
	await expect(loadZip(page)).toHaveAccessibleName('Load ZIP data (1 call)');
	await loadZip(page).click();
	await expect(stepSection(page, 1).getByRole('button', { name: /Try again/ })).toBeVisible();
	await expect(stepSection(page, 2).getByText("Load a ZIP code's data first.")).toBeVisible();
	await expectNoAxeViolations(page, 'snapshot GatewayError');
});
