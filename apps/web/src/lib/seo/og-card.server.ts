import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { tokens } from '@tran/brand';
import { CONTOUR_PATHS, OG_MARKS } from './og-marks.js';
import { woffToSfnt } from './woff.server.js';

/**
 * Share-card renderer (GTM-03, UI-SPEC "OG Share Cards", RESEARCH Pattern 5 / Pitfall 4).
 * A hand-authored 1200x630 SVG built from brand tokens, rasterised by resvg with ONLY the site's
 * own fonts: `loadSystemFonts: false` keeps Windows and CI identical, and a missing font throws
 * instead of silently rendering a text-less card.
 */
export interface OgCard {
	eyebrow: string;
	titleLines: readonly string[];
	subline: string;
	mark: 'renter' | 'investor' | null;
}

/** nameID 1 of each static Fontsource file (asserted in woff.server.test.ts). */
export const OG_FONT_FAMILY = {
	display: 'Fraunces SemiBold',
	body: 'Inter',
	bodySemibold: 'Inter SemiBold'
} as const;

const FONT_SOURCES = [
	['fraunces-600.ttf', '@fontsource/fraunces/files/fraunces-latin-600-normal.woff'],
	['inter-400.ttf', '@fontsource/inter/files/inter-latin-400-normal.woff'],
	['inter-600.ttf', '@fontsource/inter/files/inter-latin-600-normal.woff']
] as const;

function convertFonts(): string[] {
	const req = createRequire(import.meta.url);
	// resvg-js 2.6.2 takes font FILE PATHS, not buffers: write the converted SFNTs to a temp dir once.
	const dir = mkdtempSync(join(tmpdir(), 'tran-og-'));
	process.once('exit', () => rmSync(dir, { recursive: true, force: true }));
	return FONT_SOURCES.map(([name, spec]) => {
		let woff: Buffer;
		try {
			woff = readFileSync(req.resolve(spec));
		} catch (cause) {
			throw new Error(`share-card font missing: ${spec}`, { cause });
		}
		const path = join(dir, name);
		writeFileSync(path, woffToSfnt(woff));
		return path;
	});
}

const FONT_FILES = convertFonts();

const W = 1200;
const H = 630;
const PAD = 80;
const TITLE_SIZE = 80;
const TITLE_LEADING = 88; // 80px x 1.1
const EYEBROW_BASELINE = 108; // 80px top padding + Inter 600 28px cap height
const TITLE_BASELINE = 212; // 24px below the eyebrow box + the 80px title's ascent
const SUBLINE_GAP = 64; // last title baseline -> subline baseline (title descent + 24px + subline ascent)
const BAR = 12;
const WORDMARK_BASELINE = H - BAR - PAD; // 538: 80px above the bottom bar
const DISC = { cx: 960, cy: 300, r: 160 };
const MARK = 192;

const esc = (s: string) => s.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function ogCardSvg(card: OgCard): string {
	const c = tokens.color;
	const titleBaselines = card.titleLines.map((_, i) => TITLE_BASELINE + i * TITLE_LEADING);
	const lastTitle = titleBaselines.at(-1) ?? TITLE_BASELINE;
	const tspans = card.titleLines
		.map((t, i) => `<tspan x="${PAD}" y="${titleBaselines[i]}">${esc(t)}</tspan>`)
		.join('');
	const mark = card.mark
		? `<circle cx="${DISC.cx}" cy="${DISC.cy}" r="${DISC.r}" fill="${c['accent-surface']}"/>` +
			`<svg x="${DISC.cx - MARK / 2}" y="${DISC.cy - MARK / 2}" width="${MARK}" height="${MARK}" viewBox="0 0 64 64">${OG_MARKS[card.mark]}</svg>`
		: '';
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
		'<defs>',
		`<clipPath id="canvas"><rect width="${W}" height="${H}"/></clipPath>`,
		`<radialGradient id="tint-tr" gradientUnits="userSpaceOnUse" cx="1100" cy="0" r="640">`,
		`<stop offset="0" stop-color="${c['accent-surface']}"/><stop offset="1" stop-color="${c['accent-surface']}" stop-opacity="0"/>`,
		'</radialGradient>',
		`<radialGradient id="tint-bl" gradientUnits="userSpaceOnUse" cx="0" cy="${H}" r="560">`,
		`<stop offset="0" stop-color="${c['secondary-surface']}"/><stop offset="1" stop-color="${c['secondary-surface']}" stop-opacity="0"/>`,
		'</radialGradient>',
		'</defs>',
		`<rect width="${W}" height="${H}" fill="${c.background}"/>`,
		`<rect width="${W}" height="${H}" fill="url(#tint-tr)"/>`,
		`<rect width="${W}" height="${H}" fill="url(#tint-bl)"/>`,
		`<g clip-path="url(#canvas)"><svg x="${W - 480}" y="0" width="480" height="360" viewBox="0 0 480 360">${CONTOUR_PATHS}</svg></g>`,
		mark,
		`<text x="${PAD}" y="${EYEBROW_BASELINE}" font-family="${OG_FONT_FAMILY.bodySemibold}" font-weight="600" font-size="28" letter-spacing="1.68" fill="${c.secondary}">${esc(card.eyebrow.toUpperCase())}</text>`,
		`<text font-family="${OG_FONT_FAMILY.display}" font-weight="600" font-size="${TITLE_SIZE}" fill="${c.foreground}">${tspans}</text>`,
		`<text x="${PAD}" y="${lastTitle + SUBLINE_GAP}" font-family="${OG_FONT_FAMILY.body}" font-weight="400" font-size="32" fill="${c['muted-foreground']}">${esc(card.subline)}</text>`,
		`<text x="${PAD}" y="${WORDMARK_BASELINE}" font-family="${OG_FONT_FAMILY.display}" font-weight="600" font-size="48" fill="${c.foreground}">Tran Real Estate Tools</text>`,
		`<rect x="0" y="${H - BAR}" width="${W}" height="12" fill="${c.primary}"/>`,
		'</svg>'
	].join('');
}

export function renderOgCard(card: OgCard, opts: { fontFiles?: string[] } = {}) {
	return new Resvg(ogCardSvg(card), {
		font: {
			loadSystemFonts: false,
			fontFiles: opts.fontFiles ?? FONT_FILES,
			defaultFontFamily: OG_FONT_FAMILY.body
		},
		fitTo: { mode: 'original' }
	}).render();
}
