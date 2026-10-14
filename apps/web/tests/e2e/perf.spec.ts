import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Landing layout-shift budget (GTM-01, 10-20; RESEARCH Pattern 8 "CLS < 0.1"; UI-SPEC "Hydration
// and layout shift"). The prerendered landing is the first-visit guide (step 0); a returning
// visitor's stored state swaps it for the compact row after hydration, which is the one place the
// guide could shift the page. Measured on the root build at 375 and 1280 px for both states with a
// buffered PerformanceObserver for 'layout-shift', summing entries without hadRecentInput.
//
// Each measurement is appended to apps/web/test-results/cls.json as
// { route: '', viewport: '375x812', state: 'first-visit' | 'returning', cls } — the shape
// scripts/launch-audit.mjs (CLS_REPORT, perfRows) reads. Playwright empties test-results/ at the
// start of every run, so the launch audit must read it after the run that included this spec.

const CLS_FILE = fileURLToPath(new URL('../../test-results/cls.json', import.meta.url));
const KEY = 'tran.onboarding.v1';
const VIEWPORTS = [
	{ width: 375, height: 812 },
	{ width: 1280, height: 800 }
];
const STATES = ['first-visit', 'returning'] as const;

interface ClsRow {
	route: string;
	viewport: string;
	state: (typeof STATES)[number];
	cls: number;
}

test.describe.configure({ mode: 'serial' });

test.describe('landing CLS budget', () => {
	test.beforeEach(() => {
		test.skip(test.info().project.name !== 'root', 'measured once, on the root build');
	});

	test.beforeAll(() => {
		if (test.info().project.name !== 'root') return;
		mkdirSync(dirname(CLS_FILE), { recursive: true });
		writeFileSync(CLS_FILE, '[]\n');
	});

	for (const vp of VIEWPORTS) {
		for (const state of STATES) {
			const viewport = `${vp.width}x${vp.height}`;
			test(`landing layout-shift below 0.1 at ${viewport} (${state})`, async ({ page }) => {
				await page.setViewportSize(vp);
				if (state === 'returning') {
					await page.addInitScript(
						(k) => localStorage.setItem(k, '{"status":"done","lastPortal":"renter"}'),
						KEY
					);
				}
				await page.addInitScript(() => {
					const w = window as unknown as { __cls: number };
					w.__cls = 0;
					new PerformanceObserver((list) => {
						for (const entry of list.getEntries() as unknown as Array<{
							value: number;
							hadRecentInput: boolean;
						}>) {
							if (!entry.hadRecentInput) w.__cls += entry.value;
						}
					}).observe({ type: 'layout-shift', buffered: true });
				});

				await page.goto('');
				await page.waitForLoadState('networkidle');
				// The guide applied the stored state (onMount ran) before the settle window starts.
				await expect(page.locator('#get-started')).toHaveAttribute('data-ready', '');
				if (state === 'returning') {
					await expect(page.locator('#get-started')).toContainText(
						'New here, or want a refresher?'
					);
				}
				await page.waitForTimeout(1_000);

				const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
				const rows = JSON.parse(readFileSync(CLS_FILE, 'utf8')) as ClsRow[];
				rows.push({ route: '', viewport, state, cls });
				writeFileSync(CLS_FILE, `${JSON.stringify(rows, null, 2)}\n`);
				console.log(`[cls] / ${viewport} ${state}: ${cls.toFixed(4)}`);

				expect(cls, `CLS at ${viewport} (${state})`).toBeLessThan(0.1);
			});
		}
	}
});
