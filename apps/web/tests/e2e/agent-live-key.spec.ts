import { test, expect, type Page } from '@playwright/test';
import { AGENT_ROUTES } from './routes';
import { blockRentCast, mockRentCast, saveRentCastKey, seedSavedSearches } from './helpers/data';

// Phase 8 gap closure (08-27, success criterion 5 with a live key): with a real-format RentCast key
// saved and due renter saved searches, the agent CRM spends zero RentCast calls and never shows the
// DueSearchesDialog, on full loads and on client-side navigation. The first client-side arrival at
// a non-agent page (Renter) runs the check-on-open pass there, once per app open. Complements the
// keyless walk in agent-no-rentcast.spec.ts. RentCast is mocked (404 for every GET), never reached.

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
	await blockRentCast(page);
});

const DUE_DECLINED = "Saved searches weren't checked. Tran will ask again next time you open it.";

/**
 * Seeds due saved searches from the marketing home page, which mounts no DataShell, so no (app)
 * page's own pass races the seed (the data-status.spec.ts pattern).
 */
async function seedFromHome(page: Page, n: number): Promise<void> {
	await page.goto('');
	await seedSavedSearches(page, n, { lastRunAt: null, reload: false });
}

async function settle(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1:visible')).toHaveCount(1);
	await expect(page.getByText(/^Loading (your|this) /)).toHaveCount(0);
}

/** Every saved search's run markers, read straight from the app database. */
async function readRuns(
	page: Page
): Promise<{ lastRunAt: number | null; claimedAt: number | null }[]> {
	return page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('tran');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		const rows = await new Promise<{ lastRunAt: number | null; claimedAt: number | null }[]>(
			(resolve, reject) => {
				const req = db
					.transaction('savedSearches', 'readonly')
					.objectStore('savedSearches')
					.getAll();
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			}
		);
		db.close();
		return rows.map((r) => ({ lastRunAt: r.lastRunAt ?? null, claimedAt: r.claimedAt ?? null }));
	});
}

const portals = (page: Page) => page.getByRole('navigation', { name: 'Portals' });
const agentNav = (page: Page) => page.getByRole('navigation', { name: 'Agent tools' });
const announcer = (page: Page) => page.getByTestId('live-announcer');

/**
 * Full loads of every agent route (fresh mounts), then client-side navigation through the Agent
 * tools nav in one mount, ending on agent/profile/.
 */
async function walkAgent(page: Page): Promise<void> {
	for (const route of ['agent/', ...AGENT_ROUTES]) {
		await page.goto(route);
		await settle(page);
	}
	// A pass started by the last full load would open its dialog (4+ due) within this window, and
	// a modal dialog would block the client-side leg below: fail on the dialog itself instead.
	await page.waitForTimeout(1500);
	await expect(page.getByRole('alertdialog'), 'DueSearchesDialog on an agent page').toHaveCount(0);
	const steps: [RegExp | string, RegExp][] = [
		[/^Today/, /agent\/today\/$/],
		['Pipeline', /agent\/pipeline\/$/],
		['Contacts', /agent\/contacts\/$/],
		['Import', /agent\/import\/$/],
		['Profile', /agent\/profile\/$/]
	];
	for (const [name, url] of steps) {
		await agentNav(page)
			.getByRole('link', typeof name === 'string' ? { name, exact: true } : { name })
			.click();
		await expect(page).toHaveURL(url);
		await settle(page);
	}
	// Negative assertion window: a pass started by any agent page would fetch within it. The 08-27
	// mutation run (runAlerts forced on) proves it is long enough to catch a pass.
	await page.waitForTimeout(1500);
}

test('live key, 2 due: agent pages spend nothing; the first Renter arrival checks once', async ({
	page
}) => {
	const calls = await mockRentCast(page, () => ({ status: 404 }));
	await saveRentCastKey(page);
	await seedFromHome(page, 2);
	expect(calls).toHaveLength(0);

	await walkAgent(page);
	expect(calls, 'agent pages must never call RentCast').toEqual([]);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Data source' })).toHaveCount(0);
	await expect(announcer(page)).not.toHaveText(/Checked \d+ saved search/);
	const runs = await readRuns(page);
	expect(runs).toHaveLength(2);
	for (const run of runs) expect(run).toEqual({ lastRunAt: null, claimedAt: null });

	// First client-side arrival at a non-agent page: the pass runs there, silently for 1-3 due.
	await portals(page).getByRole('link', { name: 'Renter', exact: true }).click();
	await expect(page).toHaveURL(/renter\/$/);
	await settle(page);
	await expect.poll(() => calls.length).toBe(2);
	await expect(announcer(page)).toHaveText('Checked 2 saved searches. Nothing new.');
	const bar = page.getByRole('region', { name: 'Data source' });
	await expect(bar).toBeVisible();
	await expect(bar).toContainText('RentCast calls:');

	// Once per app open: agent and back to Renter in the same mount runs nothing more.
	await portals(page).getByRole('link', { name: 'Agent', exact: true }).click();
	await expect(page).toHaveURL(/agent\/$/);
	await settle(page);
	await portals(page).getByRole('link', { name: 'Renter', exact: true }).click();
	await expect(page).toHaveURL(/renter\/$/);
	await settle(page);
	await page.waitForTimeout(1000);
	expect(calls).toHaveLength(2);
});

test('live key, 5 due: no dialog on agent pages; it asks on the Renter arrival; Back to the agent portal withdraws it unspent', async ({
	page
}) => {
	const calls = await mockRentCast(page, () => ({ status: 404 }));
	await saveRentCastKey(page);
	await seedFromHome(page, 5);

	await walkAgent(page);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	expect(calls, 'agent pages must never call RentCast').toEqual([]);

	await portals(page).getByRole('link', { name: 'Renter', exact: true }).click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole('heading', { name: 'Check 5 saved searches for new listings?' })
	).toBeVisible();
	expect(calls).toHaveLength(0);

	// Browser Back while the dialog asks: withdrawn, settled as declined, no announcement.
	await page.goBack();
	await expect(page).toHaveURL(/agent\/profile\/$/);
	await expect(dialog).toHaveCount(0);
	expect(calls).toHaveLength(0);
	await expect(announcer(page)).not.toHaveText(DUE_DECLINED);

	// Latched: the next Renter arrival in this mount asks nothing.
	await portals(page).getByRole('link', { name: 'Renter', exact: true }).click();
	await expect(page).toHaveURL(/renter\/$/);
	await settle(page);
	await page.waitForTimeout(1000);
	await expect(dialog).toHaveCount(0);
	expect(calls).toHaveLength(0);
});
