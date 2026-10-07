import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import {
	announcer,
	expectAxeClean,
	expectNoHorizontalScroll,
	rentcastTripwire
} from './agent-helpers';

// The brand kit on the agent profile page (AGT-01, plan 08-22) against the BUILT site: a logo
// rendered from a blob: URL under the production CSP, SVG rasterized to PNG, refusals by content
// and size, the live contrast verdicts with their token fallbacks, persistence through IndexedDB,
// Remove logo, and axe at desktop and phone widths.

declare global {
	interface Window {
		/** `${violatedDirective} ${blockedURI}` per securitypolicyviolation event (csp.spec.ts). */
		__csp: string[];
	}
}

async function installCollector(page: Page) {
	await page.addInitScript(() => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => {
			window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
}

const violations = (page: Page) => page.evaluate(() => window.__csp);

// --- A real PNG built in Node (signature, IHDR, one deflated RGBA row per line, IEND). ---

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(bytes: Buffer): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([len, body, crc]);
}

/** A solid-color RGBA PNG of `width` x `height`. */
function makePng(width: number, height: number, rgba = [0x4f, 0x64, 0x49, 0xff]): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type RGBA
	const stride = 1 + width * 4;
	const raw = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		raw[y * stride] = 0; // filter: none
		for (let x = 0; x < width; x++) raw.set(rgba, y * stride + 1 + x * 4);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const PNG_2x1 = makePng(2, 1);
const SVG_200x100 =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#4F6449"/></svg>';
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const OVER_CAP = 524_289;

// --- Page helpers ---

async function open(page: Page) {
	await page.goto('agent/profile/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your profile');
	await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const status = (page: Page) => page.getByTestId('profile-status');
const previewImg = (page: Page) => page.getByTestId('logo-preview').locator('img');
const brandPreview = (page: Page) => page.getByTestId('brand-preview');
const verdict = (page: Page, role: 'primary' | 'accent') => page.getByTestId(`verdict-${role}`);

async function save(page: Page) {
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(status(page)).toHaveText('Saved.');
}

function chooseLogo(page: Page, name: string, mimeType: string, buffer: Buffer) {
	return page.locator('#profile-logo-file').setInputFiles({ name, mimeType, buffer });
}

const naturalWidth = (page: Page) =>
	previewImg(page).evaluate((el: HTMLImageElement) => el.naturalWidth);

const customProp = (page: Page, name: string) =>
	brandPreview(page).evaluate(
		(el, prop) => getComputedStyle(el).getPropertyValue(prop).trim(),
		name
	);

test('PNG logo renders from a blob URL with zero CSP violations and survives a reload', async ({
	page
}) => {
	const rentcast = await rentcastTripwire(page);
	await installCollector(page);
	await open(page);
	await expect(page.getByText('No logo yet')).toBeVisible();

	await chooseLogo(page, 'logo.png', 'image/png', PNG_2x1);
	await expect(announcer(page)).toHaveText('Logo ready. Save your profile to keep it.');
	await expect(previewImg(page)).toHaveAttribute('src', /^blob:/);
	await expect.poll(() => naturalWidth(page)).toBe(2);
	await expect(previewImg(page)).toHaveAttribute('alt', 'Your logo');
	// The brand preview shows the same logo.
	await expect(brandPreview(page).locator('img')).toHaveAttribute('src', /^blob:/);
	expect(await violations(page)).toEqual([]);
	await expect(status(page)).toHaveText('You have unsaved changes.');

	await field(page, 'Brokerage').fill('Example Realty');
	await save(page);
	await expect(previewImg(page)).toHaveAttribute('alt', 'Example Realty logo');

	await page.reload();
	await open(page);
	await expect(previewImg(page)).toHaveAttribute('src', /^blob:/);
	await expect.poll(() => naturalWidth(page)).toBe(2);
	await expect(page.getByRole('button', { name: 'Remove logo' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
	expect(rentcast).toEqual([]);
});

test('SVG logo is rasterized to a PNG at its viewBox size', async ({ page }) => {
	await installCollector(page);
	await open(page);
	await chooseLogo(page, 'logo.svg', 'image/svg+xml', Buffer.from(SVG_200x100));
	await expect(announcer(page)).toHaveText('Logo ready. Save your profile to keep it.');
	await expect(previewImg(page)).toHaveAttribute('src', /^blob:/);
	await expect.poll(() => naturalWidth(page)).toBe(200);
	expect(await violations(page)).toEqual([]);

	await save(page);
	await page.reload();
	await open(page);
	await expect.poll(() => naturalWidth(page)).toBe(200);
	expect(await violations(page)).toEqual([]);
});

test('a wrong type is refused by content, not by name', async ({ page }) => {
	await open(page);
	await chooseLogo(page, 'logo.png', 'image/png', Buffer.from('<html><body>x</body></html>'));
	await expect(page.getByText('Choose a PNG or SVG file.')).toBeVisible();
	await expect(page.getByText('No logo yet')).toBeVisible();
	await expect(page.locator('#profile-logo-file')).toHaveAttribute('aria-invalid', 'true');

	await chooseLogo(page, 'photo.png', 'image/png', JPEG_MAGIC);
	await expect(page.getByText('Choose a PNG or SVG file.')).toBeVisible();
	await expect(page.getByText('No logo yet')).toBeVisible();
	await expect(status(page)).toHaveText('');
});

test('a file over 512 KB is refused with its size', async ({ page }) => {
	await open(page);
	await chooseLogo(page, 'logo.png', 'image/png', Buffer.alloc(OVER_CAP));
	await expect(
		page.getByText(/This logo is .* Choose one that's 512 KB or smaller\./)
	).toBeVisible();
	await expect(page.getByText('No logo yet')).toBeVisible();
	await expect(status(page)).toHaveText('');
});

test('contrast verdicts, token fallbacks in the preview, and persistence', async ({ page }) => {
	await open(page);
	await expect(verdict(page, 'primary')).toHaveText(
		"No color chosen. Reports use Tran's terracotta."
	);
	await expect(verdict(page, 'accent')).toHaveText("No color chosen. Reports use Tran's sand.");
	expect(await customProp(page, '--brand-primary')).toBe('#a4452a');
	expect(await customProp(page, '--brand-accent')).toBe('#f6e3d8');

	// White fails against white text: the preview keeps terracotta.
	await field(page, 'Primary color').fill('#FFFFFF');
	await expect(verdict(page, 'primary')).toContainText('Too low');
	await expect(verdict(page, 'primary')).toContainText(
		"1.0:1 with white text. Reports will use Tran's terracotta instead."
	);
	await expect(announcer(page)).toHaveText(
		"Primary color is too low in contrast. Reports will use Tran's terracotta."
	);
	expect(await customProp(page, '--brand-primary')).toBe('#a4452a');

	// A dark blue passes and reaches the preview as typed.
	await field(page, 'Primary color').fill('#1F4E79');
	await expect(verdict(page, 'primary')).toContainText('Passes');
	await expect(verdict(page, 'primary')).toContainText('with white text');
	await expect(announcer(page)).toHaveText('Primary color passes the contrast check.');
	expect(await customProp(page, '--brand-primary')).toBe('#1F4E79');
	await expect(page.getByLabel('Pick primary color')).toHaveValue('#1f4e79');

	// Espresso fails as an accent (dark text on dark): the preview keeps sand.
	await field(page, 'Accent color').fill('#2B1D16');
	await expect(verdict(page, 'accent')).toContainText('Too low');
	await expect(verdict(page, 'accent')).toContainText("Reports will use Tran's sand instead.");
	await expect(announcer(page)).toHaveText(
		"Accent color is too low in contrast. Reports will use Tran's sand."
	);
	expect(await customProp(page, '--brand-accent')).toBe('#f6e3d8');

	// An unfinished hex shows the format error and never reaches the preview.
	await field(page, 'Accent color').fill('#12');
	await expect(page.getByText('Use a 6-digit hex color, like #A4452A.')).toBeVisible();
	await expect(field(page, 'Accent color')).toHaveAttribute('aria-invalid', 'true');
	expect(await customProp(page, '--brand-accent')).toBe('#f6e3d8');
	// Short form is expanded on blur.
	await field(page, 'Accent color').fill('#fff');
	await field(page, 'Accent color').blur();
	await expect(field(page, 'Accent color')).toHaveValue('#FFFFFF');
	await expect(verdict(page, 'accent')).toContainText('Passes');
	await expect(verdict(page, 'accent')).toContainText('with dark text');
	expect(await customProp(page, '--brand-accent')).toBe('#FFFFFF');

	await save(page);
	await page.reload();
	await open(page);
	await expect(field(page, 'Primary color')).toHaveValue('#1F4E79');
	await expect(field(page, 'Accent color')).toHaveValue('#FFFFFF');
	await expect(verdict(page, 'primary')).toContainText('Passes');
	expect(await customProp(page, '--brand-primary')).toBe('#1F4E79');

	await page.getByRole('button', { name: 'Clear' }).first().click();
	await expect(field(page, 'Primary color')).toHaveValue('');
	await expect(verdict(page, 'primary')).toHaveText(
		"No color chosen. Reports use Tran's terracotta."
	);
	expect(await customProp(page, '--brand-primary')).toBe('#a4452a');
	await expect(status(page)).toHaveText('You have unsaved changes.');
});

test('Remove logo clears the preview and is kept on save', async ({ page }) => {
	await open(page);
	await chooseLogo(page, 'logo.png', 'image/png', PNG_2x1);
	await expect(previewImg(page)).toHaveAttribute('src', /^blob:/);
	await save(page);

	await page.getByRole('button', { name: 'Remove logo' }).click();
	await expect(page.getByText('No logo yet')).toBeVisible();
	await expect(announcer(page)).toHaveText('Logo removed. Save your profile to keep this change.');
	await expect(page.getByRole('button', { name: 'Remove logo' })).toHaveCount(0);
	await expect(brandPreview(page).locator('img')).toHaveCount(0);
	await expect(status(page)).toHaveText('You have unsaved changes.');

	await save(page);
	await page.reload();
	await open(page);
	await expect(page.getByText('No logo yet')).toBeVisible();
});

test('axe clean and no horizontal scroll at 1280 and 375 with a logo and both verdicts', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page);
	await chooseLogo(page, 'logo.png', 'image/png', PNG_2x1);
	await expect(previewImg(page)).toHaveAttribute('src', /^blob:/);
	await field(page, 'Primary color').fill('#FFFFFF');
	await expect(verdict(page, 'primary')).toContainText('Too low');
	await field(page, 'Accent color').fill('#F2E9DB');
	await expect(verdict(page, 'accent')).toContainText('Passes');
	await expectAxeClean(page, 'agent/profile/ at 1280 with a logo and verdicts');
	await expectNoHorizontalScroll(page);

	await page.setViewportSize({ width: 375, height: 812 });
	await expectAxeClean(page, 'agent/profile/ at 375 with a logo and verdicts');
	await expectNoHorizontalScroll(page);
});
