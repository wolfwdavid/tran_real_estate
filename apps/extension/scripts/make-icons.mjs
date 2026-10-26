// Extension icon + Edge store logo rasterizer: an ivory Fraunces 600 "T" on a terracotta
// rounded square (the Phase 3 mark, see apps/web/scripts/generate-icons.mjs).
//
// Run from the repo root and commit the PNGs:
//   corepack pnpm --filter extension icons
// Regenerate only when the brand tokens change. This is a one-off generator, not part of verify.
// Colors come straight from @tran/brand (relative import: Node 24 strips erasable TS natively, but
// refuses to strip TS resolved through node_modules). The data: font exists only inside this
// local generator page and never ships; the extension bundle references the committed PNGs.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from '../../../packages/brand/src/index.ts';

const PRIMARY = tokens.color.primary;
const GLYPH = tokens.color.background;
/** Font size as a fraction of the square; Fraunces cap height at this size is about 50%. */
const GLYPH_SCALE = 0.72;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const fontDir = join(
	dirname(require.resolve('@fontsource-variable/fraunces/package.json')),
	'files'
);
const font = readFileSync(join(fontDir, 'fraunces-latin-wght-normal.woff2')).toString('base64');

/** UI-SPEC "C. Extension icons" geometry. The store tile uses the same mark full-bleed. */
const specs = [
	{ file: 'public/icon/16.png', canvas: 16, square: 16, inset: 0, radius: 3 },
	{ file: 'public/icon/32.png', canvas: 32, square: 32, inset: 0, radius: 6 },
	{ file: 'public/icon/48.png', canvas: 48, square: 44, inset: 2, radius: 8 },
	{ file: 'public/icon/128.png', canvas: 128, square: 96, inset: 16, radius: 20 },
	{ file: 'store/edge-logo-300.png', canvas: 300, square: 300, inset: 0, radius: 48 }
];

const html = ({ square, inset, radius }) => `<!doctype html><style>
@font-face{font-family:'Fraunces Variable';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
html,body{margin:0;background:transparent}
div{position:absolute;left:${inset}px;top:${inset}px;width:${square}px;height:${square}px;
border-radius:${radius}px;background:${PRIMARY};color:${GLYPH};display:grid;place-items:center;
font:600 ${Math.round(square * GLYPH_SCALE)}px/1 'Fraunces Variable'}</style><div>T</div>`;

const browser = await chromium.launch();
try {
	const page = await browser.newPage({ deviceScaleFactor: 1 });
	for (const spec of specs) {
		const { file, canvas } = spec;
		await page.setViewportSize({ width: canvas, height: canvas });
		await page.setContent(html(spec));
		await page.evaluate(() => document.fonts.ready);
		const loaded = await page.evaluate(() => document.fonts.check("600 64px 'Fraunces Variable'"));
		if (!loaded)
			throw new Error(`Fraunces did not load for ${file}; refusing a fallback-font icon`);
		const path = join(root, file);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			await page.screenshot({
				omitBackground: true,
				clip: { x: 0, y: 0, width: canvas, height: canvas }
			})
		);
		console.log(`wrote ${file} (${canvas}x${canvas})`);
	}
} finally {
	await browser.close();
}
