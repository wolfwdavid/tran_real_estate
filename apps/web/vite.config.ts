import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { files, MAX_WORKERS } from '../../tooling/vitest/lanes';
import kitOptions from './kit.options.js';
import {
	resolveAnalytics,
	resolveContactEmail,
	resolveSiteUrl,
	resolveWeb3formsKey
} from './src/lib/site-config.js';

// Kit's Vite plugin pins Vite's root to process.cwd() at import time. Under the root Vitest
// `projects` harness (cwd = repo root) it would then look for src/app.html
// in the wrong directory and hide this package's tests. Unit tests only need the Svelte compiler
// and the $app/paths stub, so they use the plain plugin (#lib/* resolves through package.json imports); dev, build and check keep the Kit plugin.
const isVitest = process.env.VITEST === 'true';

// Phase 10 owner settings, validated once (src/lib/site-config.js). Read them in app code only
// through #lib/site; absolute URLs come from __SITE_URL__, never from the relative `base`.
const analytics = resolveAnalytics();

export default defineConfig({
	plugins: isVitest ? [svelte()] : [tailwindcss(), sveltekit(kitOptions)],
	// Vitest 5 runs the Svelte plugin's config hook before it applies the project root, so under the
	// root `projects` run (cwd = repo root) the plugin scanned the wrong package.json and left
	// @lucide/svelte and bits-ui external ("Unknown file extension .svelte"). Pin the root.
	root: isVitest ? fileURLToPath(new URL('.', import.meta.url)) : undefined,
	resolve: isVitest
		? {
				alias: {
					'$app/paths': fileURLToPath(
						new URL('./src/lib/testing/app-paths.stub.ts', import.meta.url)
					)
				}
			}
		: undefined,
	// UI-SPEC: no data: URIs for fonts or SVG; every asset ships as a hashed same-origin file.
	build: {
		assetsInlineLimit: 0,
		// Kit 3 compiles every route node as a dynamic import, and Vite lists each node's JS chunks
		// in a dependency table inside app.js that every page downloads. Keep only the CSS in that
		// table: the JS chunks still load through the module graph, and the service worker precaches
		// them all, so the table was ~2 KB gz of initial JS for no benefit.
		modulePreload: {
			resolveDependencies: (_file, deps, { hostType }) =>
				hostType === 'js' ? deps.filter((d) => d.endsWith('.css')) : deps
		}
	},
	// Top level, so dev, build, SSR/prerender and the Vitest branch all get the same constants.
	define: {
		__BUILD_YEAR__: JSON.stringify(new Date().getFullYear()),
		__SITE_URL__: JSON.stringify(resolveSiteUrl()),
		__ANALYTICS_HOST__: JSON.stringify(analytics.host),
		__ANALYTICS_WEBSITE_ID__: JSON.stringify(analytics.websiteId),
		__WEB3FORMS_KEY__: JSON.stringify(resolveWeb3formsKey()),
		__CONTACT_EMAIL__: JSON.stringify(resolveContactEmail())
	},
	test: {
		name: 'web',
		maxWorkers: MAX_WORKERS,
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		// *.browser.test.ts belong to the web-browser project (vitest.browser.config.ts); files('web')
		// run in web-serial (tooling/vitest/lanes.ts).
		exclude: ['src/**/*.browser.test.ts', 'node_modules/**', ...files('web')],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
