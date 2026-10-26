import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { motion, themeVars, tokens } from '@tran/brand';

// UI-SPEC "Parity test": every color in the extension is a Phase 2 token, named
// declarations carry the same value as @tran/brand, and Zillow blue (#006AFF) is rejected.

const SRC = join(import.meta.dirname, '..', 'src');
const STYLE_CSS = 'entrypoints/zillow.content/style.css';
const PILL_CSS = 'lib/pill-css.ts';

const TOKEN_HEX = new Set(Object.values(tokens.color).map((v) => v.toLowerCase()));
const VARS = themeVars();
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function checkParity(path: string, text: string): string[] {
	const errors: string[] = [];
	const hexes = text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
	if (path.endsWith('.svelte')) {
		for (const h of hexes) errors.push(`${path}: hex literal ${h} in .svelte (use var(--...))`);
	} else {
		for (const h of hexes) {
			if (!TOKEN_HEX.has(h.toLowerCase())) errors.push(`${path}: ${h} is not a Phase 2 token`);
		}
	}
	for (const m of text.matchAll(/(--(?:color|radius|font|ease)-[a-z-]+)\s*:\s*([^;]+);/g)) {
		const [, name, value] = m as unknown as [string, string, string];
		const expected = VARS[name];
		if (expected === undefined) errors.push(`${path}: ${name} is not a @tran/brand token`);
		else if (norm(value) !== norm(expected))
			errors.push(`${path}: ${name} is ${norm(value)}, expected ${norm(expected)}`);
	}
	for (const m of text.matchAll(/--duration-fast\s*:\s*([^;]+);/g)) {
		if (norm(m[1]!) !== `${motion.fast}ms`)
			errors.push(`${path}: --duration-fast is ${norm(m[1]!)}, expected ${motion.fast}ms`);
	}
	return errors;
}

const files = (readdirSync(SRC, { recursive: true }) as string[])
	.map((p) => p.replace(/\\/g, '/'))
	.filter((p) => /\.(css|ts|svelte)$/.test(p) && !p.endsWith('.json'))
	.sort();

const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

describe('brand parity gate', () => {
	it('scans the injected stylesheet and the pill CSS (and every later src file)', () => {
		expect(files).toContain(STYLE_CSS);
		expect(files).toContain(PILL_CSS);
	});

	it.each(files)('%s uses only Phase 2 token values', (rel) => {
		expect(checkParity(rel, read(rel))).toEqual([]);
	});

	it('pill CSS actually carries token hexes (non-vacuous scan)', () => {
		const hexes = read(PILL_CSS).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
		expect(hexes.length).toBeGreaterThan(0);
	});

	it('rejects Zillow blue and a near-miss token value', () => {
		expect(checkParity('planted.css', 'button { color: #006AFF; }')).toHaveLength(1);
		expect(checkParity('planted.css', '--color-primary: #a4452b;').length).toBeGreaterThan(0);
		expect(checkParity('planted.css', '--duration-fast: 200ms;')).toHaveLength(1);
		expect(checkParity('planted.svelte', '<p style="color: #2b1d16">x</p>')).toHaveLength(1);
	});

	it('accepts exact token declarations', () => {
		expect(checkParity('ok.css', '--color-primary: #A4452A;')).toEqual([]);
		expect(checkParity('ok.css', `--ease-out: ${VARS['--ease-out']};`)).toEqual([]);
		expect(checkParity('ok.css', `--duration-fast: ${motion.fast}ms;`)).toEqual([]);
	});
});

/** Remove a balanced `@media print { ... }` block so the remaining text can be inspected. */
function stripPrint(css: string): string {
	const start = css.indexOf('@media print');
	if (start < 0) return css;
	let depth = 0;
	for (let i = css.indexOf('{', start); i < css.length; i++) {
		if (css[i] === '{') depth++;
		else if (css[i] === '}' && --depth === 0) return css.slice(0, start) + css.slice(i + 1);
	}
	return css;
}

describe('zillow content stylesheet', () => {
	const css = read(STYLE_CSS).replace(/\/\*[\s\S]*?\*\//g, '');

	it('has no url() and never display:none outside print', () => {
		expect(css).not.toMatch(/url\(/);
		expect(stripPrint(css)).not.toMatch(/display\s*:\s*none/);
		expect(css).toMatch(/@media print/);
	});

	it('scopes every selector to data-tran-slf attributes', () => {
		const selectors = [...css.matchAll(/([^{}]+)\{/g)]
			.map((m) => m[1]!.trim())
			.filter((s) => !s.startsWith('@'))
			.flatMap((s) => s.split(',').map((x) => x.trim()));
		expect(selectors.length).toBeGreaterThan(0);
		for (const s of selectors) expect(s, s).toMatch(/^\[data-tran-slf/);
	});

	it('dim rule matches siblings of the pill on a card item and an ad-slot li wrapping an iframe', () => {
		const dim = css.match(/(\[data-tran-slf='dimmed'\][^{]*)\{/)![1]!.trim();
		document.body.innerHTML =
			'<ul>' +
			'<li id="card" data-tran-slf="dimmed"><tran-slf-pill data-tran-slf-pill></tran-slf-pill><article data-testid="property-card"></article></li>' +
			'<li id="ad" data-testid="search-list-first-ad" data-tran-slf="dimmed"><tran-slf-pill data-tran-slf-pill></tran-slf-pill><iframe title="ad"></iframe></li>' +
			'<li id="shown" data-tran-slf="revealed"><tran-slf-pill data-tran-slf-pill></tran-slf-pill><iframe title="ad"></iframe></li>' +
			'</ul>';
		const hit = [...document.querySelectorAll(dim)].map(
			(el) => `${el.parentElement!.id}>${el.localName}`
		);
		expect(hit).toEqual(['card>article', 'ad>iframe']);
		document.body.replaceChildren();
	});
});
