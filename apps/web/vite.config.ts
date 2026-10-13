import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { resolveBasePath } from './src/lib/base-path.js';
import {
	resolveAnalytics,
	resolveContactEmail,
	resolveSiteOrigin,
	resolveWeb3formsKey
} from './src/lib/site-config.js';

// Kit's Vite plugin pins Vite's root to process.cwd() at import time. Under the root Vitest
// `projects` harness (cwd = repo root) it would then look for svelte.config.js and src/app.html
// in the wrong directory and hide this package's tests. Unit tests only need the Svelte compiler
// and the $lib alias, so they use the plain plugin; dev, build and check keep the Kit plugin.
const isVitest = process.env.VITEST === 'true';

// Phase 10 owner settings, validated once (src/lib/site-config.js). Read them in app code only
// through $lib/site; absolute URLs come from __SITE_URL__, never from the relative `base`.
const analytics = resolveAnalytics();

export default defineConfig({
	plugins: isVitest ? [svelte()] : [tailwindcss(), sveltekit()],
	resolve: isVitest
		? {
				alias: {
					$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
					'$app/paths': fileURLToPath(
						new URL('./src/lib/testing/app-paths.stub.ts', import.meta.url)
					)
				}
			}
		: undefined,
	// UI-SPEC: no data: URIs for fonts or SVG; every asset ships as a hashed same-origin file.
	build: { assetsInlineLimit: 0 },
	// Top level, so dev, build, SSR/prerender and the Vitest branch all get the same constants.
	define: {
		__BUILD_YEAR__: JSON.stringify(new Date().getFullYear()),
		__SITE_URL__: JSON.stringify(resolveSiteOrigin() + resolveBasePath()),
		__ANALYTICS_HOST__: JSON.stringify(analytics.host),
		__ANALYTICS_WEBSITE_ID__: JSON.stringify(analytics.websiteId),
		__WEB3FORMS_KEY__: JSON.stringify(resolveWeb3formsKey()),
		__CONTACT_EMAIL__: JSON.stringify(resolveContactEmail())
	},
	test: {
		name: 'web',
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		// *.browser.test.ts belong to the web-browser project (vitest.browser.config.ts).
		exclude: ['src/**/*.browser.test.ts', 'node_modules/**'],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
