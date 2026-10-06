/**
 * Agent-entered brand colors (08-UI-SPEC "Brand colors"). Stored colors are user data; branded
 * output reads ONLY `effectiveBrandColors()`, which swaps any color failing WCAG AA for a Tran
 * token, so a failing pair can never reach a preview, report or PDF.
 *
 * - primary: white text on the color must be >= 4.5:1 (fills with white labels, links on white)
 * - accent:  espresso (`foreground`) text on the color must be >= 4.5:1 (header bands)
 *
 * Reuses the Phase 2 `contrastRatio()`; no new math and no new hex values.
 */
import { contrastRatio, tokens } from './index';

export type BrandRole = 'primary' | 'accent';

/** AA minimum for normal-size text. */
export const BRAND_MIN_RATIO = 4.5;

/** Token fallbacks used whenever an agent color is empty, invalid or fails its check. */
export const BRAND_FALLBACK = {
	primary: tokens.color.primary,
	accent: tokens.color['accent-surface']
} as const;

/** Human names of the fallbacks, for "Tran will use terracotta" copy. */
export const FALLBACK_NAMES: Record<BrandRole, string> = { primary: 'terracotta', accent: 'sand' };

const TEXT_ON: Record<BrandRole, { against: 'white' | 'dark'; text: string }> = {
	primary: { against: 'white', text: tokens.color.white },
	accent: { against: 'dark', text: tokens.color.foreground }
};

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

/** `#rgb` / `rgb` / `#rrggbb` / `rrggbb` (trimmed) → `#RRGGBB`; anything else → null. */
export function normalizeHex(raw: string): string | null {
	const s = raw.trim();
	const six = HEX6.exec(s);
	if (six) return `#${six[1].toUpperCase()}`;
	const three = HEX3.exec(s);
	if (three) {
		const [r, g, b] = three[1].toUpperCase();
		return `#${r}${r}${g}${g}${b}${b}`;
	}
	return null;
}

export type BrandAssessment =
	| { valid: false }
	| {
			valid: true;
			hex: string;
			role: BrandRole;
			against: 'white' | 'dark';
			ratio: number;
			/** One decimal, floored: a failing 4.48 shows "4.4", never a misleading "4.5". */
			displayRatio: string;
			passes: boolean;
	  };

export function assessBrandColor(raw: string, role: BrandRole): BrandAssessment {
	const hex = normalizeHex(raw);
	if (!hex) return { valid: false };
	const { against, text } = TEXT_ON[role];
	const ratio = contrastRatio(text, hex);
	return {
		valid: true,
		hex,
		role,
		against,
		ratio,
		displayRatio: (Math.floor(ratio * 10) / 10).toFixed(1),
		passes: ratio >= BRAND_MIN_RATIO
	};
}

function effective(raw: string | undefined, role: BrandRole): { hex: string; fromAgent: boolean } {
	const a = assessBrandColor(raw ?? '', role);
	return a.valid && a.passes
		? { hex: a.hex, fromAgent: true }
		: { hex: BRAND_FALLBACK[role], fromAgent: false };
}

/** The only colors branded output may use. Empty, invalid or failing inputs resolve to tokens. */
export function effectiveBrandColors(p: { brandPrimary?: string; brandAccent?: string }): {
	primary: string;
	accent: string;
	primaryFromAgent: boolean;
	accentFromAgent: boolean;
} {
	const primary = effective(p.brandPrimary, 'primary');
	const accent = effective(p.brandAccent, 'accent');
	return {
		primary: primary.hex,
		accent: accent.hex,
		primaryFromAgent: primary.fromAgent,
		accentFromAgent: accent.fromAgent
	};
}
