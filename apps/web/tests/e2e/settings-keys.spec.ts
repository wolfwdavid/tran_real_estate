import { test, expect, type Page } from '@playwright/test';
import { PROVIDERS } from '@tran/core';
import { announcer, fakeKey, openSettings, saveKey } from './helpers/settings';

// API keys section (03-11): PLAT-01 (paste, show/hide, save, last4 only, replace/remove, forget
// all with confirmation, cross-tab) and PLAT-02 (session-only by default). Every key is a planted
// fakeKey() assembled at runtime; none is ever a literal here.

const SESSION_KEY = 'tran.vault.session.v1';

const card = (page: Page, id: string) => page.locator(`#key-${id}`);
const sessionBlob = (page: Page) =>
	page.evaluate((k) => window.sessionStorage.getItem(k), SESSION_KEY);

test('five cards in fixed order with hosts, notes and same-tab Get a key links', async ({
	page
}) => {
	await openSettings(page);
	const names = page.locator('#api-keys article h3');
	await expect(names).toHaveText([
		'RentCast',
		'Anthropic',
		'OpenAI',
		'Google Gemini',
		'OpenRouter'
	]);

	for (const p of PROVIDERS) {
		const c = card(page, p.id);
		await expect(c).toHaveAttribute('aria-labelledby', `key-${p.id}-name`);
		// The host is the first <code> in every card; AI cards add a second one for the model field.
		await expect(c.locator('code').first()).toHaveText(p.host);
		await expect(c).toContainText(
			`Where this key goes: only from your browser, directly to ${p.host}.`
		);
		const link = c.getByRole('link', { name: `Get a ${p.label} key (opens external site)` });
		await expect(link).toHaveAttribute('href', p.keyUrl);
		expect(await link.getAttribute('target')).toBeNull();
		await expect(c.getByText('Not added', { exact: true })).toBeVisible();
		if (p.note) await expect(c.getByText(p.note)).toBeVisible();
	}
	await expect(card(page, 'rentcast')).toContainText('50 requests a month');
	await expect(card(page, 'gemini')).toContainText("On Google's free tier");
});

test('save shows last4 only; the key never reaches the DOM, attributes, URL or announcer', async ({
	page
}) => {
	const key = fakeKey('anthropic', 'Q');
	await openSettings(page);
	await saveKey(page, 'Anthropic', key);

	const c = card(page, 'anthropic');
	await expect(c.getByText('Saved for this session')).toBeVisible();
	await expect(c).toContainText(`Key ending in ${key.slice(-4)}`);
	await expect(announcer(page)).toHaveText('Anthropic key saved for this tab.');

	expect(await page.content()).not.toContain(key);
	const inAttributes = await page.evaluate((k) => {
		for (const el of document.querySelectorAll('*')) {
			for (const a of el.attributes) if (a.value.includes(k)) return `${el.tagName} ${a.name}`;
			if (el instanceof HTMLInputElement && el.value.includes(k)) return `${el.tagName} value`;
		}
		return null;
	}, key);
	expect(inAttributes).toBeNull();
	expect(page.url()).not.toContain(key);
});

test('validation: empty and whitespace keys show the approved messages', async ({ page }) => {
	await openSettings(page);
	const c = card(page, 'openai');
	const input = page.getByLabel('OpenAI API key', { exact: true });

	await c.getByRole('button', { name: 'Save key', exact: true }).click();
	await expect(c.getByText('Paste a key before saving.')).toBeVisible();
	await expect(input).toBeFocused();
	await expect(input).toHaveAttribute('aria-invalid', 'true');

	await input.fill('abc def');
	await c.getByRole('button', { name: 'Save key', exact: true }).click();
	await expect(
		c.getByText(
			'This key has spaces or line breaks in it. Copy it again from OpenAI and paste it here.'
		)
	).toBeVisible();
	await expect(input).toBeFocused();
	await expect(c.getByText('Not added', { exact: true })).toBeVisible();
});

test('show/hide toggles masking and the next entry form is masked again', async ({ page }) => {
	await openSettings(page);
	const c = card(page, 'openrouter');
	const input = page.getByLabel('OpenRouter API key', { exact: true });
	await expect(input).toHaveAttribute('type', 'password');

	const toggle = c.getByRole('button', { name: 'Show key' });
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await expect(input).toHaveAttribute('type', 'text');

	await saveKey(page, 'OpenRouter', fakeKey('openrouter', 'B'));
	await expect(c).toContainText('Key ending in');
	await c.getByRole('button', { name: 'Replace key' }).click();
	await expect(input).toHaveAttribute('type', 'password');
	await expect(c.getByRole('button', { name: 'Show key' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(input).toHaveValue('');
});

test('Paste inserts the trimmed key and keeps it masked', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const key = fakeKey('gemini', 'P');
	await openSettings(page);
	await page.evaluate((k) => navigator.clipboard.writeText(`  ${k}\n`), key);

	const c = card(page, 'gemini');
	await c.getByRole('button', { name: 'Paste', exact: true }).click();
	const input = page.getByLabel('Google Gemini API key', { exact: true });
	await expect(input).toHaveValue(key);
	await expect(input).toHaveAttribute('type', 'password');

	await c.getByRole('button', { name: 'Save key', exact: true }).click();
	await expect(c).toContainText(`Key ending in ${key.slice(-4)}`);
});

test('Paste shows the clipboard-denied message when reading is refused', async ({ browser }) => {
	const context = await browser.newContext();
	try {
		const page = await context.newPage();
		await page.addInitScript(() => {
			Object.defineProperty(navigator.clipboard, 'readText', {
				configurable: true,
				value: () => Promise.reject(new DOMException('Read permission denied.', 'NotAllowedError'))
			});
		});
		await openSettings(page);
		const c = card(page, 'rentcast');
		await c.getByRole('button', { name: 'Paste', exact: true }).click();
		await expect(
			c.getByText(
				"Your browser didn't allow reading the clipboard. Paste into the field instead (Ctrl+V, ⌘V, or long-press)."
			)
		).toBeVisible();
		await expect(page.getByLabel('RentCast API key', { exact: true })).toBeFocused();
	} finally {
		await context.close();
	}
});

test('keys are session-only by default (PLAT-02)', async ({ page, context, browser }) => {
	const key = fakeKey('rentcast', 'S');
	await openSettings(page);
	await saveKey(page, 'RentCast', key);
	await expect(card(page, 'rentcast')).toContainText(`Key ending in ${key.slice(-4)}`);

	await page.reload();
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	await expect(card(page, 'rentcast')).toContainText(`Key ending in ${key.slice(-4)}`);
	await expect(card(page, 'rentcast').getByText('Saved for this session')).toBeVisible();

	const otherTab = await context.newPage();
	await openSettings(otherTab);
	await expect(card(otherTab, 'rentcast').getByText('Not added', { exact: true })).toBeVisible();
	await otherTab.close();

	const fresh = await browser.newContext();
	try {
		const p = await fresh.newPage();
		await openSettings(p);
		await expect(card(p, 'rentcast').getByText('Not added', { exact: true })).toBeVisible();
	} finally {
		await fresh.close();
	}
});

test('Replace key focuses the input and updates last4; Remove key clears it', async ({ page }) => {
	const first = fakeKey('rentcast', 'C');
	const second = fakeKey('rentcast', 'D');
	await openSettings(page);
	await saveKey(page, 'RentCast', first);
	const c = card(page, 'rentcast');
	await expect(c).toContainText(`Key ending in ${first.slice(-4)}`);

	await c.getByRole('button', { name: 'Replace key' }).click();
	const input = page.getByLabel('RentCast API key', { exact: true });
	await expect(input).toBeFocused();
	await saveKey(page, 'RentCast', second);
	await expect(c).toContainText(`Key ending in ${second.slice(-4)}`);

	await c.getByRole('button', { name: 'Remove key' }).click();
	await expect(c.getByText('Not added', { exact: true })).toBeVisible();
	await expect(announcer(page)).toHaveText('RentCast key removed.');
	await expect(input).toBeVisible();
});

test('Forget all keys confirms, clears every card and focuses the section heading', async ({
	page
}) => {
	await openSettings(page);
	await saveKey(page, 'RentCast', fakeKey('rentcast', 'F'));
	await saveKey(page, 'Anthropic', fakeKey('anthropic', 'F'));
	await expect(card(page, 'anthropic')).toContainText('Key ending in');

	const footer = page.locator('#api-keys');
	const trigger = footer.getByRole('button', { name: 'Forget all keys' });
	await trigger.click();
	const dialog = page.getByRole('alertdialog');
	await expect(dialog.getByRole('heading', { name: 'Forget all API keys?' })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Keep my keys' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();

	await trigger.click();
	await page
		.getByRole('alertdialog')
		.getByRole('button', { name: 'Forget all keys', exact: true })
		.click();
	for (const p of PROVIDERS) {
		await expect(card(page, p.id).getByText('Not added', { exact: true })).toBeVisible();
	}
	await expect(announcer(page)).toHaveText('All API keys forgotten.');
	await expect(page.locator('#api-keys-heading')).toBeFocused();
	await expect(footer.getByText('No keys are stored in this browser.')).toBeVisible();
	await expect(footer.getByRole('button', { name: 'Forget all keys' })).toHaveCount(0);
	expect(await sessionBlob(page)).toBeNull();
});

test('Forget all in one tab clears every other open Tran tab', async ({ page, context }) => {
	await openSettings(page);
	await saveKey(page, 'OpenAI', fakeKey('openai', 'X'));
	await expect(card(page, 'openai')).toContainText('Key ending in');

	const other = await context.newPage();
	await openSettings(other);
	await saveKey(other, 'OpenAI', fakeKey('openai', 'Y'));
	await expect(card(other, 'openai')).toContainText('Key ending in');
	expect(await sessionBlob(other)).not.toBeNull();

	await page.locator('#api-keys').getByRole('button', { name: 'Forget all keys' }).click();
	await page
		.getByRole('alertdialog')
		.getByRole('button', { name: 'Forget all keys', exact: true })
		.click();

	await expect(card(other, 'openai').getByText('Not added', { exact: true })).toBeVisible();
	await expect(announcer(other)).toHaveText('Your keys were forgotten in another Tran tab.');
	expect(await sessionBlob(other)).toBeNull();
	expect(await sessionBlob(page)).toBeNull();
});

test('no Test key button without a registered tester', async ({ page }) => {
	await openSettings(page);
	await saveKey(page, 'Anthropic', fakeKey('anthropic', 'T'));
	await expect(card(page, 'anthropic')).toContainText('Key ending in');
	await expect(page.getByRole('button', { name: /Test key/ })).toHaveCount(0);
});

test('empty state explains that keys are optional', async ({ page }) => {
	await openSettings(page);
	await expect(page.getByText('No keys added yet', { exact: true })).toBeVisible();
	await expect(
		page.getByText('You can explore every portal with sample data and no keys.', { exact: false })
	).toBeVisible();
	await expect(page.getByText('No keys are stored in this browser.')).toBeVisible();
});
