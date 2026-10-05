// Shared E2E helpers for the Phase 4 data surfaces (04-24). A plain module, not a spec.
//
// RentCast is never reached: every spec calls blockRentCast(page) first, which aborts any request
// to https://api.rentcast.io/**. mockRentCast(page, handler) replaces that route with canned
// answers and records every GET it served. Unhandled requests still abort, so a real call cannot
// happen even if a handler forgets a case.
//
// Seeding writes rows straight into the app database ('tran') with the raw IndexedDB API, using
// the exact LedgerRow / SavedSearchRow shapes from src/lib/data/tables.ts (Syncable fields
// included). The database is opened without a version, so the seed never triggers an upgrade.
import { expect, type Page } from '@playwright/test';

export const RENTCAST_ROUTE = 'https://api.rentcast.io/**';

/** A low-entropy fake RentCast key (gitleaks Pitfall 13): passes the format check, never real. */
export const FAKE_RENTCAST_KEY = 'k'.repeat(32);

export interface RentCastCall {
	url: URL;
	/** Request headers, lower-cased names (Playwright's request.headers()). */
	headers: Record<string, string>;
}

export type RentCastAnswer = { status: number; body?: unknown } | 'abort';

export type RentCastHandler = (url: URL, headers: Record<string, string>) => RentCastAnswer;

const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET',
	'access-control-allow-headers': 'x-api-key, accept'
};

/** Aborts every RentCast request. Call at the start of every test, before any navigation. */
export async function blockRentCast(page: Page): Promise<void> {
	await page.route(RENTCAST_ROUTE, (route) => route.abort());
}

/**
 * Answers RentCast requests with `handler` and returns the live list of GETs it saw. Registered
 * after blockRentCast, so it takes precedence. CORS preflights (if Chromium sends one) are
 * answered permissively and not recorded.
 */
export async function mockRentCast(page: Page, handler: RentCastHandler): Promise<RentCastCall[]> {
	const calls: RentCastCall[] = [];
	await page.route(RENTCAST_ROUTE, async (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: CORS_HEADERS });
			return;
		}
		const url = new URL(request.url());
		const headers = request.headers();
		calls.push({ url, headers });
		const answer = handler(url, headers);
		if (answer === 'abort') {
			await route.abort();
			return;
		}
		await route.fulfill({
			status: answer.status,
			headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
			body: JSON.stringify(answer.body ?? {})
		});
	});
	return calls;
}

/** Opens Settings and waits until its onMount finished (Phase 3 marker). */
export async function openSettingsPage(page: Page): Promise<void> {
	await page.goto('settings/');
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	// The data runtime starts after hydration and fills the RentCast usage section; wait for it so
	// that late layout change cannot land under a click.
	await expect(page.locator('#rentcast-usage-meter-headline')).toBeVisible();
}

/** Saves a RentCast key through the real Settings card (session-only, survives reloads in this tab). */
export async function saveRentCastKey(page: Page, key: string = FAKE_RENTCAST_KEY): Promise<void> {
	await openSettingsPage(page);
	const input = page.getByLabel('RentCast API key', { exact: true });
	await input.fill(key);
	await input
		.locator('xpath=ancestor::form[1]')
		.getByRole('button', { name: 'Save key', exact: true })
		.click();
	await expect(page.locator('#key-rentcast')).toContainText(`Key ending in ${key.slice(-4)}`);
}

/** Sets the monthly cap through the Settings cap editor (1..50 only; 51+ opens the overage dialog). */
export async function saveCap(page: Page, cap: number): Promise<void> {
	const section = page.locator('#rentcast-usage');
	const input = section.getByLabel('Monthly call cap', { exact: true });
	await expect(input).toBeVisible();
	await input.fill(String(cap));
	await section.getByRole('button', { name: 'Save cap', exact: true }).click();
	await expect(section.getByText(`Cap saved: ${cap} calls a month.`)).toBeVisible();
}

interface SeedOptions {
	/** Reload after writing so the app runtime reads the rows. Default true. */
	reload?: boolean;
}

/**
 * Adds `n` settled ledger rows for the current UTC month (`intent: 'user'`). Status 200 is billed,
 * so each row counts toward the cap.
 */
export async function seedLedger(
	page: Page,
	n: number,
	status: number = 200,
	opts: SeedOptions = {}
): Promise<void> {
	await page.evaluate(
		async ({ n, status }) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			const now = Date.now();
			const d = new Date(now);
			const periodKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
			const iso = new Date(now).toISOString();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction('ledger', 'readwrite');
				const store = tx.objectStore('ledger');
				for (let i = 0; i < n; i++) {
					const at = now - (n - i) * 1000;
					store.add({
						id: crypto.randomUUID(),
						ownerId: 'local',
						createdAt: iso,
						updatedAt: iso,
						schemaVersion: 1,
						periodKey,
						at,
						endpoint: 'rental-listings',
						key: `rental-listings?limit=500&offset=0&status=Active&zipCode=7${String(i).padStart(4, '0')}`,
						intent: 'user',
						status,
						overCap: false,
						settledAt: at + 100
					});
				}
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		{ n, status }
	);
	if (opts.reload ?? true) await page.reload();
}

/**
 * Adds `n` renter saved searches (rental listings, distinct ZIP codes, so each costs one call).
 * `lastRunAt: null` makes every one due on the next open.
 */
export async function seedSavedSearches(
	page: Page,
	n: number,
	{ lastRunAt, reload = true }: { lastRunAt: number | null; reload?: boolean }
): Promise<void> {
	await page.evaluate(
		async ({ n, lastRunAt }) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			const iso = new Date().toISOString();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction('savedSearches', 'readwrite');
				const store = tx.objectStore('savedSearches');
				for (let i = 0; i < n; i++) {
					store.add({
						id: crypto.randomUUID(),
						ownerId: 'local',
						createdAt: iso,
						updatedAt: iso,
						schemaVersion: 1,
						portal: 'renter',
						name: `Rentals in 781${String(i).padStart(2, '0')}`,
						endpoint: 'rental-listings',
						params: {
							zipCode: `781${String(i).padStart(2, '0')}`,
							status: 'Active',
							limit: 500,
							offset: 0
						},
						lastRunAt,
						lastSeenAt: null,
						claimedAt: null
					});
				}
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		{ n, lastRunAt }
	);
	if (reload) await page.reload();
}
