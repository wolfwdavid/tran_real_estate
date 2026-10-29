import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { resolveSiteOrigin } from '../web/src/lib/site-config.js';

// Popup component tests in real Chromium (UI-SPEC Accessibility Contract: axe on every popup
// state). Deliberately NOT listed in the root vitest.config.ts projects, so `pnpm test:unit` stays
// browser-free; run with `pnpm --filter extension test:browser`. App.svelte receives its browser
// wiring as a prop, so no WXT plugin is needed and wxt/browser is never imported here.

// Same Windows PATH guard as apps/web: Chromium teardown shells out to taskkill, which fails
// silently when PATH omits System32 and leaves the run hanging.
if (process.platform === 'win32') {
	const system32 = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	const entries = (process.env.PATH ?? '').split(';');
	if (!entries.some((e) => e.toLowerCase() === system32.toLowerCase())) {
		process.env.PATH = [system32, ...entries].join(';');
	}
}

export default defineConfig({
	plugins: [svelte()],
	define: { __TRAN_ORIGIN__: JSON.stringify(resolveSiteOrigin()) },
	// Discover every dependency up front: a dep found mid-run (an individual @lucide/svelte icon)
	// is re-optimized and reloads the page, which can load a second Svelte runtime.
	optimizeDeps: {
		entries: ['tests/browser/**/*.browser.test.ts', 'src/entrypoints/popup/**/*.svelte']
	},
	test: {
		name: 'extension-browser',
		include: ['tests/browser/**/*.browser.test.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts'],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: 'chromium' }]
		}
	}
});
