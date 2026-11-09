import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';
import { MAX_WORKERS } from '../../tooling/vitest/lanes';
import { resolveSiteUrl } from '../web/src/lib/site-config.js';

// Popup component tests in real Chromium (UI-SPEC Accessibility Contract: axe on every popup
// state). Deliberately NOT listed in the root vitest.config.ts projects, so `pnpm test:unit` stays
// browser-free; run with `pnpm --filter extension test:browser`. App.svelte receives its browser
// wiring as a prop, so no WXT plugin is needed and wxt/browser is never imported here.

// Windows: Playwright tears child processes down with taskkill via cmd.exe; the guard puts the
// system directory on PATH first or teardown hangs silently (scripts/lib/windows-path.mjs).
ensureSystem32OnPath();

export default defineConfig({
	plugins: [svelte()],
	define: { __TRAN_SITE_URL__: JSON.stringify(resolveSiteUrl()) },
	// Discover every dependency up front: a dep found mid-run (an individual @lucide/svelte icon)
	// is re-optimized and reloads the page, which can load a second Svelte runtime.
	optimizeDeps: {
		entries: ['tests/browser/**/*.browser.test.ts', 'src/entrypoints/popup/**/*.svelte']
	},
	test: {
		name: 'extension-browser',
		include: ['tests/browser/**/*.browser.test.ts'],
		// The browser pool ignores the root maxWorkers; same constant, or Vitest rejects the group
		// (tooling/vitest/lanes.ts).
		maxWorkers: MAX_WORKERS,
		setupFiles: ['../../tooling/vitest/no-network.ts'],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: 'chromium' }]
		}
	}
});
