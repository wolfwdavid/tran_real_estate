import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import { COPY } from '../src/lib/copy';

// UI-SPEC Copywriting Contract: banned in all extension UI, manifest, store listing and install
// doc. Whole word, case-insensitive. "Zillow's" (possessive) implies affiliation.
const BANNED = /\b(block|blocks|blocker|ad-free|remove|removes|official)\b|Zillow['’]s/gi;

const EXT_ROOT = join(import.meta.dirname, '..');
const INSTALL_DOC = join(EXT_ROOT, '..', '..', 'docs', 'EXTENSION-INSTALL.md');

interface Surface {
	path: string;
	text: string;
}

interface Hit {
	line: number;
	word: string;
}

function findBanned(text: string): Hit[] {
	const hits: Hit[] = [];
	text.split(/\r?\n/).forEach((line, index) => {
		for (const match of line.matchAll(BANNED)) hits.push({ line: index + 1, word: match[0] });
	});
	return hits;
}

// Script and style blocks are code, not copy (CSS like `display: block` must not trip the gate).
// Newlines inside stripped blocks are kept so reported line numbers stay accurate.
const keepNewlines = (block: string): string => block.replace(/[^\n]/g, '');
const stripCode = (svelte: string): string =>
	svelte
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, keepNewlines)
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, keepNewlines);

const rel = (abs: string): string => relative(EXT_ROOT, abs).replaceAll('\\', '/');

function copySurfaces(): Surface[] {
	const surfaces: Surface[] = [];
	const copyFile = join(EXT_ROOT, 'src', 'lib', 'copy.ts');
	surfaces.push({ path: rel(copyFile), text: readFileSync(copyFile, 'utf8') });

	const srcDir = join(EXT_ROOT, 'src');
	const entries = readdirSync(srcDir, { recursive: true, encoding: 'utf8' });
	for (const entry of entries.filter((e) => e.endsWith('.svelte')).sort()) {
		const abs = join(srcDir, entry);
		surfaces.push({ path: rel(abs), text: stripCode(readFileSync(abs, 'utf8')) });
	}

	const storeDir = join(EXT_ROOT, 'store');
	if (existsSync(storeDir)) {
		for (const entry of readdirSync(storeDir)
			.filter((e) => e.endsWith('.md'))
			.sort()) {
			const abs = join(storeDir, entry);
			surfaces.push({ path: rel(abs), text: readFileSync(abs, 'utf8') });
		}
	}

	if (existsSync(INSTALL_DOC)) {
		surfaces.push({ path: rel(INSTALL_DOC), text: readFileSync(INSTALL_DOC, 'utf8') });
	}
	return surfaces;
}

describe('extension copy banned words', () => {
	test('no copy surface contains a banned word', () => {
		const offenders = copySurfaces().flatMap(({ path, text }) =>
			findBanned(text).map(({ line, word }) => `${path}:${line}: ${word}`)
		);
		expect(offenders).toEqual([]);
	});

	test('the matcher catches banned words and passes clean copy (non-vacuity)', () => {
		expect(findBanned("Ad blocker that removes official listings. Zillow's")).toHaveLength(4);
		expect(findBanned('Dims sponsored cards; show any card.')).toHaveLength(0);
	});

	test('the scanned scope always includes copy.ts', () => {
		expect(copySurfaces().map((s) => s.path)).toContain('src/lib/copy.ts');
	});

	test('the scanned scope never silently shrinks (copy.ts, 6 Svelte files, store copy, install doc)', () => {
		const paths = copySurfaces().map((s) => s.path);
		expect(paths.length).toBeGreaterThanOrEqual(9);
		expect(paths).toContain('src/entrypoints/popup/App.svelte');
		expect(paths).toContain('store/edge-listing.md');
		expect(paths).toContain('../../docs/EXTENSION-INSTALL.md');
	});

	test('no COPY value uses the standalone word "Ad" (detection label only)', () => {
		const offenders = Object.entries(COPY).filter(([, value]) => /\bAd\b/.test(value));
		expect(offenders).toEqual([]);
	});
});
