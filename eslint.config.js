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
// The Phase 3 global restriction lists, hoisted so the lib/ai block below can repeat them:
// flat config REPLACES a rule's options per matching block, it never merges them.
const GLOBAL_RESTRICTED_GLOBALS = [
	{
		name: 'confirm',
		message: 'Use ConfirmDialog (03-UI-SPEC): window.confirm is not accessible.'
	}
];
const GLOBAL_RESTRICTED_PROPERTIES = [
	{ object: 'window', property: 'confirm', message: 'Use ConfirmDialog (03-UI-SPEC).' }
];
const NO_SEND = 'No sending from the AI layer (AI-04: a person sends, never the code).';
const NO_NAV = 'No programmatic navigation from the AI layer (AI-04).';
const forbid = (mods, message) => ({
	group: mods.flatMap((m) => [`$lib/${m}`, `$lib/${m}/**`, `**/lib/${m}`, `**/lib/${m}/**`]),
	message
});
// Phase 6: the map libraries are lazy-loaded from ONE folder (the Map tab). Merged into EVERY
// no-restricted-imports entry below except the map folder's own override, which comes last.
const MAP_LIBS = {
	group: ['leaflet', 'leaflet/**', 'supercluster', 'supercluster/**'],
	message:
		'Leaflet and supercluster load lazily, only inside lib/features/shared/listings/map (Map tab).'
};
const PORTAL_FOLDERS = PORTALS.map((p) => `features/${p}`);
const SHARED_NO_PORTALS = forbid(
	PORTAL_FOLDERS,
	'Shared features must not import a portal folder.'
);
const restricted = (...patterns) => ['error', { patterns }];
// Phase 8: the agent CRM spends zero RentCast calls (AGT-02/AGT-04). Bans the gateway port itself,
// not only its internals. Phase 9's studio routes are carved out below.
const AGENT_NO_GATEWAY = forbid(
	['data'],
	'The agent CRM never touches the RentCast gateway. Market data features live in features/studio (Phase 9).'
);

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
			'no-restricted-globals': ['error', ...GLOBAL_RESTRICTED_GLOBALS],
			'no-restricted-properties': ['error', ...GLOBAL_RESTRICTED_PROPERTIES]
		}
	},
	{
		// Key material must never reach a console (CONTEXT: never leak keys).
		files: [`${WEB}/lib/storage/secrets/**`],
		rules: { 'no-console': 'error' }
	},
	{
		// Phase 6 catch-all: no file may import the map libraries. Every more specific entry below
		// repeats MAP_LIBS (flat config replaces options); only the map folder override drops it.
		files: [`${WEB}/**/*.{ts,js,svelte}`],
		rules: { 'no-restricted-imports': restricted(MAP_LIBS) }
	},
	{
		// Catch-all data-port boundary. Marketing forbids all of data below; portals re-merge DATA_INTERNALS.
		files: [`${WEB}/**/*.{ts,js,svelte}`],
		ignores: [`${WEB}/lib/data/**`],
		rules: { 'no-restricted-imports': restricted(DATA_INTERNALS, MAP_LIBS) }
	},
	{
		// Phase 3 storage hosts the Phase 4 tables (TranDb version block, backup registry), so these
		// files may import the table schema module $lib/data/tables and nothing else from lib/data.
		files: [`${WEB}/lib/storage/*.ts`],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							...DATA_INTERNALS,
							group: [...DATA_INTERNALS.group, '!$lib/data/tables', '!**/lib/data/tables']
						},
						MAP_LIBS
					]
				}
			]
		}
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
						),
						MAP_LIBS
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
						// Merged into the SAME entry as the cross-portal ban: a later agent-only block
						// would replace these patterns instead of adding to them (flat config).
						...(p === 'agent' ? [AGENT_NO_GATEWAY] : []),
						DATA_INTERNALS,
						MAP_LIBS
					]
				}
			]
		}
	})),
	{
		// Phase 9 Market Studio carve-out: the snapshot routes (and features/studio) legitimately
		// read market data through the gateway port. This narrower, later entry REPLACES the agent
		// entry's patterns for these files: the cross-portal ban stays, the gateway ban does not.
		files: [`${WEB}/routes/(app)/agent/studio/**`, `${WEB}/lib/features/studio/**`],
		rules: {
			'no-restricted-imports': restricted(
				forbid(
					['features/renter', 'features/investor'],
					'The agent portal may import only features/agent, features/studio and features/shared.'
				),
				DATA_INTERNALS,
				MAP_LIBS
			)
		}
	},
	{
		// The public inquiry page (/agent/inquire/) runs in a lead's browser with no app state:
		// no Dexie, no vault, no AI, no data layer, no portal features.
		files: [`${WEB}/routes/(public)/**`],
		rules: {
			'no-restricted-imports': restricted(
				forbid(
					['storage', 'ai', 'data', 'security', 'features'],
					"The public inquiry page runs in a visitor's browser: it may import only lib/leads, lib/components and @tran/core."
				),
				MAP_LIBS
			)
		}
	},
	{
		// features/shared is reused by every portal (and Phase 10 marketing): never a portal folder.
		files: [`${WEB}/lib/features/shared/**`],
		rules: { 'no-restricted-imports': restricted(SHARED_NO_PORTALS, DATA_INTERNALS, MAP_LIBS) }
	},
	{
		files: [`${WEB}/lib/features/shared/affordability/**`],
		rules: {
			'no-restricted-imports': restricted(
				forbid(
					['storage', 'data', 'ai', ...PORTAL_FOLDERS],
					'The affordability calculator is reused on a marketing page: core and UI primitives only.'
				),
				DATA_INTERNALS,
				MAP_LIBS
			)
		}
	},
	{
		// AI-04 "no auto-send" boundary. Deliberately uses rule names DISTINCT from
		// no-restricted-syntax, which the providers folder turns off, so this block also binds
		// lib/ai/providers/**. Every list repeats the earlier entries it would otherwise replace.
		files: [`${WEB}/lib/ai/**`],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						DATA_INTERNALS,
						MAP_LIBS,
						{
							group: [
								...forbid(['leads'], '').group,
								'**/leads',
								'**/leads/**',
								'*web3forms*',
								'**/*web3forms*'
							],
							message: 'AI modules must never import lead delivery (no auto-send).'
						}
					]
				}
			],
			'no-restricted-globals': [
				'error',
				...GLOBAL_RESTRICTED_GLOBALS,
				{ name: 'XMLHttpRequest', message: NO_SEND },
				{ name: 'WebSocket', message: NO_SEND },
				{ name: 'EventSource', message: NO_SEND },
				{ name: 'open', message: NO_NAV }
			],
			'no-restricted-properties': [
				'error',
				...GLOBAL_RESTRICTED_PROPERTIES,
				{ object: 'navigator', property: 'sendBeacon', message: NO_SEND },
				{ object: 'window', property: 'open', message: NO_NAV },
				{ object: 'location', property: 'assign', message: NO_NAV },
				{ object: 'location', property: 'replace', message: NO_NAV }
			]
		}
	},
	{
		// The ONE folder that may import leaflet/supercluster. Placed after every other
		// no-restricted-imports entry; it re-states the shared restrictions WITHOUT MAP_LIBS.
		files: [`${WEB}/lib/features/shared/listings/map/**`],
		rules: { 'no-restricted-imports': restricted(SHARED_NO_PORTALS, DATA_INTERNALS) }
	},
	{
		files: [`${WEB}/lib/security/sanitize-html.svelte`],
		rules: { 'svelte/no-at-html-tags': 'off' }
	}
);
