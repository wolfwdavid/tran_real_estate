import { test, expect } from '@playwright/test';
import { announcer, openSettings } from './helpers/settings';

// The Settings shell contract (03-10): fixed section order with reserved slots, static copy in the
// prerendered HTML, lazy hydration, one live region, the CSP probe, blocked storage, and cross-tab
// announcements. Phase 4 (04-23) ships slot 2, "RentCast usage".

const SECTIONS = [
	['api-keys', 'API keys'],
	['rentcast-usage', 'RentCast usage'],
	['key-security', 'Key security'],
	['backup', 'Backup and restore'],
	['storage', 'Storage'],
	['install', 'Install the app']
] as const;

test('prerendered HTML has the static shell in order and no reserved slots', async ({ page }) => {
	const res = await page.request.get('settings/');
	expect(res.status()).toBe(200);
	const html = await res.text();

	expect(html).toContain('Checking this browser');
	expect(html).toContain('On this page');

	let last = -1;
	for (const [id] of SECTIONS) {
		const at = html.indexOf(`id="${id}"`);
		expect(at, `id="${id}" present`).toBeGreaterThan(-1);
		expect(at, `id="${id}" after the previous section`).toBeGreaterThan(last);
		last = at;
	}
	// Reserved for Phases 5 and 10: not rendered yet.
	for (const id of ['ai-drafting', 'getting-started']) {
		expect(html).not.toContain(`id="${id}"`);
	}
});

test('hydrated page shows the heading, section nav and h2s in registry order', async ({ page }) => {
	await openSettings(page);
	await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

	const links = page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link');
	await expect(links).toHaveText(SECTIONS.map(([, label]) => label));
	for (const [i, [id]] of SECTIONS.entries()) {
		expect(await links.nth(i).getAttribute('href')).toMatch(new RegExp(`#${id}$`));
	}

	// Section h2s only (the site footer has its own headings).
	await expect(page.getByRole('main').locator('section > h2')).toHaveText(
		SECTIONS.map(([, label]) => label)
	);
	await expect(page.getByText('Checking this browser…')).toHaveCount(0);
});

for (const route of ['settings/', '']) {
	test(`exactly one polite live region on ${JSON.stringify(route)}`, async ({ page }) => {
		await page.goto(route);
		const region = page.getByTestId('live-announcer');
		await expect(region).toHaveCount(1);
		await expect(region).toHaveAttribute('role', 'status');
		await expect(region).toHaveAttribute('aria-live', 'polite');
		// SvelteKit's own route announcer (#svelte-announcer) is the only other live region.
		await expect(page.locator('[aria-live]:not(#svelte-announcer)')).toHaveCount(1);
	});
}

test('the CSP transition probe works after hydration', async ({ page }) => {
	await openSettings(page);
	const toggle = page.getByTestId('csp-transition-toggle');
	const target = page.getByTestId('csp-transition-target');
	await toggle.click();
	await expect(target).toBeVisible();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await toggle.click();
	await expect(target).toBeHidden();
});

test('blocked site storage shows the page-level alert and keeps the page working', async ({
	page
}) => {
	await page.addInitScript(() => {
		indexedDB.open = () => {
			throw new DOMException('blocked', 'SecurityError');
		};
	});
	await openSettings(page);
	// Scoped to main: the live announcer (outside main) carries the same words.
	await expect(
		page.getByRole('main').getByText('This browser is blocking site storage')
	).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
	await expect(announcer(page)).toHaveText(/This browser is blocking site storage/);
});

test('a change in another Tran tab is announced in this tab', async ({ context }) => {
	const pageB = await context.newPage();
	await openSettings(pageB);
	const pageA = await context.newPage();
	await openSettings(pageA);

	await pageA.evaluate(() =>
		new BroadcastChannel('tran-vault').postMessage({ type: 'mode-changed', from: 'test' })
	);
	await expect(announcer(pageB)).toHaveText('Key storage was changed in another Tran tab.');
});
