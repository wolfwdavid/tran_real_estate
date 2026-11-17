// Plan 11-07: the extension install guide, the Edge Add-ons listing copy and the Tran privacy
// section the popup links to (PRIVACY_URL#browser-extension). UI-SPEC Copywriting Contract and
// RESEARCH "Edge Add-ons Requirements" (policy 1.1.2: no references to other browsers).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { resolveSiteUrl } from '../apps/web/src/lib/site-config.js';

const ROOT = join(import.meta.dirname, '..');
const INSTALL = join(ROOT, 'docs', 'EXTENSION-INSTALL.md');
const LISTING = join(ROOT, 'apps', 'extension', 'store', 'edge-listing.md');
const PRIVACY = join(
	ROOT,
	'apps',
	'web',
	'src',
	'routes',
	'(marketing)',
	'legal',
	'privacy',
	'+page.svelte'
);

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const collapse = (s: string): string => s.replace(/\s+/g, ' ');

const BANNED = /\b(block|blocks|blocker|ad-free|remove|removes|official)\b|Zillow['’]s/i;
const OTHER_BROWSERS = /\b(chrome|chromium|firefox|brave|safari|opera)\b/i;
const NOT_AFFILIATED = 'Not affiliated with or endorsed by Zillow Group.';
// The docs and the Edge listing carry the live project-site URL. CI runs test:unit with no deploy
// env, so the live env is explicit here (DEBT-04, Pitfall 5); RETIRED_HOST still rejects the org host.
const LIVE_SITE_ENV = { BASE_PATH: '/tran_real_estate' };
const PRIVACY_URL = `${resolveSiteUrl(LIVE_SITE_ENV)}/legal/privacy/#browser-extension`;
const RETIRED_HOST = /tranrealestate/;

// Body of a `## <heading>` section: everything up to the next `## ` heading.
function section(markdown: string, heading: string): string {
	const start = markdown.indexOf(`\n## ${heading}\n`);
	expect(start, `section "${heading}" missing`).toBeGreaterThan(-1);
	const body = markdown.slice(start + heading.length + 5);
	const next = body.search(/^## /m);
	return (next === -1 ? body : body.slice(0, next)).trim();
}

describe('docs/EXTENSION-INSTALL.md', () => {
	const doc = read(INSTALL);

	test('has the UI-SPEC headings in order', () => {
		const headings = [
			'## Install from a release zip (Chrome, Edge, Brave)',
			'## Install from Microsoft Edge Add-ons',
			'## What it does',
			"## What it doesn't do",
			'## Privacy'
		];
		const idx = headings.map((h) => doc.indexOf(`\n${h}\n`));
		headings.forEach((h, i) => expect(idx[i], h).toBeGreaterThan(-1));
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
	});

	test('covers load-unpacked, checksums, reload and updates', () => {
		for (const s of [
			'chrome://extensions',
			'edge://extensions',
			'Developer mode',
			'Load unpacked',
			'manifest.json',
			'Get-FileHash -Algorithm SHA256',
			'shasum -a 256',
			'sha256sum -c SHA256SUMS.txt',
			'sponsored-listing-filter-',
			'Reload',
			'uninstalls the extension'
		]) {
			expect(doc, s).toContain(s);
		}
	});

	test('ends with the non-affiliation notice', () => {
		const lines = doc.split(/\r?\n/).filter((l) => l.trim() !== '');
		expect(lines.at(-1)).toBe(NOT_AFFILIATED);
	});

	test('contains no banned word', () => {
		expect(doc).not.toBe('');
		expect(doc.match(BANNED)).toBeNull();
	});

	test('gives the live privacy URL on the project site', () => {
		expect(doc).toContain(PRIVACY_URL);
	});
});

describe('apps/extension/store/edge-listing.md', () => {
	const listing = read(LISTING);

	test('the Description is 250-10000 characters and carries both notices', () => {
		const description = section(listing, 'Description');
		expect(description.length).toBeGreaterThanOrEqual(250);
		expect(description.length).toBeLessThanOrEqual(10000);
		expect(description).toContain(NOT_AFFILIATED);
		expect(description).toContain('Collects nothing, sends nothing.');
	});

	test('has the Partner Center privacy-tab answers', () => {
		for (const s of [
			'## Name',
			'## Single purpose',
			'## Permission justification: storage',
			'## Permission justification: host access to zillow.com',
			'## Remote code: No',
			'## Data collection: None',
			`## Privacy policy URL: ${PRIVACY_URL}`
		]) {
			expect(listing, s).toContain(s);
		}
		expect(section(listing, 'Name')).toBe('Sponsored Listing Filter — for Zillow');
	});

	test('neither doc names the retired organization host', () => {
		expect(read(INSTALL)).not.toMatch(RETIRED_HOST);
		expect(listing).not.toMatch(RETIRED_HOST);
	});

	test('lists between 1 and 7 search terms', () => {
		const terms = section(listing, 'Search terms')
			.split(/\r?\n/)
			.filter((l) => /^- \S/.test(l));
		expect(terms.length).toBeGreaterThanOrEqual(1);
		expect(terms.length).toBeLessThanOrEqual(7);
	});

	test('never mentions another browser (Edge policy 1.1.2)', () => {
		expect(listing).not.toBe('');
		expect(listing.match(OTHER_BROWSERS)).toBeNull();
	});

	test('contains no banned word', () => {
		expect(listing.match(BANNED)).toBeNull();
	});

	test('the matchers are not vacuous', () => {
		expect('Works in Chrome'.match(OTHER_BROWSERS)).not.toBeNull();
		expect("Removes Zillow's ads".match(BANNED)).not.toBeNull();
	});
});

describe('privacy page #browser-extension section', () => {
	const page = collapse(read(PRIVACY));

	test('has the anchored h2', () => {
		expect(page).toContain('<h2 id="browser-extension">Sponsored Listing Filter extension</h2>');
	});

	test('carries the three UI-SPEC paragraphs verbatim', () => {
		for (const p of [
			'The Sponsored Listing Filter — for Zillow browser extension runs only on zillow.com pages. It reads the short labels on listing cards, such as "Sponsored" or "Promoted", to find paid placements and dims them. You can show any card with one click.',
			"It does not read prices, addresses, or any other listing details. It makes no network requests, sends nothing to Tran or anyone else, and has no analytics. Its only stored data is one on/off setting kept in your browser's extension storage.",
			`Permissions: storage, and access to zillow.com pages. ${NOT_AFFILIATED}`
		]) {
			expect(page).toContain(p);
		}
	});

	test('the section sits inside the LegalPage wrapper, after the existing sections', () => {
		const h2 = page.indexOf('id="browser-extension"');
		expect(h2).toBeGreaterThan(page.indexOf('<h2>Contact</h2>'));
		expect(h2).toBeLessThan(page.indexOf('</LegalPage>'));
	});
});

const SHOTS_DIR = join(ROOT, 'apps', 'extension', 'store', 'screenshots');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from the IHDR chunk, or null when the 8-byte PNG signature is wrong. */
function pngSize(buf: Buffer): { width: number; height: number } | null {
	if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
const isStoreSize = (s: { width: number; height: number } | null): boolean =>
	s !== null && s.width === 1280 && s.height === 800;

function fakePng(width: number, height: number): Buffer {
	const buf = Buffer.alloc(33);
	PNG_SIGNATURE.copy(buf);
	buf.writeUInt32BE(width, 16);
	buf.writeUInt32BE(height, 20);
	return buf;
}

const shotFiles = (): string[] => (existsSync(SHOTS_DIR) ? readdirSync(SHOTS_DIR).sort() : []);

describe('edge-listing.md store sections', () => {
	const listing = read(LISTING);
	const site = resolveSiteUrl(LIVE_SITE_ENV);

	test('Website is the project site', () => {
		expect(section(listing, 'Website')).toBe(`${site}/`);
	});

	test('Support contact detail is a single site URL with no email', () => {
		const body = section(listing, 'Support contact detail');
		expect(body.startsWith(`${site}/`)).toBe(true);
		expect(body).not.toMatch(/[\r\n]/);
		expect(body).not.toContain('@');
	});

	test('Notes for certification state the ad-slot ground truth', () => {
		const notes = collapse(section(listing, 'Notes for certification'));
		expect(notes).toContain('On live Zillow today only advertising-slot list items are dimmed');
		expect(notes).toContain('No account, login or test data is needed');
		expect(notes.length).toBeLessThanOrEqual(5000);
	});

	test('screenshots are described as synthetic, never a live search', () => {
		expect(listing).toContain('synthetic');
		expect(listing).not.toMatch(/captured from a live search/i);
	});

	test('Assets lists exactly the screenshot files present', () => {
		const listed = [...section(listing, 'Assets').matchAll(/store\/screenshots\/(\S+?\.png)/g)]
			.map((m) => m[1])
			.sort();
		expect(listed).toEqual(shotFiles());
	});
});

describe('store screenshots', () => {
	test('the directory holds 2 or 3 PNG files and nothing else', () => {
		const files = shotFiles();
		expect(files.length).toBeGreaterThanOrEqual(2);
		expect(files.length).toBeLessThanOrEqual(3);
		for (const f of files) expect(f).toMatch(/\.png$/);
	});

	test('every file is a PNG of exactly 1280x800', () => {
		for (const f of shotFiles()) {
			const size = pngSize(readFileSync(join(SHOTS_DIR, f)));
			expect(size, f).not.toBeNull();
			expect(isStoreSize(size), `${f} is ${size?.width}x${size?.height}`).toBe(true);
		}
	});

	test('planted wrong files are rejected', () => {
		expect(isStoreSize(pngSize(fakePng(1280, 800)))).toBe(true);
		expect(pngSize(fakePng(1280, 799))?.height).toBe(799);
		expect(isStoreSize(pngSize(fakePng(1280, 799)))).toBe(false);
		expect(isStoreSize(pngSize(fakePng(640, 480)))).toBe(false);
		expect(isStoreSize(pngSize(fakePng(3000, 1800)))).toBe(false);
		const bad = fakePng(1280, 800);
		bad[0] = 0;
		expect(pngSize(bad)).toBeNull();
	});
});

// EXT-09: the phase closes with the placeholder; replacing it with the listing URL after
// certification is an owner follow-up and must keep this test green.
const PLACEHOLDER =
	'The listing link will appear here once the Microsoft Edge Add-ons listing is live.';
function installListingState(body: string): 'placeholder' | 'link' | 'neither' {
	const text = collapse(body);
	if (text.includes(PLACEHOLDER)) return 'placeholder';
	if (/https:\/\/microsoftedge\.microsoft\.com\//.test(text)) return 'link';
	return 'neither';
}

describe('EXT-09 install guide Edge Add-ons section', () => {
	test('carries the placeholder sentence or a listing link', () => {
		const state = installListingState(
			section(read(INSTALL), 'Install from Microsoft Edge Add-ons')
		);
		expect(['placeholder', 'link']).toContain(state);
	});

	test('planted sections are classified correctly', () => {
		expect(installListingState('Nothing useful here.')).toBe('neither');
		expect(installListingState(`${PLACEHOLDER} Installs update.`)).toBe('placeholder');
		expect(
			installListingState('https://microsoftedge.microsoft.com/addons/detail/example/abc')
		).toBe('link');
		expect(installListingState('https://example.com/addons')).toBe('neither');
	});
});
