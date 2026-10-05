import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Component tests in real Chromium (UI-SPEC: primitives get vitest-browser-svelte tests that assert
// exact text, icon presence and an axe scan). The Node `web` project excludes *.browser.test.ts, so
// each file runs in exactly one project. The shared no-network setup file stays active here too:
// module loading uses native import, not fetch, so the ban coexists with browser mode.

// Same Windows PATH guard as playwright.config.ts: Chromium teardown shells out to taskkill, which
// fails silently when PATH omits System32 and leaves the run hanging.
if (process.platform === 'win32') {
	const system32 = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	const entries = (process.env.PATH ?? '').split(';');
	if (!entries.some((e) => e.toLowerCase() === system32.toLowerCase())) {
		process.env.PATH = [system32, ...entries].join(';');
	}
}

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			'$app/paths': fileURLToPath(new URL('./src/lib/testing/app-paths.stub.ts', import.meta.url))
		}
	},
	test: {
		name: 'web-browser',
		include: ['src/**/*.browser.test.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
