import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { motion, themeVars } from '@tran/brand';
import { describe, expect, test } from 'vitest';

// UI-SPEC "Token plumbing (popup)": tokens.css is a literal mirror of @tran/brand, declaring on
// :root exactly the 18 tokens the popup uses.
const TOKENS_CSS = join(import.meta.dirname, '..', 'src', 'entrypoints', 'popup', 'tokens.css');

const NAMES = [
	'--color-background',
	'--color-card',
	'--color-foreground',
	'--color-muted-foreground',
	'--color-primary',
	'--color-primary-hover',
	'--color-secondary',
	'--color-secondary-surface',
	'--color-border',
	'--color-border-strong',
	'--color-ring',
	'--radius-sm',
	'--radius-md',
	'--radius-lg',
	'--radius-full',
	'--ease-out',
	'--duration-fast',
	'--font-sans'
] as const;

const expected = (name: string): string | undefined =>
	name === '--duration-fast' ? `${motion.fast}ms` : themeVars()[name];

function parse(css: string) {
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const blocks = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selector: (m[1] ?? '').trim(),
		body: m[2] ?? ''
	}));
	const decls = new Map<string, string>();
	const order: string[] = [];
	for (const { body } of blocks) {
		for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
			const name = m[1] as string;
			order.push(name);
			decls.set(name, (m[2] as string).trim());
		}
	}
	return { blocks, decls, order };
}

describe('popup tokens.css', () => {
	test('exists', () => {
		expect(existsSync(TOKENS_CSS)).toBe(true);
	});

	const css = existsSync(TOKENS_CSS) ? readFileSync(TOKENS_CSS, 'utf8') : '';
	const { blocks, decls, order } = parse(css);

	test('has a single :root block and no other selector', () => {
		expect(blocks.map((b) => b.selector)).toEqual([':root']);
	});

	test('declares exactly the 18 popup tokens, each once', () => {
		expect(order).toHaveLength(NAMES.length);
		expect([...order].sort()).toEqual([...NAMES].sort());
	});

	test.each(NAMES)('%s mirrors @tran/brand', (name) => {
		const want = expected(name);
		expect(want, `${name} missing from @tran/brand`).toBeDefined();
		expect(decls.get(name)).toBe(want);
	});

	test('color values are lowercase hex', () => {
		for (const name of NAMES.filter((n) => n.startsWith('--color-'))) {
			expect(decls.get(name)).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
