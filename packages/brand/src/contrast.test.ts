import { describe, expect, test } from 'vitest';
import { contrastPairs, contrastRatio, failingPairs, themeVars, tokens } from './index';

const round2 = (n: number) => Math.round(n * 100) / 100;
const DECORATIVE = new Set<string>(['deco-terracotta', 'deco-sage', 'border']);

describe('contrastRatio (WCAG 2.2 relative luminance)', () => {
	test('black on white is 21:1', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
	});

	test('is symmetric', () => {
		const a = tokens.color.primary;
		const b = tokens.color.background;
		expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
	});

	test('matches the UI-SPEC matrix for anchor pairs', () => {
		const c = tokens.color;
		expect(round2(contrastRatio(c.foreground, c.background))).toBe(15.24);
		expect(round2(contrastRatio(c.primary, c['accent-surface']))).toBe(4.88);
		expect(round2(contrastRatio(c['border-strong'], c['accent-surface']))).toBe(3.55);
		expect(round2(contrastRatio(c.white, c.primary))).toBe(6.06);
		expect(round2(contrastRatio(c['deco-terracotta'], c.background))).toBe(3.32);
	});
});

describe('contrast gate', () => {
	test('every shipped pair meets its WCAG 2.2 AA minimum', () => {
		expect(failingPairs()).toEqual([]);
	});

	test('rejects a planted failing pair (non-vacuity)', () => {
		const planted = failingPairs([
			{ fg: 'deco-terracotta', bg: 'background', min: 4.5, kind: 'text' }
		]);
		expect(planted).toHaveLength(1);
	});

	test('decorative tokens are never text or UI foregrounds', () => {
		const offenders = contrastPairs.filter(
			(p) => (p.kind === 'text' || p.kind === 'ui') && DECORATIVE.has(p.fg)
		);
		expect(offenders).toEqual([]);
	});

	test('covers the full UI-SPEC matrix', () => {
		expect(contrastPairs.length).toBeGreaterThanOrEqual(45);
	});

	test('every pair references token names, never hex literals', () => {
		for (const p of contrastPairs) {
			expect(p.fg in tokens.color, `fg ${p.fg}`).toBe(true);
			expect(p.bg in tokens.color, `bg ${p.bg}`).toBe(true);
		}
	});
});

describe('themeVars', () => {
	test('emits Tailwind @theme custom properties from the tokens', () => {
		const vars = themeVars();
		expect(vars['--color-background']).toBe('#fbf7f0');
		expect(vars['--font-display']).toBe(tokens.font.display);
		expect(vars['--font-display']).toContain("'Fraunces Variable'");
		expect(vars['--radius-lg']).toBe('16px');
		expect(vars['--container-reading']).toBe('40rem');
		expect(vars['--ease-out']).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
	});

	test('never emits motion or duration variables', () => {
		const keys = Object.keys(themeVars());
		expect(keys.filter((k) => k.startsWith('--motion-') || k.startsWith('--duration-'))).toEqual(
			[]
		);
	});
});

describe('Phase 3 shadcn alias tokens', () => {
	const ALIASES = {
		'card-foreground': 'foreground',
		popover: 'card',
		'popover-foreground': 'foreground',
		muted: 'surface',
		accent: 'surface',
		'accent-foreground': 'foreground',
		input: 'border-strong',
		'destructive-foreground': 'primary-foreground'
	} as const;

	test('each alias reuses the hex of its Phase 2 source token (no new colors)', () => {
		const color = tokens.color as Record<string, string>;
		for (const [alias, source] of Object.entries(ALIASES)) {
			expect(color[alias], alias).toBe(color[source]);
		}
	});

	test('matches the Phase 3 UI-SPEC computed ratios', () => {
		const c = tokens.color as Record<string, string>;
		expect(round2(contrastRatio(c.white, c.destructive))).toBe(7.43);
		expect(round2(contrastRatio(c['border-strong'], c.card))).toBe(4.35);
		expect(round2(contrastRatio(c['destructive-foreground'], c.destructive))).toBe(7.43);
	});

	test('the shadcn pairs are in the frozen contrast matrix', () => {
		const has = (fg: string, bg: string, min: number) =>
			contrastPairs.some((p) => p.fg === fg && p.bg === bg && p.min === min);
		expect(has('destructive-foreground', 'destructive', 4.5)).toBe(true);
		expect(has('input', 'card', 3)).toBe(true);
		expect(has('input', 'surface', 3)).toBe(true);
		expect(has('input', 'background', 3)).toBe(true);
		expect(has('primary', 'card', 3)).toBe(true);
		expect(has('card', 'primary', 3)).toBe(true);
	});
});
