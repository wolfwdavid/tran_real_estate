import { test, expect, type Page } from '@playwright/test';
import { announcer, cspCollector, openSettings } from './helpers/settings';

// PLAT-06: the Install the app section renders exactly one honest state. Headless Chromium never
// fires beforeinstallprompt by itself, so the installable path dispatches a synthetic one at
// DOMContentLoaded, i.e. BEFORE Svelte hydrates. Only static/pwa-capture.js (a head script) can
// catch it then; the Settings UI reads window.__tranInstallPrompt on mount.

type PromptWindow = Window & { __promptCalls?: number };

const install = (page: Page) => page.locator('#install');
const installButton = (page: Page) => install(page).getByRole('button', { name: 'Install app' });
const INSTALLED_TEXT = "Tran is installed on this device. You're using the installed app.";
const UNSUPPORTED_TEXT =
	"This browser doesn't offer to install Tran from this page. You can keep using it in a browser tab, or open it in Chrome, Edge, or Safari on iPhone to install it.";

async function firePromptBeforeHydration(page: Page): Promise<void> {
	await page.addInitScript(() => {
		document.addEventListener('DOMContentLoaded', () => {
			const w = window as PromptWindow;
			const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
				prompt: () => {
					w.__promptCalls = (w.__promptCalls ?? 0) + 1;
					return Promise.resolve();
				},
				userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
			});
			window.dispatchEvent(e);
		});
	});
}

test('installable via a pre-hydration beforeinstallprompt, then appinstalled', async ({ page }) => {
	const violations = await cspCollector(page);
	await firePromptBeforeHydration(page);
	await openSettings(page);

	await expect(installButton(page)).toBeVisible();
	await expect(
		install(page).getByText('Install Tran to open it from your home screen or desktop')
	).toBeVisible();

	await installButton(page).click();
	await expect(announcer(page)).toHaveText('Tran was installed.');
	expect(await page.evaluate(() => (window as PromptWindow).__promptCalls)).toBe(1);

	await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
	await expect(install(page).getByText(INSTALLED_TEXT)).toBeVisible();
	await expect(installButton(page)).toHaveCount(0);

	expect(await violations()).toEqual([]);
});

test.describe('on iPhone', () => {
	test.use({
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
	});

	test('shows the three Add to Home Screen steps and no install button', async ({ page }) => {
		await openSettings(page);
		await expect(install(page).getByText('To install on iPhone or iPad:')).toBeVisible();
		await expect(install(page).locator('ol > li')).toHaveText([
			"Tap the Share button in your browser's toolbar or menu.",
			'Choose Add to Home Screen.',
			'Tap Add.'
		]);
		await expect(installButton(page)).toHaveCount(0);
	});
});

test('running installed (display-mode: standalone) says so', async ({ page }) => {
	await page.addInitScript(() => {
		const original = window.matchMedia.bind(window);
		window.matchMedia = (q: string) => {
			const real = original(q);
			if (q !== '(display-mode: standalone)') return real;
			// `matches` is a prototype getter, so shadow it with an own property.
			return Object.defineProperty(Object.create(real) as MediaQueryList, 'matches', {
				value: true
			});
		};
	});
	await openSettings(page);
	await expect(install(page).getByText(INSTALLED_TEXT)).toBeVisible();
	await expect(installButton(page)).toHaveCount(0);
});

test('desktop Chromium with no install event gets the honest unsupported copy', async ({
	page
}) => {
	await openSettings(page);
	await expect(install(page).getByText(UNSUPPORTED_TEXT)).toBeVisible();
	await expect(installButton(page)).toHaveCount(0);
});
