import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fakeKey, FAKE_PROVIDERS } from '../support/fake-keys';
import { seedSavedSearches } from './helpers/data';
import { CHROME_ROUTES, INVESTOR_ROUTES, ROUTES, RENTER_ROUTES, STUDIO_ROUTES } from './routes';
import { RENTER_TEST_OPTIONS, expect, test } from './support/network';

// The keyed half of the accessibility gate (10-21; ROADMAP Phase 10 success criterion 5; 10-UI-SPEC
// Accessibility Contract): axe over every prerendered route with a real-format fake key saved for
// every provider, on both bases. The keyless half is a11y.spec.ts. Titles follow the launch audit
// contract (scripts/launch-audit.mjs AXE_KEYED): `axe (keyed) reports no WCAG A/AA violations on
// "<route>"`.
//
// Keyed means live mode, so this spec also proves no request reaches a real provider:
// - the shared harness (support/network) aborts and records every non-local request and fails the
//   test on any it did not expect;
// - the five provider hosts are routed after it to a recorder that aborts and records (the 10-20
//   setup-rentcast pattern), so the test can say exactly which calls the page tried;
// - the seed includes data that spends (tasks/lessons.md 2026-10-07: "with a real key" needs a
//   keyed test with spend-triggering data): one saved search that is due now. The (app) layout's
//   check-on-open pass runs it on every portal route except the agent CRM (08-27), so those routes
//   must try exactly that one RentCast call, and every other route must try none. No route may
//   call an AI provider: AI only runs on a user's click.

test.use(RENTER_TEST_OPTIONS);
test.describe.configure({ timeout: 60_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The provider hosts in the CSP connect-src (scripts/assert-csp.mjs CONNECT, minus Web3Forms). */
const PROVIDER_HOSTS = [
	'https://api.rentcast.io/**',
	'https://api.anthropic.com/**',
	'https://api.openai.com/**',
	'https://generativelanguage.googleapis.com/**',
	'https://openrouter.ai/**'
] as const;

/** The vault's session-only store and the AI provider preference (support/seed.ts format). */
const VAULT_SESSION_KEY = 'tran.vault.session.v1';
const AI_PROVIDER_PREF = 'tran.ai.provider';

/** The one saved search the seed makes due; its check-on-open run is a rental listings call. */
const SAVED_SEARCH_PATH = '/v1/listings/rental/long-term';

/**
 * Routes whose (app) layout runs the check-on-open saved-search pass: every portal page except the
 * agent CRM (`agent/` and its CRM sub-pages), whose layout turns it off (08-27, SC5).
 */
const SPENDING_ROUTES: ReadonlySet<string> = new Set([
	...RENTER_ROUTES,
	'investor/',
	'settings/',
	'setup/rentcast/',
	...INVESTOR_ROUTES,
	...STUDIO_ROUTES
]);

/** Provider requests the page tried, as `METHOD url`. Every one was aborted. */
let tried: string[] = [];

/** Seeds one fake key per provider into the vault session store before any page script runs. */
async function seedKeys(page: Page): Promise<void> {
	const keys = Object.fromEntries(FAKE_PROVIDERS.map((p) => [p, fakeKey(p)]));
	await page.addInitScript(
		({ storeKey, prefKey, keys }) => {
			try {
				sessionStorage.setItem(storeKey, JSON.stringify(keys));
				localStorage.setItem(prefKey, JSON.stringify('anthropic'));
			} catch {
				// Opaque origin (about:blank): nothing to seed.
			}
		},
		{ storeKey: VAULT_SESSION_KEY, prefKey: AI_PROVIDER_PREF, keys }
	);
}

/**
 * Opens the agent CRM (which creates the app database and never runs saved searches) and adds one
 * saved search that is due now.
 */
async function seedDueSearch(page: Page): Promise<void> {
	await page.goto('agent/');
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await page.waitForFunction(async () =>
		(await indexedDB.databases()).some((d) => d.name === 'tran')
	);
	const stores = await page.evaluate(
		() =>
			new Promise<string[]>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onsuccess = () => {
					const names = [...req.result.objectStoreNames];
					req.result.close();
					resolve(names);
				};
				req.onerror = () => reject(req.error);
			})
	);
	expect(stores, 'app database is open before seeding').toContain('savedSearches');
	await seedSavedSearches(page, 1, { lastRunAt: null, reload: false });
}

test.beforeEach(async ({ page }) => {
	tried = [];
	// Registered after the harness's deny-all, so these win for the provider hosts.
	for (const host of PROVIDER_HOSTS) {
		await page.route(host, async (route) => {
			tried.push(`${route.request().method()} ${route.request().url()}`);
			await route.abort();
		});
	}
	await seedKeys(page);
	await seedDueSearch(page);
	expect(tried, 'the agent CRM tried a provider call while seeding').toEqual([]);
});

/** RentCast calls the page tried for the due saved search (CORS preflights excluded). */
const savedSearchCalls = () =>
	tried.filter((t) => {
		const [method, url] = t.split(' ');
		const u = new URL(url);
		return method === 'GET' && u.host === 'api.rentcast.io' && u.pathname === SAVED_SEARCH_PATH;
	});

async function expectNoViolations(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	// An empty violations list is only meaningful if axe evaluated rules against real content.
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

test('keyed seed: Settings shows a saved key for every provider', async ({ page }) => {
	await page.goto('settings/');
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	for (const provider of FAKE_PROVIDERS) {
		await expect(page.locator(`#key-${provider}`)).toContainText(
			`Key ending in ${fakeKey(provider).slice(-4)}`
		);
	}
});

for (const route of ROUTES) {
	test(`axe (keyed) reports no WCAG A/AA violations on ${JSON.stringify(route)}`, async ({
		page
	}) => {
		tried = [];
		await page.goto(route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await expect(page.locator('h1').first()).toBeVisible();
		// Hydrated: the header's portal switcher marks itself once its script ran.
		if (CHROME_ROUTES.includes(route)) {
			await expect(page.locator('nav[data-hydrated]')).toHaveCount(1);
		}
		if (SPENDING_ROUTES.has(route)) {
			// Live mode is real: the due search was tried exactly once (and aborted).
			await expect.poll(() => savedSearchCalls().length).toBe(1);
		}

		await expectNoViolations(page, `${JSON.stringify(route)} (keyed)`);

		const ai = tried.filter((t) => !t.includes('//api.rentcast.io/'));
		expect(ai, `AI provider calls on ${JSON.stringify(route)}`).toEqual([]);
		const rentcast = tried.filter((t) => !t.startsWith('OPTIONS '));
		expect(rentcast, `RentCast calls on ${JSON.stringify(route)}`).toEqual(
			SPENDING_ROUTES.has(route) ? savedSearchCalls() : []
		);
		expect(savedSearchCalls().length).toBeLessThanOrEqual(1);
	});
}
