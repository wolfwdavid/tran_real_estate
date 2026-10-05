import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { themeVars } from '@tran/brand';

const appCss = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
const srcDir = fileURLToPath(new URL('../../', import.meta.url));

/** Groups that @tran/brand owns; --text-* (type scale) lives only in app.css. */
const PARITY_GROUPS = /^--(color|font|radius|shadow|ease|container)-/;

function themeBlock(css: string): string {
	const m = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
	return m ? m[1] : '';
}

function parseTheme(css: string): Map<string, string> {
	const out = new Map<string, string>();
	for (const m of themeBlock(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2]);
	return out;
}

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').replace(/"/g, "'").trim();

/** Keys of `brand` that are missing from `declared` or declared with a different value. */
function diffTheme(declared: Map<string, string>, brand: Record<string, string>): string[] {
	return Object.entries(brand)
		.filter(([k, v]) => !declared.has(k) || norm(declared.get(k)!) !== norm(v))
		.map(([k]) => k);
}

const RAW_HEX = /(?<![\w&])#(?:[0-9a-f]{3}|[0-9a-f]{6})(?![\w-])/i;

describe('app.css @theme <-> @tran/brand parity', () => {
	const declared = parseTheme(appCss);
	const brand = themeVars();

	it('declares every brand token with an equal value', () => {
		expect(diffTheme(declared, brand)).toEqual([]);
	});

	it('declares no brand-group token that @tran/brand lacks', () => {
		const extra = [...declared.keys()].filter(
			(k) => PARITY_GROUPS.test(k) && !k.endsWith('-*') && !(k in brand)
		);
		expect(extra).toEqual([]);
	});

	it('is non-vacuous and resets the default palette', () => {
		expect(declared.size).toBeGreaterThan(25);
		expect(themeBlock(appCss)).toContain('--color-*: initial;');
	});

	it('reports exactly the mutated key (mutation control)', () => {
		const mutated = parseTheme(appCss.replace('#fbf7f0', '#fbf7f1'));
		expect(diffTheme(mutated, brand)).toEqual(['--color-background']);
	});
});

describe('no raw hex in components', () => {
	it('matches a planted hex literal (control)', () => {
		expect(RAW_HEX.test('fill="#c8714e"')).toBe(true);
	});

	it('finds no hex color in any .svelte file under src', () => {
		const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter((f) =>
			f.endsWith('.svelte')
		);
		expect(files.length).toBeGreaterThan(0);
		const offenders = files.filter((f) => RAW_HEX.test(readFileSync(join(srcDir, f), 'utf8')));
		expect(offenders).toEqual([]);
	});
});
