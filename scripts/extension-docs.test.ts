// Plan 11-07: the extension install guide, the Edge Add-ons listing copy and the Tran privacy
// section the popup links to (PRIVACY_URL#browser-extension). UI-SPEC Copywriting Contract and
// RESEARCH "Edge Add-ons Requirements" (policy 1.1.2: no references to other browsers).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

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
			'## Privacy policy URL: https://tranrealestate.github.io/legal/privacy/#browser-extension'
		]) {
			expect(listing, s).toContain(s);
		}
		expect(section(listing, 'Name')).toBe('Sponsored Listing Filter — for Zillow');
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
