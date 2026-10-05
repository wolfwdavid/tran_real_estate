// PWA icon rasterizer: a cream Fraunces 600 "T" on brand terracotta.
//
// Run manually from apps/web and commit the PNGs:
//   node scripts/generate-icons.mjs
// Regenerate only when the brand tokens change (scripts/pwa-assets.test.ts fails if the two hex
// literals below drift from @tran/brand). It lives in apps/web so `@playwright/test` and
// `@fontsource-variable/fraunces` resolve. The data: font exists only inside this local generator
// page (setContent) and never ships; the shipped PNGs are opaque screenshots.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const PRIMARY = '#a4452a'; // = @tran/brand tokens.color.primary (parity-tested)
const BACKGROUND = '#fbf7f0'; // = @tran/brand tokens.color.background (parity-tested)

const require = createRequire(new URL('../package.json', import.meta.url));
const font = readFileSync(
	require.resolve('@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2')
).toString('base64');
const out = new URL('../static/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

// Any-purpose icons: glyph at 0.7 x size. Maskable: 0.56 x size keeps the glyph inside the
// central 80% safe zone while the terracotta stays full-bleed.
const html = (size, safe) => `<!doctype html><style>
@font-face{font-family:F;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
html,body{margin:0}div{width:${size}px;height:${size}px;background:${PRIMARY};color:${BACKGROUND};display:grid;place-items:center;
font:600 ${Math.round(size * (safe ? 0.56 : 0.7))}px/1 F}</style><div>T</div>`;

const icons = [
	['icon-192.png', 192, false],
	['icon-512.png', 512, false],
	['icon-maskable-512.png', 512, true],
	['apple-touch-icon-180.png', 180, false]
];

const browser = await chromium.launch();
try {
	const page = await browser.newPage({ deviceScaleFactor: 1 });
	for (const [name, size, safe] of icons) {
		await page.setViewportSize({ width: size, height: size });
		await page.setContent(html(size, safe));
		await page.evaluate(() => document.fonts.ready);
		const loaded = await page.evaluate(() => document.fonts.check('600 64px F'));
		if (!loaded)
			throw new Error(`Fraunces did not load for ${name}; refusing a fallback-font icon`);
		writeFileSync(
			new URL(name, out),
			await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } })
		);
		console.log(`wrote static/icons/${name} (${size}x${size})`);
	}
} finally {
	await browser.close();
}
