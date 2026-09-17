import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Kit's Vite plugin pins Vite's root to process.cwd() at import time. Under the root Vitest
// `projects` harness (cwd = repo root) it would then look for svelte.config.js and src/app.html
// in the wrong directory and hide this package's tests. Unit tests only need the Svelte compiler
// and the $lib alias, so they use the plain plugin; dev, build and check keep the Kit plugin.
const isVitest = process.env.VITEST === 'true';

export default defineConfig({
	plugins: isVitest ? [svelte()] : [tailwindcss(), sveltekit()],
	resolve: isVitest
		? { alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) } }
		: undefined,
	test: {
		name: 'web',
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
