// Shared E2E helpers for the Settings page (03-10 and the section plans 03-11..03-14).
// A plain module, not a spec. Relative page.goto paths keep every helper valid under both bases.
import { expect, type Locator, type Page } from '@playwright/test';

export { fakeKey, FAKE_PROVIDERS } from '../../support/fake-keys';

/** Opens Settings and waits until onMount finished loading the vault and DB. */
export async function openSettings(page: Page): Promise<void> {
	await page.goto('settings/');
	// Scoped: the header's PortalSwitcher nav carries its own data-hydrated flag.
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
}

export interface StorageStub {
	/** navigator.storage.persisted() result before any request. Default false. */
	persisted?: boolean;
	/** Whether navigator.storage.persist() grants. Default false. */
	grantOnRequest?: boolean;
	/** false removes persist/persisted (an unsupported browser). Default true. */
	supported?: boolean;
	/** estimate() result; null removes estimate(). Undefined keeps the real one. */
	estimate?: { usage: number; quota: number } | null;
}

/** Stubs the Storage API. Call BEFORE navigation (it is an init script). */
export async function stubStorage(page: Page, o: StorageStub): Promise<void> {
	await page.addInitScript((opts: StorageStub) => {
		const storage = navigator.storage as StorageManager & Record<string, unknown>;
		if (!storage) return;
		const define = (name: string, value: unknown) =>
			Object.defineProperty(storage, name, { value, configurable: true, writable: true });
		if (opts.supported === false) {
			define('persist', undefined);
			define('persisted', undefined);
		} else {
			let persisted = opts.persisted ?? false;
			define('persisted', async () => persisted);
			define('persist', async () => {
				if (opts.grantOnRequest) persisted = true;
				return persisted;
			});
		}
		if (opts.estimate === null) define('estimate', undefined);
		else if (opts.estimate) {
			const est = opts.estimate;
			define('estimate', async () => ({ usage: est.usage, quota: est.quota }));
		}
	}, o);
}

type CspWindow = Window & { __csp?: string[] };

/**
 * Installs a securitypolicyviolation collector before the first navigation (csp.spec pattern) and
 * returns a reader for `${violatedDirective} ${blockedURI}` entries on the current document.
 */
export async function cspCollector(page: Page): Promise<() => Promise<string[]>> {
	await page.addInitScript(() => {
		const w = window as CspWindow;
		w.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			w.__csp?.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
	return () => page.evaluate(() => (window as CspWindow).__csp ?? []);
}

/** The single polite live region rendered by the root layout. */
export function announcer(page: Page): Locator {
	return page.getByTestId('live-announcer');
}

/**
 * Fills the "{providerLabel} API key" field and clicks "Save key" in that field's form
 * (provider key cards from 03-11 on).
 */
export async function saveKey(page: Page, providerLabel: string, key: string): Promise<void> {
	const input = page.getByLabel(`${providerLabel} API key`, { exact: true });
	await input.fill(key);
	await input
		.locator('xpath=ancestor::form[1]')
		.getByRole('button', { name: 'Save key', exact: true })
		.click();
}
