import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

const WEB = 'apps/web/src';
const PORTALS = ['renter', 'investor', 'agent'];
const restrictedSyntax = [
	{
		selector: "CallExpression[callee.name='fetch']",
		message:
			'fetch is allowed only in adapter folders (lib/data/rentcast, lib/ai/providers, lib/leads).'
	},
	{
		selector:
			"CallExpression[callee.type='MemberExpression'][callee.property.name='fetch'][callee.object.name=/^(window|globalThis|self)$/]",
		message: 'fetch is allowed only in adapter folders.'
	},
	{
		// Layer 1 of the "10 re-renders spend 0" defense: a reactive effect must never spend a call.
		selector:
			"CallExpression:matches([callee.name='$effect'], [callee.object.name='$effect']) CallExpression[callee.property.name=/^(get|refresh|testKey|rentalListingById|runDue|runDueSearches)$/][callee.object.name=/(gateway|scheduler)$/i]",
		message:
			'Never spend RentCast calls from $effect. Read with gateway.peek() and spend only in event handlers or the scheduler.'
	}
];
// Merged into EVERY no-restricted-imports entry for apps/web/src: flat config replaces rule options,
// so a pattern set only in a catch-all entry would be dropped by the per-portal entries below.
const DATA_INTERNALS = {
	group: ['$lib/data/*', '$lib/data/**', '**/lib/data/*', '**/lib/data/**'],
	message:
		'Import the data layer only through $lib/data (the gateway port). Internals stay inside lib/data.'
};
const forbid = (mods, message) => ({
	group: mods.flatMap((m) => [`$lib/${m}`, `$lib/${m}/**`, `**/lib/${m}`, `**/lib/${m}/**`]),
	message
});

export default defineConfig(
	{ ignores: ['**/build/', '**/build-sub/', '**/.svelte-kit/', '**/test-results/', '.planning/'] },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], parser: ts.parser }
		}
	},
	{
		files: ['**/*.{ts,js,mjs,svelte}'],
		rules: { 'no-restricted-syntax': ['error', ...restrictedSyntax] }
	},
	{
		files: [`${WEB}/lib/data/rentcast/**`, `${WEB}/lib/ai/providers/**`, `${WEB}/lib/leads/**`],
		rules: { 'no-restricted-syntax': 'off' }
	},
	{
		// The SvelteKit service worker must forward same-origin precache misses to the network.
		// Scoped to this ONE file; every other module keeps the Phase 1 fetch ban.
		files: [`${WEB}/service-worker.ts`],
		rules: { 'no-restricted-syntax': 'off' }
	},
	{
		// Only sets these two rules; it never re-enables or overrides the fetch ban above.
		files: [`${WEB}/**/*.{ts,js,svelte}`],
		rules: {
			'no-restricted-globals': [
				'error',
				{
					name: 'confirm',
					message: 'Use ConfirmDialog (03-UI-SPEC): window.confirm is not accessible.'
				}
			],
			'no-restricted-properties': [
				'error',
				{ object: 'window', property: 'confirm', message: 'Use ConfirmDialog (03-UI-SPEC).' }
			]
		}
	},
	{
		// Key material must never reach a console (CONTEXT: never leak keys).
		files: [`${WEB}/lib/storage/secrets/**`],
		rules: { 'no-console': 'error' }
	},
	{
		// Catch-all data-port boundary. Marketing forbids all of data below; portals re-merge DATA_INTERNALS.
		files: [`${WEB}/**/*.{ts,js,svelte}`],
		ignores: [`${WEB}/lib/data/**`],
		rules: { 'no-restricted-imports': ['error', { patterns: [DATA_INTERNALS] }] }
	},
	{
		files: [`${WEB}/routes/(marketing)/**`],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						forbid(
							['storage', 'ai', 'data'],
							'Marketing routes must not import storage, AI, or data modules.'
						)
					]
				}
			]
		}
	},
	...PORTALS.map((p) => ({
		files: [`${WEB}/routes/(app)/${p}/**`, `${WEB}/lib/features/${p}/**`],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						forbid(
							PORTALS.filter((o) => o !== p).map((o) => `features/${o}`),
							`The ${p} portal may import only features/${p} and features/shared.`
						),
						DATA_INTERNALS
					]
				}
			]
		}
	})),
	{
		files: [`${WEB}/lib/security/sanitize-html.svelte`],
		rules: { 'svelte/no-at-html-tags': 'off' }
	}
);
