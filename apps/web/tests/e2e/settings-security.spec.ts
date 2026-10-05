import { test, expect, type Page } from '@playwright/test';
import { announcer, fakeKey, openSettings, saveKey, stubStorage } from './helpers/settings';

// Key security section (03-12): PLAT-02 (remember on this device, opt-in) and PLAT-03 (passphrase
// lock: encrypted at rest, locked after reopening, persisted rate limit, lock/change/remove,
// cross-tab lock). Keys are planted fakeKey() values and passphrases are assembled at runtime.

test.describe.configure({ timeout: 120_000 });

const PASS = ['quiet', 'harbor', 'lantern', 'seven'].join(' ');
const NEW_PASS = ['amber', 'river', 'compass', 'nine'].join(' ');
const WRONG = ['wrong', 'guess', 'every', 'time'].join(' ');
const UNLOCK_WRONG = "That passphrase didn't unlock your keys. Check it and try again.";
const LOCKED_LINE = 'Unlock your keys in Key security to use or change this key.';

const card = (page: Page, id: string) => page.locator(`#key-${id}`);
const security = (page: Page) => page.locator('#key-security');
const radio = (page: Page, name: 'This tab only (default)' | 'Remember on this device') =>
	security(page).getByRole('radio', { name, exact: true });

interface RawSecrets {
	keys: Record<string, unknown>[];
	meta: Record<string, unknown>[];
	json: string;
}

/** Reads every row of tran-secrets with the raw IndexedDB API (no Dexie, no vault). */
async function readSecrets(page: Page): Promise<RawSecrets> {
	const json = await page.evaluate(
		() =>
			new Promise<string>((resolve, reject) => {
				const req = indexedDB.open('tran-secrets');
				req.onerror = () => reject(req.error);
				req.onsuccess = () => {
					const db = req.result;
					const out: Record<string, unknown[]> = { keys: [], meta: [] };
					const names = ['keys', 'meta'].filter((n) => db.objectStoreNames.contains(n));
					if (names.length === 0) {
						db.close();
						resolve(JSON.stringify(out));
						return;
					}
					const tx = db.transaction(names, 'readonly');
					for (const n of names) {
						const r = tx.objectStore(n).getAll();
						r.onsuccess = () => (out[n] = r.result);
					}
					tx.oncomplete = () => {
						db.close();
						resolve(
							JSON.stringify(out, (_k, v: unknown) =>
								v instanceof Uint8Array
									? Array.from(v)
									: v instanceof ArrayBuffer
										? Array.from(new Uint8Array(v))
										: v
							)
						);
					};
					tx.onerror = () => reject(tx.error);
				};
			})
	);
	const parsed = JSON.parse(json) as Omit<RawSecrets, 'json'>;
	return { ...parsed, json };
}

async function chooseRemember(page: Page): Promise<void> {
	await radio(page, 'Remember on this device').click();
	await expect(announcer(page)).toHaveText('Keys will be remembered on this device.');
	await expect(radio(page, 'Remember on this device')).toBeChecked();
}

async function saveAndWait(page: Page, label: string, id: string, key: string): Promise<void> {
	await saveKey(page, label, key);
	await expect(card(page, id)).toContainText(`Key ending in ${key.slice(-4)}`);
}

function lockDialog(page: Page) {
	return page.getByRole('dialog');
}

async function addPassphrase(page: Page, pass: string): Promise<void> {
	await security(page).getByRole('button', { name: 'Add a passphrase' }).click();
	const dialog = lockDialog(page);
	await dialog.getByLabel('Passphrase', { exact: true }).fill(pass);
	await dialog.getByLabel('Confirm passphrase', { exact: true }).fill(pass);
	await dialog.getByRole('checkbox').check();
	await dialog.getByRole('button', { name: 'Lock keys' }).click();
	await expect(announcer(page)).toHaveText(
		'Passphrase lock added. Your remembered keys are encrypted.'
	);
	await expect(dialog).toBeHidden();
}

/** Submits the unlock form; resolves once the attempt finished (not busy any more). */
async function tryUnlock(page: Page, pass: string): Promise<void> {
	await security(page).getByLabel('Passphrase', { exact: true }).fill(pass);
	await security(page).getByRole('button', { name: 'Unlock keys' }).click();
	await expect(security(page).getByRole('button', { name: 'Unlocking…' })).toHaveCount(0);
}

async function unlock(page: Page, pass: string): Promise<void> {
	await tryUnlock(page, pass);
	await expect(announcer(page)).toHaveText('Keys unlocked.');
}

async function expectLocked(page: Page, ids: string[]): Promise<void> {
	for (const id of ids) {
		await expect(card(page, id).getByText('Locked', { exact: true })).toBeVisible();
		await expect(card(page, id)).toContainText(LOCKED_LINE);
	}
	await expect(page.getByText(/Key ending in/)).toHaveCount(0);
	await expect(security(page).getByLabel('Passphrase', { exact: true })).toBeVisible();
}

/** Remember mode, two saved keys and a passphrase lock; returns the planted keys. */
async function lockedSetup(page: Page): Promise<{ anthropic: string; openai: string }> {
	const keys = { anthropic: fakeKey('anthropic', 'L'), openai: fakeKey('openai', 'M') };
	await openSettings(page);
	await chooseRemember(page);
	await saveAndWait(page, 'Anthropic', 'anthropic', keys.anthropic);
	await saveAndWait(page, 'OpenAI', 'openai', keys.openai);
	await addPassphrase(page, PASS);
	return keys;
}

test('remember mode persists across tabs', async ({ page, context }) => {
	const key = fakeKey('anthropic', 'R');
	await openSettings(page);
	await expect(radio(page, 'This tab only (default)')).toBeChecked();
	await chooseRemember(page);
	await saveAndWait(page, 'Anthropic', 'anthropic', key);
	await expect(card(page, 'anthropic').getByText('Remembered on this device')).toBeVisible();

	const other = await context.newPage();
	await openSettings(other);
	await expect(card(other, 'anthropic').getByText('Remembered on this device')).toBeVisible();
	await expect(card(other, 'anthropic')).toContainText(`Key ending in ${key.slice(-4)}`);
	await expect(radio(other, 'Remember on this device')).toBeChecked();
});

test('switching back to This tab only removes the stored copy but keeps this tab', async ({
	page,
	context
}) => {
	const key = fakeKey('openai', 'S');
	await openSettings(page);
	await chooseRemember(page);
	await saveAndWait(page, 'OpenAI', 'openai', key);
	expect((await readSecrets(page)).keys).toHaveLength(1);

	await radio(page, 'This tab only (default)').click();
	await expect(announcer(page)).toHaveText(
		"Keys removed from this device's storage. They'll stay available until you close this tab."
	);
	await expect(radio(page, 'This tab only (default)')).toBeChecked();
	await expect.poll(async () => (await readSecrets(page)).keys.length).toBe(0);
	await expect(card(page, 'openai')).toContainText(`Key ending in ${key.slice(-4)}`);

	const other = await context.newPage();
	await openSettings(other);
	await expect(card(other, 'openai').getByText('Not added', { exact: true })).toBeVisible();
});

test('set passphrase validates on submit and encrypts every key at rest', async ({ page }) => {
	const keys = { anthropic: fakeKey('anthropic', 'E'), gemini: fakeKey('gemini', 'F') };
	await openSettings(page);
	await chooseRemember(page);
	await saveAndWait(page, 'Anthropic', 'anthropic', keys.anthropic);
	await saveAndWait(page, 'Google Gemini', 'gemini', keys.gemini);

	await security(page).getByRole('button', { name: 'Add a passphrase' }).click();
	const dialog = lockDialog(page);
	await expect(dialog.getByRole('heading', { name: 'Lock your remembered keys' })).toBeVisible();
	const pass = dialog.getByLabel('Passphrase', { exact: true });
	const confirm = dialog.getByLabel('Confirm passphrase', { exact: true });
	const lockKeys = dialog.getByRole('button', { name: 'Lock keys' });
	await expect(pass).toBeFocused();

	const short = PASS.slice(0, 11);
	await pass.fill(short);
	await confirm.fill(short);
	await lockKeys.click();
	await expect(dialog.getByText('Use at least 12 characters.')).toBeVisible();
	await expect(pass).toBeFocused();
	await expect(pass).toHaveValue('');

	await pass.fill(PASS);
	await confirm.fill(NEW_PASS);
	await lockKeys.click();
	await expect(dialog.getByText("The passphrases don't match.")).toBeVisible();
	await expect(confirm).toBeFocused();

	await pass.fill(PASS);
	await confirm.fill(PASS);
	await lockKeys.click();
	await expect(
		dialog.getByText('Check the box to confirm you understand, then try again.')
	).toBeVisible();
	await expect(dialog.getByRole('checkbox')).toBeFocused();

	await dialog.getByRole('checkbox').check();
	await pass.fill(PASS);
	await confirm.fill(PASS);
	await lockKeys.click();
	await expect(announcer(page)).toHaveText(
		'Passphrase lock added. Your remembered keys are encrypted.'
	);
	await expect(dialog).toBeHidden();
	await expect(
		security(page).getByText(
			'Your remembered keys are unlocked until you close this tab or lock them.'
		)
	).toBeVisible();

	// Raw IndexedDB: no planted key anywhere, every key row sealed, lock record at full strength.
	const raw = await readSecrets(page);
	expect(raw.json).not.toContain(keys.anthropic);
	expect(raw.json).not.toContain(keys.gemini);
	expect(raw.json).not.toContain(PASS);
	expect(raw.keys).toHaveLength(2);
	for (const row of raw.keys) {
		expect(row.value).toBeUndefined();
		expect(row.box).toBeTruthy();
	}
	const vaultRow = raw.meta.find((r) => r.id === 'vault');
	expect(vaultRow?.iterations).toBe(600000);
	expect(vaultRow?.salt as number[]).toHaveLength(16);
});

test('locked after reopening until the passphrase is entered', async ({ page, context }) => {
	const keys = await lockedSetup(page);

	const reopened = await context.newPage();
	await openSettings(reopened);
	await expectLocked(reopened, ['anthropic', 'openai']);

	await tryUnlock(reopened, WRONG);
	await expect(security(reopened).getByText(UNLOCK_WRONG)).toBeVisible();
	await expect(security(reopened).getByLabel('Passphrase', { exact: true })).toBeFocused();
	await expect(security(reopened).getByLabel('Passphrase', { exact: true })).toHaveValue('');

	await unlock(reopened, PASS);
	await expect(card(reopened, 'anthropic')).toContainText(
		`Key ending in ${keys.anthropic.slice(-4)}`
	);
	await expect(card(reopened, 'openai')).toContainText(`Key ending in ${keys.openai.slice(-4)}`);

	// Same tab reload keeps the data key in sessionStorage: still unlocked.
	await reopened.reload();
	await expect(reopened.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	await expect(card(reopened, 'anthropic')).toContainText(
		`Key ending in ${keys.anthropic.slice(-4)}`
	);

	const another = await context.newPage();
	await openSettings(another);
	await expectLocked(another, ['anthropic', 'openai']);
});

test('cooldown after 5 wrong passphrases persists across reload, then doubles', async ({
	page: setupPage,
	context
}) => {
	await lockedSetup(setupPage);

	const page = await context.newPage();
	await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
	await openSettings(page);
	await expectLocked(page, ['anthropic', 'openai']);

	const field = security(page).getByLabel('Passphrase', { exact: true });
	const unlockButton = security(page).getByRole('button', { name: 'Unlock keys' });
	for (let i = 0; i < 5; i++) {
		await tryUnlock(page, WRONG);
		await expect(security(page).getByText(UNLOCK_WRONG)).toBeVisible();
	}
	await expect(
		security(page).getByText('Too many attempts. You can try again in 30 seconds.')
	).toBeVisible();
	await expect(field).toBeDisabled();
	await expect(unlockButton).toBeDisabled();
	await expect(unlockButton).toHaveAttribute('aria-disabled', 'true');
	await expect(announcer(page)).toHaveText('Too many attempts. Try again in 30 seconds.');
	await expect(security(page).locator('[aria-live="off"]')).toContainText('Too many attempts.');

	await page.reload();
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	await expect(
		security(page).getByText(/Too many attempts\. You can try again in \d+ seconds\./)
	).toBeVisible();
	await expect(field).toBeDisabled();

	await page.clock.fastForward(31_000);
	await expect(field).toBeEnabled();
	await expect(unlockButton).toBeEnabled();
	await expect(announcer(page)).toHaveText('You can try your passphrase again.');

	await tryUnlock(page, WRONG);
	await expect(
		security(page).getByText('Too many attempts. You can try again in 60 seconds.')
	).toBeVisible();
	await expect(field).toBeDisabled();

	await page.clock.fastForward(61_000);
	await expect(field).toBeEnabled();
	await unlock(page, PASS);
	await expect(page.getByText(/Key ending in/)).toHaveCount(2);
});

test('lock now, change passphrase and remove passphrase', async ({ page, context }) => {
	const keys = await lockedSetup(page);
	const sec = security(page);

	await sec.getByRole('button', { name: 'Lock now' }).click();
	await expect(announcer(page)).toHaveText('Keys locked.');
	await expectLocked(page, ['anthropic', 'openai']);
	await unlock(page, PASS);

	await sec.getByRole('button', { name: 'Change passphrase' }).click();
	const dialog = lockDialog(page);
	await expect(dialog.getByRole('heading', { name: 'Change your passphrase' })).toBeVisible();
	await expect(dialog.getByLabel('Current passphrase', { exact: true })).toBeFocused();
	await dialog.getByLabel('Current passphrase', { exact: true }).fill(WRONG);
	await dialog.getByLabel('New passphrase', { exact: true }).fill(NEW_PASS);
	await dialog.getByLabel('Confirm new passphrase', { exact: true }).fill(NEW_PASS);
	await dialog.getByRole('button', { name: 'Change passphrase' }).click();
	await expect(dialog.getByText("That isn't your current passphrase.")).toBeVisible();
	await expect(dialog.getByLabel('Current passphrase', { exact: true })).toBeFocused();

	await dialog.getByLabel('Current passphrase', { exact: true }).fill(PASS);
	await dialog.getByLabel('New passphrase', { exact: true }).fill(NEW_PASS);
	await dialog.getByLabel('Confirm new passphrase', { exact: true }).fill(NEW_PASS);
	await dialog.getByRole('button', { name: 'Change passphrase' }).click();
	await expect(announcer(page)).toHaveText('Passphrase changed.');
	await expect(dialog).toBeHidden();

	const other = await context.newPage();
	await openSettings(other);
	await expectLocked(other, ['anthropic', 'openai']);
	await tryUnlock(other, PASS);
	await expect(security(other).getByText(UNLOCK_WRONG)).toBeVisible();
	await unlock(other, NEW_PASS);
	await other.close();

	await sec.getByRole('button', { name: 'Remove passphrase' }).click();
	await expect(announcer(page)).toHaveText(
		'Passphrase lock removed. Your keys are still remembered on this device.'
	);
	await expect(sec.getByRole('button', { name: 'Add a passphrase' })).toBeVisible();
	const raw = await readSecrets(page);
	expect(raw.keys).toHaveLength(2);
	for (const row of raw.keys) expect(typeof row.value).toBe('string');
	expect(raw.json).toContain(keys.anthropic);
	expect(raw.meta.find((r) => r.id === 'vault')).toBeUndefined();
});

test('locking in one tab locks every other open Tran tab', async ({ page, context }) => {
	await lockedSetup(page);
	const other = await context.newPage();
	await openSettings(other);
	await unlock(other, PASS);
	await expect(other.getByText(/Key ending in/)).toHaveCount(2);

	await security(page).getByRole('button', { name: 'Lock now' }).click();
	await expect(announcer(page)).toHaveText('Keys locked.');
	await expectLocked(other, ['anthropic', 'openai']);
	await expect(announcer(other)).toHaveText('Your keys were locked in another Tran tab.');
});

test('switching to This tab only while locked is refused', async ({ page, context }) => {
	await lockedSetup(page);
	const locked = await context.newPage();
	await openSettings(locked);
	await expectLocked(locked, ['anthropic', 'openai']);

	await radio(locked, 'This tab only (default)').click();
	await expect(announcer(locked)).toHaveText(LOCKED_LINE);
	await expect(radio(locked, 'Remember on this device')).toBeChecked();
	await expect(radio(locked, 'This tab only (default)')).not.toBeChecked();
	await expect(security(locked).getByLabel('Passphrase', { exact: true })).toBeFocused();
	expect((await readSecrets(locked)).keys).toHaveLength(2);
});

test('forgot passphrase path forgets all keys', async ({ page, context }) => {
	await lockedSetup(page);
	const locked = await context.newPage();
	await openSettings(locked);
	await expectLocked(locked, ['anthropic', 'openai']);

	const forgot = security(locked).getByRole('button', { name: 'Forgot your passphrase?' });
	await expect(forgot).toHaveAttribute('aria-expanded', 'false');
	await forgot.click();
	await expect(forgot).toHaveAttribute('aria-expanded', 'true');
	await expect(
		security(locked).getByText(
			"Tran can't reset it, because the passphrase is never stored. To start over, forget all keys and paste them in again."
		)
	).toBeVisible();

	await security(locked).getByRole('button', { name: 'Forget all keys' }).click();
	await locked
		.getByRole('alertdialog')
		.getByRole('button', { name: 'Forget all keys', exact: true })
		.click();
	await expect(announcer(locked)).toHaveText('All API keys forgotten.');
	for (const id of ['rentcast', 'anthropic', 'openai', 'gemini', 'openrouter']) {
		await expect(card(locked, id).getByText('Not added', { exact: true })).toBeVisible();
	}
	await expect(radio(locked, 'This tab only (default)')).toBeChecked();
	await expect(security(locked).getByRole('button', { name: 'Unlock keys' })).toHaveCount(0);
});

test('honesty callout states what a passphrase does and does not do', async ({ page }) => {
	await openSettings(page);
	const callout = security(page);
	await expect(
		callout.getByRole('heading', { name: "What a passphrase does, and what it doesn't" })
	).toBeVisible();
	await expect(callout.locator('ul li')).toHaveText([
		"It encrypts your remembered keys on this device, so someone who copies this browser's stored data can't read them without the passphrase.",
		"It doesn't protect keys while they're unlocked. A malicious browser extension or script running on this page could still read them.",
		"Tran can't recover a forgotten passphrase. You'd forget your keys and paste them in again."
	]);
});

test('choosing remember asks for persistent storage inside the click', async ({ page }) => {
	await stubStorage(page, { persisted: false, grantOnRequest: true });
	await page.addInitScript(() => {
		const storage = navigator.storage as StorageManager & { persist: () => Promise<boolean> };
		const w = window as Window & { __persistCalls?: number };
		w.__persistCalls = 0;
		const original = storage.persist.bind(storage);
		Object.defineProperty(storage, 'persist', {
			configurable: true,
			writable: true,
			value: () => {
				w.__persistCalls = (w.__persistCalls ?? 0) + 1;
				return original();
			}
		});
	});
	await openSettings(page);
	expect(
		await page.evaluate(() => (window as Window & { __persistCalls?: number }).__persistCalls)
	).toBe(0);
	await chooseRemember(page);
	expect(
		await page.evaluate(() => (window as Window & { __persistCalls?: number }).__persistCalls)
	).toBe(1);
});
