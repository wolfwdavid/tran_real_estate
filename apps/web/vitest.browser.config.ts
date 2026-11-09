import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';
import { files, MAX_WORKERS } from '../../tooling/vitest/lanes';

// Component tests in real Chromium (UI-SPEC: primitives get vitest-browser-svelte tests that assert
// exact text, icon presence and an axe scan). The Node `web` project excludes *.browser.test.ts, so
// each file runs in exactly one project. The shared no-network setup file stays active here too:
// module loading uses native import, not fetch, so the ban coexists with browser mode.

// Windows: Playwright tears child processes down with taskkill via cmd.exe; the guard puts the
// system directory on PATH first or teardown hangs silently (scripts/lib/windows-path.mjs).
ensureSystem32OnPath();

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	// Discover every dependency up front by scanning the component tests as entries. On a cold Vite
	// cache, deps found mid-run (bits-ui, individual @lucide/svelte icons) were re-optimized and the
	// page reloaded, which loaded a second Svelte runtime and failed tests with effect_orphan.
	optimizeDeps: {
		entries: ['src/**/*.browser.test.ts', 'src/**/*.svelte'],
		include: ['bits-ui']
	},
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			'$app/paths': fileURLToPath(new URL('./src/lib/testing/app-paths.stub.ts', import.meta.url))
		}
	},
	test: {
		name: 'web-browser',
		include: ['src/**/*.browser.test.ts'],
		exclude: [...configDefaults.exclude, ...files('web-browser')],
		// The browser pool ignores the root maxWorkers; same constant, or Vitest rejects the group
		// (tooling/vitest/lanes.ts).
		maxWorkers: MAX_WORKERS,
		setupFiles: ['../../tooling/vitest/no-network.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
