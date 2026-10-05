// Mocked-key state for renter E2E specs (06-09). A plain module, not a spec.
//
// withRentCastKey writes a fake RentCast key straight into the Phase 3 vault's session store,
// so a spec reaches live mode without a trip through Settings. The vault keeps session-only keys
// as plain JSON in sessionStorage: src/lib/storage/secrets/vault.ts, `SESSION_KEY =
// 'tran.vault.session.v1'` (line 76), written by #writeSession as `{ [providerId]: key }` and read
// back by #loadSession at startup. Session keys are never encrypted (only remembered keys under
// a passphrase lock are sealed), so the format is reproducible here.
//
// The key is low-entropy and obviously fake (gitleaks-safe); RentCast is mocked, so it is never
// sent anywhere real.
import type { Page } from '@playwright/test';
import { expect } from './network';

/** The Phase 4 unit-harness fake key. Never real. */
export const TEST_RENTCAST_KEY = 'test-key-not-real';

/** sessionStorage key of the vault's session-only store (vault.ts line 76). */
export const VAULT_SESSION_KEY = 'tran.vault.session.v1';
/** Marks the tab as seeded so a later "remove key" in the test is not undone on navigation. */
const SEEDED_FLAG = 'tran.e2e.rentcast-seeded';

/**
 * Seeds the fake RentCast key into this tab's vault session store before any page script runs.
 * Call before the first navigation. Seeds once per tab: if a test later removes the key, the
 * next navigation does not put it back.
 */
export async function withRentCastKey(page: Page): Promise<void> {
	await page.addInitScript(
		({ storeKey, flag, key }) => {
			try {
				if (sessionStorage.getItem(flag) !== null) return;
				sessionStorage.setItem(flag, '1');
				let store: Record<string, unknown> = {};
				try {
					const parsed: unknown = JSON.parse(sessionStorage.getItem(storeKey) ?? '{}');
					if (parsed && typeof parsed === 'object') store = parsed as Record<string, unknown>;
				} catch {
					store = {};
				}
				store.rentcast = key;
				sessionStorage.setItem(storeKey, JSON.stringify(store));
			} catch {
				// sessionStorage unavailable (opaque origin, e.g. about:blank): nothing to seed.
			}
		},
		{ storeKey: VAULT_SESSION_KEY, flag: SEEDED_FLAG, key: TEST_RENTCAST_KEY }
	);
}

const statusBar = (page: Page) => page.getByRole('region', { name: 'Data source' });

/** The DataStatusBar shows the live variant: the RentCast usage meter, not "Sample data". */
export async function expectLiveMode(page: Page): Promise<void> {
	const bar = statusBar(page);
	await expect(bar).toContainText('RentCast calls:');
	await expect(bar).not.toContainText('Sample data');
}

/** The DataStatusBar shows the sample variant ("Sample data"). */
export async function expectSampleMode(page: Page): Promise<void> {
	const bar = statusBar(page);
	await expect(bar).toContainText('Sample data');
	await expect(bar).not.toContainText('RentCast calls:');
}
