import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Landing Get started guide (GTM-01, plan 10-15): axe over step 0, every tour step of every portal,
// and the compact row; plus focus moves and persistence. Full journey E2E is plan 10-20.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const KEY = 'tran.onboarding.v1';
const PORTALS = ['renter', 'investor', 'agent'] as const;
const TOUR_H3 = {
	renter: ['What the renter portal does', 'Where your keys go', 'Sample data or live data'],
	investor: ['What the investor portal does', 'Where your keys go', 'Sample data or live data'],
	agent: ['What the agent portal does', 'Where your keys go', 'Sample contacts or your own']
};

async function axeGuide(page: Page, label: string) {
	const results = await new AxeBuilder({ page })
		.include('#get-started')
		.withTags(WCAG_TAGS)
		.analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

async function openLanding(page: Page) {
	await page.goto('');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('#get-started')).toBeVisible();
}

const guide = (page: Page) => page.locator('#get-started');
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

test('axe guide: step 0 portal choice has no WCAG A/AA violations', async ({ page }) => {
	await openLanding(page);
	await expect(guide(page)).toContainText('Where do you want to start?');
	await expect(guide(page).locator('[role="dialog"], [inert]')).toHaveCount(0);
	// Nothing is focused on load.
	expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
	await axeGuide(page, 'guide step 0');
});

for (const portal of PORTALS) {
	test(`axe tour: ${portal} tour steps 1-3 have no WCAG A/AA violations`, async ({ page }) => {
		await openLanding(page);
		const title = portal[0].toUpperCase() + portal.slice(1);
		await guide(page)
			.getByRole('button', { name: `${title} Start the tour` })
			.click();
		for (const [i, h3] of TOUR_H3[portal].entries()) {
			const heading = guide(page).getByRole('heading', { level: 3, name: h3 });
			await expect(heading).toBeFocused();
			await expect(guide(page)).toContainText(`Step ${i + 1} of 3`);
			await axeGuide(page, `${portal} tour step ${i + 1}`);
			if (i < 2) await guide(page).getByRole('button', { name: 'Next' }).click();
		}
		const sample = guide(page).getByRole('link', { name: 'Try sample data' });
		await expect(sample).toHaveAttribute('href', new RegExp(`/${portal}/\\?source=sample$`));
		if (portal === 'agent') {
			await expect(
				guide(page).getByRole('link', { name: 'Start with an empty pipeline' })
			).toHaveAttribute('href', /\/agent\/$/);
		} else {
			await expect(
				guide(page).getByRole('link', { name: 'Connect a free RentCast key' })
			).toHaveAttribute('href', new RegExp(`/setup/rentcast/\\?portal=${portal}$`));
		}
		expect(JSON.parse((await stored(page)) ?? '{}')).toMatchObject({
			status: 'touring',
			portal,
			step: 3
		});
	});
}

test('axe guide: hide moves focus to the compact row, which survives a reload', async ({
	page
}) => {
	await openLanding(page);
	await guide(page).getByRole('button', { name: 'Investor Start the tour' }).click();
	await guide(page).getByRole('button', { name: 'Skip tour' }).click();
	await expect(guide(page).getByRole('heading', { level: 3 })).toBeFocused();
	await guide(page).getByRole('button', { name: 'Hide this guide' }).click();
	const show = guide(page).getByRole('button', { name: 'Show me around' });
	await expect(show).toBeFocused();
	await expect(guide(page)).toContainText('New here, or want a refresher?');
	await axeGuide(page, 'guide compact row');

	await page.reload();
	await expect(guide(page)).toContainText('New here, or want a refresher?');
	await show.click();
	await expect(guide(page).getByRole('heading', { level: 2, name: 'Get started' })).toBeFocused();
	await expect(guide(page)).toContainText('Where do you want to start?');
});

test('guide: a sample-data exit records done with the last portal', async ({ page }) => {
	await openLanding(page);
	await guide(page).getByRole('button', { name: 'Renter Start the tour' }).click();
	await guide(page).getByRole('button', { name: 'Skip tour' }).click();
	await guide(page).getByRole('link', { name: 'Try sample data' }).click();
	await page.waitForURL(/\/renter\//);
	expect(await stored(page)).toBe('{"status":"done","lastPortal":"renter"}');
	await openLanding(page);
	await expect(guide(page).getByRole('link', { name: 'Open renter portal' })).toBeVisible();
});

test('guide: hero Show me around resets the guide and focuses its heading', async ({ page }) => {
	await openLanding(page);
	await guide(page).getByRole('button', { name: 'Agent Start the tour' }).click();
	await page.getByRole('link', { name: 'Show me around', exact: true }).click();
	await expect(guide(page).getByRole('heading', { level: 2, name: 'Get started' })).toBeFocused();
	await expect(guide(page)).toContainText('Where do you want to start?');
	// Second click while already at #get-started (no hashchange) still resets.
	await guide(page).getByRole('button', { name: 'Agent Start the tour' }).click();
	await page.getByRole('link', { name: 'Show me around', exact: true }).click();
	await expect(guide(page).getByRole('heading', { level: 2, name: 'Get started' })).toBeFocused();
	await expect(guide(page)).toContainText('Where do you want to start?');
});
