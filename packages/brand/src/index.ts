/**
 * Tran Real Estate Tools brand tokens: the single source of truth.
 * apps/web `app.css @theme` mirrors these values and is parity-tested against `themeVars()`;
 * the Phase 11 extension popup imports them directly. All hex values are lowercase.
 */
export const tokens = {
	color: {
		white: '#ffffff',
		background: '#fbf7f0',
		surface: '#f2e9db',
		card: '#fffdf9',
		foreground: '#2b1d16',
		'muted-foreground': '#5c4a3e',
		primary: '#a4452a',
		'primary-hover': '#87361f',
		'primary-foreground': '#ffffff',
		secondary: '#4f6449',
		'secondary-surface': '#e4eadf',
		'accent-surface': '#f6e3d8',
		border: '#e2d5c3',
		'border-strong': '#8a7462',
		ring: '#a4452a',
		destructive: '#a1271f',
		'deco-terracotta': '#c8714e',
		'deco-sage': '#8fa386',
		// Phase 3 shadcn-svelte aliases: each reuses an existing Phase 2 hex (no new colors).
		'card-foreground': '#2b1d16',
		popover: '#fffdf9',
		'popover-foreground': '#2b1d16',
		muted: '#f2e9db',
		accent: '#f2e9db',
		'accent-foreground': '#2b1d16',
		input: '#8a7462',
		'destructive-foreground': '#ffffff'
	},
	font: {
		display: "'Fraunces Variable', Georgia, 'Times New Roman', serif",
		sans: "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
	},
	radius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
	shadow: {
		card: '0 1px 2px rgb(43 29 22 / 0.06), 0 8px 24px -12px rgb(43 29 22 / 0.18)',
		'card-hover': '0 2px 4px rgb(43 29 22 / 0.08), 0 16px 32px -16px rgb(43 29 22 / 0.24)'
	},
	ease: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
	container: { page: '70rem', reading: '40rem' }
} as const;

/** Motion durations in ms. NOT emitted to @theme (--duration-* is not a Tailwind namespace, RESEARCH Pitfall 4); components use duration-150 / duration-200. Kept for the Phase 11 popup. */
export const motion = { fast: 150, base: 200 } as const;

export type BrandTokens = typeof tokens;
export type ColorToken = keyof typeof tokens.color;
export type Pair = {
	fg: ColorToken;
	bg: ColorToken;
	min: 4.5 | 3;
	kind: 'text' | 'large-text' | 'ui';
};

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG 2.2 relative luminance of a `#rrggbb` color. */
export function luminance(hex: string): number {
	const n = parseInt(hex.replace('#', ''), 16);
	return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** WCAG 2.2 contrast ratio (1..21), order-independent. */
export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = [
	'background',
	'surface',
	'card',
	'secondary-surface',
	'accent-surface'
] as const satisfies readonly ColorToken[];

const TEXT_FOREGROUNDS = [
	'foreground',
	'muted-foreground',
	'primary',
	'primary-hover',
	'secondary',
	'destructive'
] as const satisfies readonly ColorToken[];

/**
 * The UI-SPEC contrast matrix, by token NAME. Decorative tokens (deco-*, border) are
 * deliberately absent as foregrounds: they may never carry text or meaningful UI.
 */
export const contrastPairs: readonly Pair[] = Object.freeze([
	// Body/heading/link text on every surface.
	...TEXT_FOREGROUNDS.flatMap((fg) =>
		SURFACES.map((bg): Pair => ({ fg, bg, min: 4.5, kind: 'text' }))
	),
	// Text on filled buttons.
	{ fg: 'primary-foreground', bg: 'primary', min: 4.5, kind: 'text' },
	{ fg: 'primary-foreground', bg: 'primary-hover', min: 4.5, kind: 'text' },
	{ fg: 'background', bg: 'primary', min: 4.5, kind: 'text' },
	// Focus ring and input borders on every surface.
	...(['ring', 'border-strong'] as const).flatMap((fg) =>
		SURFACES.map((bg): Pair => ({ fg, bg, min: 3, kind: 'ui' }))
	),
	// Current-nav indicator.
	{ fg: 'primary', bg: 'background', min: 3, kind: 'ui' },
	{ fg: 'primary', bg: 'surface', min: 3, kind: 'ui' },
	// Phase 3 shadcn primitives: destructive fill label, input/radio/checkbox boundaries,
	// checked radio dot / checkbox fill on card, and the check glyph on the fill.
	{ fg: 'destructive-foreground', bg: 'destructive', min: 4.5, kind: 'text' },
	{ fg: 'input', bg: 'card', min: 3, kind: 'ui' },
	{ fg: 'input', bg: 'surface', min: 3, kind: 'ui' },
	{ fg: 'input', bg: 'background', min: 3, kind: 'ui' },
	{ fg: 'primary', bg: 'card', min: 3, kind: 'ui' },
	{ fg: 'card', bg: 'primary', min: 3, kind: 'ui' },
	// Phase 5 Fair Housing highlights (05-UI-SPEC contrast record). Every text pass row is already
	// covered by the TEXT_FOREGROUNDS x SURFACES matrix and the ring/input rows above; these are the
	// non-text rows it lacks: block underline + OctagonAlert on its fill, warn dashed underline +
	// TriangleAlert on its fill, and the streaming caret on the output box.
	{ fg: 'destructive', bg: 'accent-surface', min: 3, kind: 'ui' },
	{ fg: 'foreground', bg: 'surface', min: 3, kind: 'ui' },
	{ fg: 'foreground', bg: 'background', min: 3, kind: 'ui' },
	// Phase 7 chart series strokes and markers on the figure's card (07-UI-SPEC contrast record).
	// primary and border-strong on card are already above; axis tick text is in the text matrix.
	{ fg: 'secondary', bg: 'card', min: 3, kind: 'ui' },
	{ fg: 'foreground', bg: 'card', min: 3, kind: 'ui' },
	{ fg: 'muted-foreground', bg: 'card', min: 3, kind: 'ui' }
] satisfies Pair[]);

/** Pairs whose ratio falls below their minimum. Empty for the shipped matrix. */
export const failingPairs = (pairs: readonly Pair[] = contrastPairs): Pair[] =>
	pairs.filter((p) => contrastRatio(tokens.color[p.fg], tokens.color[p.bg]) < p.min);

/** Flattens tokens into Tailwind v4 `@theme` custom properties (`--{group}-{name}`). */
export function themeVars(t: BrandTokens = tokens): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [group, values] of Object.entries(t)) {
		for (const [name, value] of Object.entries(values as Record<string, string>)) {
			out[`--${group}-${name}`] = value;
		}
	}
	return out;
}
