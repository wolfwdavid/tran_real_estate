import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';
import { PAGE_A, ZILLOW_URL } from './zillow-page';

/**
 * Edge Add-ons store screenshots. Synthetic fixture only, never live Zillow: the one page is the
 * hand-written fixture fulfilled from a context route at a zillow.com URL, every other http(s)
 * request is aborted and asserted absent. Re-run with `pnpm --filter extension capture:store`
 * after any popup or content-script visual change, then review the PNGs before committing.
 */

const EXT_DIR = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const OUT_DIR = path.resolve(import.meta.dirname, '../store/screenshots');
const DIMMED = '[data-tran-slf="dimmed"]';

// Presentation only: lays the fixture list out as a results grid. Fixture text and attributes are
// never changed.
const GRID_CSS = `
body { font-family: system-ui, sans-serif; background: #f6f4ef; margin: 0; }
#grid-search-results ul { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
  padding: 24px; margin: 0; list-style: none; }
#grid-search-results li article { background: #fff; border: 1px solid #d9d4c7; border-radius: 8px;
  padding: 16px; min-height: 160px; }
`;

async function launch(headless: boolean): Promise<{ ctx: BrowserContext; worker?: Worker }> {
	const ctx = await chromium.launchPersistentContext('', {
		channel: 'chromium',
		headless,
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1,
		reducedMotion: 'reduce',
		args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`]
	});
	// 15 s is the measured precedent of extension.spec.ts (whole 7-test suite incl. one launch in
	// 3.6 s, 15-03 run 2026-11-09).
	const worker =
		ctx.serviceWorkers()[0] ??
		(await ctx.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => undefined));
	return { ctx, worker };
}

test('capture store screenshots', async () => {
	if (!existsSync(path.join(EXT_DIR, 'manifest.json'))) {
		throw new Error(`No production build at ${EXT_DIR}. Run pnpm ext:build first.`);
	}
	if (path.basename(EXT_DIR).endsWith('-dev')) {
		throw new Error(`Refusing to capture a dev build (${EXT_DIR}).`);
	}

	let launched = await launch(true);
	if (!launched.worker && !process.env.CI) {
		await launched.ctx.close();
		launched = await launch(false);
	}
	if (!launched.worker) {
		await launched.ctx.close();
		throw new Error('The extension service worker never started (extension not loaded).');
	}
	const { ctx, worker } = launched;

	try {
		const extId = new URL(worker.url()).host;
		const seen: string[] = [];
		ctx.on('request', (r) => seen.push(r.url()));
		await ctx.route('**/*', (route) => {
			const url = route.request().url();
			if (url === ZILLOW_URL) {
				return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE_A });
			}
			if (/^https?:/i.test(url)) return route.abort();
			return route.fallback();
		});

		mkdirSync(OUT_DIR, { recursive: true });
		const page = await ctx.newPage();
		await page.goto(ZILLOW_URL);
		await page.addStyleTag({ content: GRID_CSS });
		await expect(page.locator(DIMMED)).toHaveCount(3);
		await page.screenshot({ path: path.join(OUT_DIR, '01-dimmed-results.png') });

		await page.locator('#a-1 > tran-slf-pill').click();
		await expect(page.locator('#a-1')).toHaveAttribute('data-tran-slf', 'revealed');
		await page.screenshot({ path: path.join(OUT_DIR, '02-reveal-card.png') });
		await page.locator('#a-1 > tran-slf-pill').click();

		const popup = await ctx.newPage();
		await popup.goto(`chrome-extension://${extId}/popup.html`);
		await expect(popup.getByRole('switch')).toBeVisible();
		await popup.screenshot({ path: path.join(OUT_DIR, '03-popup.png') });

		expect(seen.filter((u) => /^https?:/i.test(u) && u !== ZILLOW_URL)).toEqual([]);
	} finally {
		await ctx.close();
	}
});
