import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

const WEB = 'apps/web/src';
const PORTALS = ['renter', 'investor', 'agent'];
const noFetch = [
	{
		selector: "CallExpression[callee.name='fetch']",
		message:
			'fetch is allowed only in adapter folders (lib/data/rentcast, lib/ai/providers, lib/leads).'
	},
	{
		selector:
			"CallExpression[callee.type='MemberExpression'][callee.property.name='fetch'][callee.object.name=/^(window|globalThis|self)$/]",
		message: 'fetch is allowed only in adapter folders.'
	}
];
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
	{ files: ['**/*.{ts,js,mjs,svelte}'], rules: { 'no-restricted-syntax': ['error', ...noFetch] } },
	{
		files: [`${WEB}/lib/data/rentcast/**`, `${WEB}/lib/ai/providers/**`, `${WEB}/lib/leads/**`],
		rules: { 'no-restricted-syntax': 'off' }
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
						)
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
