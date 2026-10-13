// Investment memo E2E (07-17, INV-06). Runs on the root and sub projects through the 06-09
// no-network harness: anything not mocked fails the test. Proves the FACTS-only prompt, the
// number / Fair Housing / advice gating of every exit and the print link, the keyless sample memo
// and the stale note.
//
// Note: the planted figure is 12%, not 20%: the sample deal's down payment is 20%, so 20% is a
// figure from the analysis and correctly passes the number check.
import type { Page } from '@playwright/test';
import {
	AI_HOSTS,
	INVESTOR_TEST_OPTIONS,
	collectRequests,
	expect,
	expectNoAxeViolations,
	expectNoHorizontalScroll,
	mockAnthropicText,
	test,
	useMockedAnthropicKey
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const PLANTED =
	'Monthly cash flow is $184. Expect 12% growth next year. It is perfect for young professionals.';
const NUMBER_REASON = 'Fix the 1 number marked Must fix to copy, email, or print this memo.';
const STALE = 'You changed this deal after this memo was drafted.';

const panel = (page: Page) => page.getByRole('region', { name: 'Memo draft' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const exits = (page: Page) => panel(page).getByTestId('generation-exits');
const copyButton = (page: Page) => exits(page).getByRole('button', { name: 'Copy text' });
const printLink = (page: Page) => page.locator('[data-memo-print-link]');
const draftButton = (page: Page) =>
	panel(page).getByRole('button', { name: 'Draft memo', exact: true });

async function expectDraftReady(page: Page): Promise<void> {
	// The sample memo streams word by word (20-60ms each), so allow for a long draft.
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 60_000
	});
}

/** Sample deal -> Save deal -> Draft a memo. Returns the memo page URL. */
async function saveSampleDealAndOpenMemo(page: Page): Promise<string> {
	await page.goto('investor/analyze/');
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	await page.getByRole('link', { name: 'Draft a memo' }).click();
	await expect(page).toHaveURL(/\/investor\/memo\/\?id=/);
	await expect(page.locator('[data-memo-page]')).toBeVisible();
	return page.url();
}

test('keyless: the sample memo passes every check and unlocks the print link', async ({ page }) => {
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await saveSampleDealAndOpenMemo(page);

	await expect(page.locator('[data-memo-metrics] [data-metric="cashFlow"]')).toContainText('$184');
	await expect(
		page.getByText(
			"The AI writes the words. Every number comes from your analysis, and Tran flags any number it didn't calculate."
		)
	).toBeVisible();
	await expect(printLink(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(printLink(page)).not.toHaveAttribute('href');
	await expectNoAxeViolations(page, 'memo page before drafting');

	await draftButton(page).click();
	await expectDraftReady(page);
	await expect(panel(page).getByText('Number check passed')).toBeVisible();
	await expect(panel(page).getByText('Advice language check passed')).toBeVisible();
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');
	const href = (await printLink(page).getAttribute('href')) ?? '';
	expect(href).toContain('/print/memo/?id=');
	expect(href).toContain('&memo=');
	await expect(page.locator('[data-memo-print]')).not.toHaveAttribute('data-artifact-id', '');
	await expect(page.getByText(STALE)).toHaveCount(0);
	await expectNoAxeViolations(page, 'keyless memo passed');

	expect(outbound).toEqual([]);
});

test('a planted number and a Fair Housing phrase gate every exit and the print link', async ({
	page
}) => {
	const bodies: string[] = [];
	page.on('request', (r) => {
		if (r.method() === 'POST' && r.url().startsWith('https://api.anthropic.com/v1/messages')) {
			bodies.push(r.postData() ?? '');
		}
	});
	await mockAnthropicText(page, PLANTED);
	await useMockedAnthropicKey(page);
	await saveSampleDealAndOpenMemo(page);

	await draftButton(page).click();
	await expectDraftReady(page);

	// The request carried FACTS text only: formatted figures, no raw floats.
	expect(bodies).toHaveLength(1);
	const sent = JSON.stringify(JSON.parse(bodies[0]!));
	expect(sent).toContain('FACTS:');
	expect(sent).toContain('Monthly cash flow: $184');
	expect(sent).not.toMatch(/\d+\.\d{3,}/);

	await expect(panel(page).getByText('Number check: 1 to fix')).toBeVisible();
	const mark = draft(page).getByRole('button', { name: /Number check, must fix: 12%/ });
	await expect(mark).toBeVisible();
	await expect(draft(page).getByRole('button', { name: /young professionals/ })).toBeVisible();

	await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(printLink(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(printLink(page)).not.toHaveAttribute('href');
	await expect(page.getByText(NUMBER_REASON, { exact: true })).toBeVisible();

	await mark.click();
	const popover = page.getByRole('dialog');
	await expect(popover).toBeVisible();
	await expect(popover.getByText('Number not in your analysis')).toBeVisible();
	await expectNoAxeViolations(page, 'memo with number and Fair Housing findings, popover open');
	await page.keyboard.press('Escape');
	await expect(popover).toBeHidden();

	// Edit the draft down to analysis figures only: every gate opens.
	await panel(page).getByRole('button', { name: 'Edit draft' }).click();
	await panel(page).getByLabel('Edit your draft').fill('Monthly cash flow is $184.');
	await panel(page).getByRole('button', { name: 'Done editing' }).click();
	await expect(panel(page).getByText('Number check passed')).toBeVisible();
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');
	await expect(printLink(page)).toHaveAttribute('href', /\/print\/memo\/\?id=.+&memo=.+/);
	await expect(page.getByText(NUMBER_REASON, { exact: true })).toHaveCount(0);

	// Inside the recheck window the Print link carries no href (a middle-click cannot open an
	// unchecked memo); a pointerdown runs the check and restores it. One evaluate = deterministic,
	// far inside the 300 ms window.
	await panel(page).getByRole('button', { name: 'Edit draft' }).click();
	const memoBox = panel(page).getByLabel('Edit your draft');
	const link = await printLink(page).elementHandle();
	const probe = await memoBox.evaluate(async (box, a) => {
		const ta = box as HTMLTextAreaElement;
		ta.value = 'Monthly cash flow is $184. Sunny.';
		ta.dispatchEvent(new Event('input', { bubbles: true }));
		await new Promise((r) => setTimeout(r, 0));
		const pending = (a as HTMLAnchorElement).getAttribute('href');
		a!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1 }));
		return { pending, settled: (a as HTMLAnchorElement).getAttribute('href') };
	}, link);
	expect(probe.pending).toBeNull();
	expect(probe.settled).toMatch(/\/print\/memo\/\?id=.+&memo=.+/);

	// A Review phrase typed while still editing gates Print at once, not after the 300 ms recheck.
	await memoBox.fill('Monthly cash flow is $184. Walking distance to church.');
	await printLink(page).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('[id$="-findings-title"]').first()).toBeFocused();
	await expect(page).not.toHaveURL(/\/print\/memo\//);
	await expect(printLink(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(printLink(page)).not.toHaveAttribute('href');
});

test('a memo drafted before the deal changed shows the stale note', async ({ page }) => {
	const memoUrl = await saveSampleDealAndOpenMemo(page);
	await draftButton(page).click();
	await expectDraftReady(page);
	await expect(page.getByText(STALE)).toHaveCount(0);

	await page.getByRole('link', { name: 'Open in analyzer' }).click();
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await page.locator('#rent').fill('2,100');
	await page.locator('#rent').press('Tab');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.locator('[data-save-status]')).toContainText('Saved');

	await page.goto(memoUrl);
	await expect(page.locator('[data-memo-page]')).toBeVisible();
	await expect(page.getByText(STALE)).toBeVisible();
});

test('notes over 1,000 characters show the error; no id asks for a saved deal', async ({
	page
}) => {
	await saveSampleDealAndOpenMemo(page);
	const notes = page.getByLabel('Your notes for the memo (optional)');
	await notes.fill('a'.repeat(1001));
	await expect(page.getByText('Shorten your notes to 1,000 characters.')).toBeVisible();
	await expect(page.getByText('1,001 of 1,000 characters')).toBeVisible();
	await notes.fill('Plan to repaint before renting.');
	await expect(page.getByText('Shorten your notes to 1,000 characters.')).toHaveCount(0);

	await page.goto('investor/memo/');
	await expect(page.getByRole('heading', { name: 'Save a deal first' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Analyze a deal' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Go to saved deals' })).toBeVisible();
});

test('the memo page fits a 375px screen', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await saveSampleDealAndOpenMemo(page);
	await expectNoHorizontalScroll(page);
	await draftButton(page).click();
	await expectDraftReady(page);
	await expectNoHorizontalScroll(page);
});
