/*
 * Test lanes (Phase 15, TEST-01/TEST-04).
 *
 * The parallel lane is every Vitest project in vitest.config.ts (sequence.groupOrder 0, Vitest's
 * default); the serial lane is the *-serial projects, which run one file at a time (fileParallelism
 * false) in later groups: the node lanes (core, web, scripts) at SERIAL_GROUP_ORDER 1, after the
 * parallel group finishes, and web-browser at 2, after every node-serial file has finished. The
 * browser lane gets its own group because Vitest's forks pool and browser pool run side by side
 * inside one group (15-01 measured 8 overlap pairs, e.g. ResultsView.browser beside 6.4 s of ESLint),
 * which defeats load-determinism for exactly the files that flaked.
 *
 * Lane-safety threshold: a test stays in the parallel lane only if its max duration in a full
 * parallel `vitest run` is <= 50% of that lane's default timeout (node 5 s, browser 15 s).
 *
 * Paths are literal files relative to each project root, never globs, so scripts/test-lanes.test.ts
 * can prove each one exists.
 *
 * Do not set VITEST_MAX_WORKERS: it is applied after fileParallelism:false and would run serial
 * files concurrently (vitest.config.ts and serialTest() throw).
 */
import { configDefaults } from 'vitest/config';

export type SerialEntry = { readonly file: string; readonly reason: string };

export const SERIAL = {
	core: [
		{
			file: 'src/fair-housing/mutation.test.ts',
			reason: 'timing: ReDoS budgets (fastest-of-5 < 50/500 ms); launch audit pins this path'
		},
		{
			file: 'src/numbers/numbers.property.test.ts',
			reason: 'timing: property-test ReDoS budget (< 250 ms)'
		},
		{
			file: 'src/leads/parse-freeform.test.ts',
			reason: 'timing: 100k-char paste budget (< 1000 ms)'
		},
		{
			file: 'src/numbers/number-words.test.ts',
			reason: 'timing: adversarial-input budget (< 2000 ms)'
		}
	],
	web: [
		{
			file: 'src/lib/features/studio/boundaries.test.ts',
			reason: 'raised timeout: synchronous import-graph walk (GRAPH_WALK_MS)'
		},
		{
			file: 'src/lib/storage/agent/import-commit.test.ts',
			reason: 'timing + raised timeout: 5000-lead commit < 10 s'
		},
		{
			file: 'src/lib/seo/og-card.server.test.ts',
			reason: 'raised timeout: 1200x630 rasterise + pixel scan'
		}
	],
	'web-browser': [
		{
			file: 'src/lib/features/renter/search/ResultsView.browser.test.ts',
			reason: 'load-sensitive (10 deferred-items): 60 cards + axe, lazy map chunks'
		},
		{
			file: 'src/lib/features/renter/outreach/OutreachSection.browser.test.ts',
			reason: 'raised vi.waitFor: keyless sample draft streams to completion'
		},
		{
			file: 'src/lib/features/shared/data/GatewayError.browser.test.ts',
			reason: 'raised expect.element: real 2 s retry countdown'
		},
		{
			file: 'src/lib/components/tools/calculators.browser.test.ts',
			reason: 'raised expect.poll: debounced live-region announcement'
		}
	],
	scripts: [
		{
			file: 'precommit.test.ts',
			reason: 'spawns real git commit + gitleaks; 56 s worst case under CPU pressure (10-23)'
		},
		{
			file: 'eslint-rules.test.ts',
			reason: 'ESLint lintText cold: 13.5 s under full load (271% of 5 s)'
		},
		{ file: 'origin-parity.test.ts', reason: '7.2 s under full load (144% of 5 s)' },
		{ file: 'site-url.test.ts', reason: '4.3 s under full load (86% of 5 s)' },
		{ file: 'gen-fixtures.test.ts', reason: '3.7 s under full load (74% of 5 s)' },
		{ file: 'commit-hygiene.test.ts', reason: '2.6 s under full load (51% of 5 s)' },
		{
			file: 'lane-order.test.ts',
			reason: 'behavioural lane proof: compares wall-clock start/end order of fixture files'
		},
		{
			file: 'flaky-gate.test.ts',
			reason: 'behavioural flaky-gate proof: spawns Playwright once per case'
		},
		{ file: 'cpu-burn.test.ts', reason: 'spawns a deliberate CPU hog with a wall-clock stop' },
		{
			file: 'lane-configs.test.ts',
			reason:
				'imports apps/web/vite.config.ts (Kit, Tailwind, Svelte plugins): 3.2 s cold, 64% of 5 s'
		}
	]
} as const satisfies Record<string, readonly SerialEntry[]>;

export type Lane = keyof typeof SERIAL;
/** sequence.groupOrder per serial lane; every value is > 0 and web-browser is the greatest. */
export const SERIAL_GROUP_ORDER = {
	core: 1,
	web: 1,
	scripts: 1,
	'web-browser': 2
} as const satisfies Record<Lane, number>;
export const files = (lane: Lane): string[] => SERIAL[lane].map((e) => e.file);

/** The `test` overrides every *-serial project shares. Spread AFTER the base config's `test`. */
export function serialTest(lane: Lane) {
	// VITEST_MAX_WORKERS is applied after fileParallelism:false and would run the serial files
	// concurrently (verified on Vitest 4.1.12). Every serial config calls this function, so each one
	// refuses to load, including `vitest run --config <lane>/vitest.serial.config.ts` run on its own;
	// the root vitest.config.ts keeps its own check for the projects run.
	if (process.env.VITEST_MAX_WORKERS !== undefined) {
		throw new Error(
			`VITEST_MAX_WORKERS is set: the ${lane}-serial lane is capped at one worker (fileParallelism:false) and VITEST_MAX_WORKERS would run its files concurrently; unset it (tooling/vitest/lanes.ts).`
		);
	}
	return {
		name: `${lane}-serial`,
		include: files(lane),
		exclude: [...configDefaults.exclude],
		fileParallelism: false,
		maxWorkers: 1,
		sequence: { groupOrder: SERIAL_GROUP_ORDER[lane] }
	};
}

// Known-good, measured. CI ubuntu-24.04 = 4 vCPU: Vitest's previous default (cpus-1) = 3 ran 359
// files green in 93.7-108.2 s (run 42289609809). Dev = 16 logical CPUs: `pnpm test:unit` median
// 124.3 s at 8 workers vs 135.1 s at 15 (2 runs each, 2026-11-09, two sibling executor agents loading
// the machine throughout; aggregate transform time doubled at 15); 8 leaves headroom for E2E and
// Chromium beside the unit run. The browser pool ignores the root value, so vitest.browser.config.ts
// files set it too, from this constant (Vitest throws on mismatched maxWorkers in one group).
export const MAX_WORKERS = process.env.CI ? 3 : 8;

/** E2E specs a deferred-items file names as load-sensitive (paths relative to apps/web/tests/e2e). */
export const LOAD_SENSITIVE_SPECS = [
	'app-notice.spec.ts',
	'settings-backup.spec.ts',
	'settings-keys.spec.ts',
	'investor/autofill.spec.ts',
	'investor/buybox.spec.ts',
	'agent-inquire.spec.ts',
	'csp.spec.ts',
	'renter-saved.spec.ts',
	'guide.spec.ts',
	'agent-contact.spec.ts',
	'agent-followup.spec.ts',
	'renter-journey.spec.ts'
] as const;
/** Vitest files a deferred-items file names as load-sensitive (repo-relative). All sit in the serial lane. */
export const LOAD_SENSITIVE_VITEST = [
	'apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts',
	'scripts/precommit.test.ts',
	'packages/core/src/fair-housing/mutation.test.ts',
	'packages/core/src/numbers/numbers.property.test.ts',
	'apps/web/src/lib/features/studio/boundaries.test.ts'
] as const;
