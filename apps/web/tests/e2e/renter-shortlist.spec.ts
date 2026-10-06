import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls } from './support/network';
import { rentcastFixtures } from './support/rentcast-mocks';

// RENT-05 end to end on both bases, keyless (sample mode): save two sample listings from their
// detail pages, then track them on /renter/shortlist/. Status moves save immediately and keep
// focus on the moved card's select, notes save explicitly and survive a reload, removal asks
// first only when something would be lost, and the board never spends a RentCast call.

test.use(RENTER_TEST_OPTIONS);

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Row = Record<string, unknown>;

/** Two 74201 sample rentals: the first is the 06-14 detail fixture. */
function twoFixtures(): [Row, Row] {
	const rows = rentcastFixtures().rentals as Row[];
	const first = rows.find((r) => r.id === 'SAMPLE-74201-R017');
	const second = rows.find((r) => r.zipCode === '74201' && r.id !== 'SAMPLE-74201-R017');
	if (!first || !second) throw new Error('74201 fixtures missing');
	return [first, second];
}

function street(row: Row): string {
	const line2 = typeof row.addressLine2 === 'string' ? row.addressLine2.trim() : '';
	return line2 ? `${row.addressLine1 as string}, ${line2}` : (row.addressLine1 as string);
}

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

async function openShortlist(page: Page) {
	await page.goto('renter/shortlist/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByRole('heading', { level: 1, name: 'Your shortlist' })).toBeVisible();
}

async function saveFromDetail(page: Page, id: string) {
	await page.goto(`renter/listing/?id=${encodeURIComponent(id)}`);
	await page.getByRole('button', { name: 'Save to shortlist' }).click();
	await expect(page.getByRole('button', { name: 'On your shortlist' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
}

const card = (page: Page, row: Row) =>
	page.locator(`article[data-shortlist-card="${row.id as string}"]`);
const section = (page: Page, status: string) =>
	page.locator(`section[data-shortlist-section="${status}"]`);
const summary = (page: Page) => page.locator('[data-shortlist-summary]');
const announcer = (page: Page) => page.getByTestId('live-announcer');

test('an empty shortlist offers a search, at 0 calls', async ({ page, net }) => {
	await openShortlist(page);
	await expect(
		page.getByRole('heading', { level: 2, name: 'Your shortlist is empty' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Search rentals' })).toBeVisible();
	await expectNoViolations(page, 'empty shortlist');
	expect(rentcastCalls(net)).toBe(0);
});

test('save two, move one to Toured, add notes, reload, then remove both', async ({ page, net }) => {
	const [a, b] = twoFixtures();
	await saveFromDetail(page, a.id as string);
	await saveFromDetail(page, b.id as string);

	const navLink = page
		.getByRole('navigation', { name: 'Renter tools' })
		.getByRole('link', { name: /^Shortlist/ });
	await expect(navLink).toHaveText('Shortlist 2 listings');
	await expect(navLink.locator('.sr-only')).toHaveText(' listings');

	await navLink.click();
	await expect(summary(page)).toHaveText('2 listings · 0 contacted · 0 applied');
	await expect(section(page, 'saved').getByRole('heading', { level: 2 })).toHaveText('Saved (2)');
	await expect(section(page, 'toured').getByText('Nothing here yet.')).toBeVisible();
	for (const row of [a, b]) {
		await expect(card(page, row).locator('[data-provenance-chip="sample"]')).toBeVisible();
	}
	await expectNoViolations(page, 'populated shortlist');

	// Status: a native select, saved at once, the card moves and the select keeps focus.
	const select = card(page, a).getByRole('combobox', { name: 'Status' });
	await select.selectOption({ label: 'Toured' });
	await expect(section(page, 'toured').locator('article')).toHaveCount(1);
	await expect(section(page, 'toured').getByRole('heading', { level: 2 })).toHaveText('Toured (1)');
	const moved = section(page, 'toured').getByRole('combobox', { name: 'Status' });
	await expect(moved).toBeFocused();
	await expect(moved).toHaveValue('toured');
	await expect(summary(page)).toHaveText('2 listings · 1 contacted · 0 applied');
	await expect(announcer(page)).toHaveText(`${street(a)} moved to Toured.`);

	// Notes: explicit save.
	await card(page, a).getByRole('button', { name: 'Add notes' }).click();
	const field = card(page, a).getByRole('textbox', { name: `Notes for ${street(a)}` });
	await expect(field).toBeFocused();
	await field.fill('Ask about parking');
	await expect(card(page, a).getByText('17 of 2,000')).toBeVisible();
	await expectNoViolations(page, 'notes editing');
	await card(page, a).getByRole('button', { name: 'Save notes' }).click();
	await expect(announcer(page)).toHaveText('Notes saved.');
	await expect(card(page, a).getByRole('button', { name: 'Edit notes' })).toBeFocused();

	// Persistence across a reload.
	await page.reload();
	await expect(section(page, 'toured').locator('article')).toHaveCount(1);
	await expect(card(page, a).getByRole('combobox', { name: 'Status' })).toHaveValue('toured');
	await expect(card(page, a).getByText('Ask about parking')).toBeVisible();
	await expect(card(page, a).locator('[data-status-meta]')).toHaveText(
		/^Toured [A-Z][a-z]{2} \d{1,2}$/
	);

	// Status is text plus icon, never color alone.
	const badges = page.locator('[data-status-badge]');
	await expect(badges).toHaveCount(2);
	for (const badge of await badges.all()) {
		await expect(badge).toHaveText(/^(Saved|Contacted|Toured|Applied|Signed)$/);
		await expect(badge.locator('svg')).toHaveCount(1);
	}

	// Remove with confirmation: Toured + notes asks first, focus starts on Keep it.
	await card(page, a)
		.getByRole('button', { name: `Remove ${street(a)} from shortlist` })
		.click();
	const dialog = page.getByRole('alertdialog');
	await expect(
		dialog.getByRole('heading', { name: 'Remove this listing from your shortlist?' })
	).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
	await expectNoViolations(page, 'remove dialog');
	await dialog.getByRole('button', { name: 'Remove listing' }).click();
	await expect(card(page, a)).toHaveCount(0);
	await expect(announcer(page)).toContainText('Removed');
	await expect(section(page, 'toured').getByRole('heading', { level: 2 })).toBeFocused();
	await expect(summary(page)).toHaveText('1 listing · 0 contacted · 0 applied');

	// A plain Saved item with no notes goes at once, without a dialog.
	await card(page, b)
		.getByRole('button', { name: `Remove ${street(b)} from shortlist` })
		.click();
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await expect(
		page.getByRole('heading', { level: 2, name: 'Your shortlist is empty' })
	).toBeFocused();
	await expect(announcer(page)).toHaveText(`Removed ${street(b)} from your shortlist.`);
	await expect(navLink).toHaveText('Shortlist');

	expect(rentcastCalls(net)).toBe(0);
});

test('five columns at 1280px; no horizontal scroll at 375px', async ({ page, net }) => {
	const [a, b] = twoFixtures();
	await saveFromDetail(page, a.id as string);
	await saveFromDetail(page, b.id as string);

	await page.setViewportSize({ width: 1280, height: 900 });
	await openShortlist(page);
	await expect(summary(page)).toHaveText('2 listings · 0 contacted · 0 applied');
	const tops = await page
		.locator('section[data-shortlist-section]')
		.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
	expect(tops).toHaveLength(5);
	expect(new Set(tops).size, 'the five status columns share one row').toBe(1);
	await expectNoViolations(page, 'board at 1280px');

	await page.setViewportSize({ width: 375, height: 812 });
	await expect(summary(page)).toBeVisible();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(375);
	const stacked = await page
		.locator('section[data-shortlist-section]')
		.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
	expect(new Set(stacked).size, 'stacked below 1280px').toBe(5);

	expect(rentcastCalls(net)).toBe(0);
});

test('a #item- link from the detail page lands on that card', async ({ page }) => {
	const [a] = twoFixtures();
	await saveFromDetail(page, a.id as string);
	await page.getByRole('link', { name: 'See it on your shortlist' }).click();
	await expect(card(page, a)).toBeFocused();
});
