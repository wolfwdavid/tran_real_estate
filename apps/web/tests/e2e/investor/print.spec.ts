// Memo printout E2E (07-19, INV-06 print half). Runs on the root and sub projects through the
// 06-09 no-network harness. Proves: printing starts only from the button (window.print stubbed and
// counted), the print stylesheet hides the toolbar and keeps the disclaimer, provenance and sample
// label, the browser PDF is 1 to 4 pages, a memo with Must fix findings never prints, and every
// state passes axe in screen media. Zero RentCast or AI calls on the keyless path.
import type { Page } from '@playwright/test';
import {
	AI_HOSTS,
	INVESTOR_TEST_OPTIONS,
	collectRequests,
	expect,
	expectNoAxeViolations,
	mockAnthropicText,
	printCount,
	stubPrint,
	test,
	useMockedAnthropicKey
} from './helpers';

test.use(INVESTOR_TEST_OPTIONS);

const DISCLAIMER = 'Not investment, legal, or tax advice.';
const CLOSING = 'Verify every figure before you rely on it.';
const SAMPLE_SENTENCE =
	'Sample data: the property, the estimates, and the figures in this printout are made up.';
const NO_MEMO = 'This printout has no memo, only the analysis. To include one, draft a memo first.';
const BLOCKED = 'This memo has flags to fix before printing';
const PLANTED = 'Monthly cash flow is $184. Expect 12% growth next year.';
const NOTES_ONLY_NOTES = 'Area rents rose 12% last year.';
const NOTES_ONLY = `Monthly cash flow is $184. ${NOTES_ONLY_NOTES}`;

// Timeout: measured 2.8 s for "notes-only: a number present only in the notes prints" and 2.2 s for
// "blocked: a memo with a Must fix number is never printed" (root, 4 workers, e2e-report 449ecc5,
// 2026-11-06). Cause: each test saves the sample deal through the analyzer UI, drafts a memo
// through the mocked Anthropic SSE stream and then renders the print page with axe. 120 s keeps a
// 43x margin.
const MOCKED_MEMO_MS = 120_000;

const printButton = (page: Page) => page.getByRole('button', { name: 'Print or save as PDF' });
const sheet = (page: Page) => page.locator('article.print-sheet');

/** Sample deal -> Save deal -> memo page. */
async function saveSampleDealAndOpenMemo(page: Page): Promise<void> {
	await page.goto('investor/analyze/');
	await expect(page.locator('#analyzer-form[data-restored="true"]')).toBeAttached();
	await page.locator('#results').getByRole('button', { name: 'Try a sample deal' }).click();
	await expect(page.locator('#results [data-metric="cashFlow"]')).toHaveText('$184');
	await page.getByRole('button', { name: 'Save deal' }).click();
	await expect(page).toHaveURL(/\?id=/);
	await page.getByRole('link', { name: 'Draft a memo' }).click();
	await expect(page).toHaveURL(/\/investor\/memo\/\?id=/);
	await expect(page.locator('[data-memo-page]')).toBeVisible();
}

async function draftMemo(page: Page): Promise<void> {
	const panel = page.getByRole('region', { name: 'Memo draft' });
	await panel.getByRole('button', { name: 'Draft memo', exact: true }).click();
	// Timeout: measured 13.8 s for the whole of "ready: print view from a checked sample memo,
	// printed only on click" (root, 4 workers, e2e-report 449ecc5, 2026-11-06), which waits here once.
	// Cause: the keyless sample memo streams word by word (20-60 ms each) through the Fixture provider
	// before "Draft ready." appears. 60 s keeps a 4.3x margin on the whole test.
	await expect(panel.getByText('Draft ready.', { exact: true })).toBeVisible({ timeout: 60_000 });
}

test('ready: print view from a checked sample memo, printed only on click', async ({ page }) => {
	// Timeout: measured 13.8 s for "ready: print view from a checked sample memo, printed only on
	// click" (root, 4 workers, e2e-report 449ecc5, 2026-11-06).
	// Cause: the sample memo streams word by word, then the print page runs axe, page.pdf() renders
	// the sheet in print media and the test switches media twice. 150 s keeps a 10.9x margin.
	test.setTimeout(150_000);
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await stubPrint(page);
	await saveSampleDealAndOpenMemo(page);
	await draftMemo(page);
	await expect(page.locator('[data-memo-print-link]')).toHaveAttribute('href', /memo=/);
	await page.locator('[data-memo-print-link]').click();

	await expect(page).toHaveURL(/print\/memo\/\?id=.+&memo=.+/);
	await expect(page.locator('[data-ready]')).toBeVisible();
	await expect(printButton(page)).toBeFocused();
	await expect(page).toHaveTitle(/^Investment memo - .+ - \d{4}-\d{2}-\d{2}$/);
	await expect(sheet(page).getByRole('heading', { name: 'Memo', exact: true })).toBeVisible();
	await expectNoAxeViolations(page, 'print view ready');

	// Never prints on load; one click, one print dialog.
	expect(await printCount(page)).toBe(0);
	await printButton(page).click();
	await expect.poll(() => printCount(page)).toBe(1);

	// Print media: the toolbar is gone; disclaimer, provenance and sample label remain.
	await page.emulateMedia({ media: 'print' });
	await expect(printButton(page)).toBeHidden();
	await expect(page.locator('[data-print-hidden]').first()).toBeHidden();
	await expect(sheet(page).locator('header').getByText(DISCLAIMER, { exact: true })).toBeVisible();
	await expect(sheet(page).locator('[data-provenance-chip="sample"]')).toBeVisible();
	await expect(sheet(page).getByText(SAMPLE_SENTENCE, { exact: true })).toBeVisible();
	await expect(sheet(page).locator('[data-print-sources]')).toContainText(
		'Memo text is sample output written in advance.'
	);
	const important = sheet(page).locator('[data-print-important]');
	await expect(important.getByRole('heading', { name: 'Important' })).toBeVisible();
	await expect(important).toContainText(CLOSING);
	// The short disclaimer is at the top, the Important block is the last section of the sheet.
	const order = await page.evaluate(() => {
		const article = document.querySelector('article.print-sheet')!;
		const top = article.querySelector('[data-print-disclaimer-short]')!;
		const end = article.querySelector('[data-print-important]')!;
		const sections = [...article.querySelectorAll('section')];
		return {
			topFirst: Boolean(top.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING),
			endIsLast: sections.at(-1) === end
		};
	});
	expect(order).toEqual({ topFirst: true, endIsLast: true });

	// The browser's own PDF (Chromium): 1 to 4 pages.
	const pdf = await page.pdf({ preferCSSPageSize: true });
	const pages = Number(/\/Count\s+(\d+)/.exec(pdf.toString('latin1'))?.[1] ?? 0);
	expect(pages).toBeGreaterThanOrEqual(1);
	expect(pages).toBeLessThanOrEqual(4);
	await page.emulateMedia({ media: 'screen' });

	expect(await printCount(page)).toBe(1);
	expect(outbound).toEqual([]);
});

test('no memo: the analysis prints without the Memo section', async ({ page }) => {
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await stubPrint(page);
	await saveSampleDealAndOpenMemo(page);
	await page.getByRole('link', { name: 'Print the analysis without a memo' }).click();

	await expect(page).toHaveURL(/print\/memo\/\?id=/);
	await expect(page.locator('[data-ready]')).toBeVisible();
	await expect(sheet(page).getByRole('heading', { name: 'Memo', exact: true })).toHaveCount(0);
	await expect(sheet(page).getByText(NO_MEMO, { exact: true })).toBeVisible();
	await expect(sheet(page).locator('[data-print-figures] tbody tr').first()).toContainText(
		'Monthly cash flow'
	);
	await expect(sheet(page).locator('[data-print-figures] tbody tr').first()).toContainText('$184');
	await expect(sheet(page).getByRole('table', { name: 'Operating expenses' })).toContainText(
		'Total operating expenses'
	);
	await expect(sheet(page).locator('[data-print-sources]')).not.toContainText('Memo text');
	await expectNoAxeViolations(page, 'print view without a memo');
	expect(await printCount(page)).toBe(0);
	expect(outbound).toEqual([]);
});

test('not found: an unknown deal id shows the not-found panel', async ({ page }) => {
	await page.goto('print/memo/?id=nope');
	await expect(page.locator('[data-not-found-panel]')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to saved deals' })).toBeVisible();
	await expect(sheet(page)).toHaveCount(0);
	await expectNoAxeViolations(page, 'print view, deal not found');
});

test('blocked: a memo with a Must fix number is never printed', async ({ page }) => {
	test.setTimeout(MOCKED_MEMO_MS);
	await mockAnthropicText(page, PLANTED);
	await useMockedAnthropicKey(page);
	await stubPrint(page);
	await saveSampleDealAndOpenMemo(page);
	await draftMemo(page);
	await expect(
		page.getByRole('region', { name: 'Memo draft' }).getByText('Number check: 1 to fix')
	).toBeVisible();

	const dealId = new URL(page.url()).searchParams.get('id') ?? '';
	const artifactId =
		(await page.locator('[data-memo-print]').getAttribute('data-artifact-id')) ?? '';
	expect(dealId).not.toBe('');
	expect(artifactId).not.toBe('');

	await page.goto(
		`print/memo/?id=${encodeURIComponent(dealId)}&memo=${encodeURIComponent(artifactId)}`
	);
	await expect(page.getByRole('heading', { name: BLOCKED })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to memo' })).toBeVisible();
	await expect(sheet(page)).toHaveCount(0);
	await expect(printButton(page)).toHaveCount(0);
	await expectNoAxeViolations(page, 'print view, memo blocked');
	expect(await printCount(page)).toBe(0);
});

// DEBT-03 (07-HUMAN-UAT S2): 12% is only in the user's notes. The memo page allows it, and the
// print page must too (the notes numerals ride in the artifact meta); without them this shows BLOCKED.
test('notes-only: a number present only in the notes prints', async ({ page }) => {
	test.setTimeout(MOCKED_MEMO_MS);
	await mockAnthropicText(page, NOTES_ONLY);
	await useMockedAnthropicKey(page);
	await stubPrint(page);
	await saveSampleDealAndOpenMemo(page);
	await page.getByLabel('Your notes for the memo (optional)').fill(NOTES_ONLY_NOTES);
	await draftMemo(page);
	await expect(
		page.getByRole('region', { name: 'Memo draft' }).getByText('Number check passed')
	).toBeVisible();

	const dealId = new URL(page.url()).searchParams.get('id') ?? '';
	const artifactId =
		(await page.locator('[data-memo-print]').getAttribute('data-artifact-id')) ?? '';
	expect(dealId).not.toBe('');
	expect(artifactId).not.toBe('');

	await page.goto(
		`print/memo/?id=${encodeURIComponent(dealId)}&memo=${encodeURIComponent(artifactId)}`
	);
	await expect(page.locator('[data-ready]')).toBeAttached();
	await expect(page.getByRole('heading', { name: BLOCKED })).toHaveCount(0);
	expect(await sheet(page).count()).toBeGreaterThanOrEqual(1);
	await expect(sheet(page).getByText('Area rents rose 12% last year.')).toBeVisible();
	await expectNoAxeViolations(page, 'print view, memo with notes-only numbers');
	expect(await printCount(page)).toBe(0);
});
