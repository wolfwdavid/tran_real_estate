// Phase 15 guard (TEST-01..TEST-04): no elapsed-time assertion or raised timeout outside the
// *-serial lane; every remaining raise is measured and explained; no retries; lanes, worker caps
// and the flaky gate are wired. Rules: scripts/lib/test-lane-rules.mjs (unit-tested in
// test-lane-rules.test.ts).
//
// Three layers: (1) the repo sweep runs every rule over every tracked and untracked-not-ignored
// file and expects nothing; (2) non-vacuity pins prove the rules still see the known timing and
// raise sites when lane membership is ignored, so a silent rule regression cannot turn (1) into a
// vacuous pass; (3) manifest, worker-cap and CI pins hold the lane mechanism itself together.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { beforeAll, describe, expect, test } from 'vitest';
import {
	MAX_WORKERS,
	SERIAL,
	SERIAL_GROUP_ORDER,
	files,
	serialTest,
	type Lane as LaneName
} from '../tooling/vitest/lanes';
import {
	elapsedTimeFindings,
	fileKind,
	laneOf,
	scanFile,
	vitestTimeoutFindings
} from './lib/test-lane-rules.mjs';

type Finding = { path: string; line: number; rule: string; detail: string };
type Lane = { project: string; serial: boolean; browser: boolean };
type Kind =
	| 'vitest-test'
	| 'playwright'
	| 'vitest-config'
	| 'playwright-config'
	| 'package-json'
	| 'workflow'
	| 'script-mjs';
type Entry = { path: string; kind: Kind; text: string };

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Vitest files that measure elapsed time (performance.now, process.hrtime, Date.now subtraction).
 * 15-RESEARCH Inventory A, re-derived on the current tree: the four core ReDoS/property budgets and
 * the web import-commit budget. The 15-08 serial files (lane-order, cpu-burn, flaky-gate) are not
 * here: they compare timestamps the fixture files write, so their own source has no such call.
 */
const EXPECTED_ELAPSED = [
	'apps/web/src/lib/storage/agent/import-commit.test.ts',
	'packages/core/src/fair-housing/mutation.test.ts',
	'packages/core/src/leads/parse-freeform.test.ts',
	'packages/core/src/numbers/number-words.test.ts',
	'packages/core/src/numbers/numbers.property.test.ts'
];

/**
 * Vitest files with a raised timeout (above the lane default, or non-literal). ResultsView stays
 * in the set through its `expect.poll(..., { timeout: LAZY_MAP_MS })`, a Prettier-wrapped chain the
 * rules only see since the 15-09 callee fix.
 */
const EXPECTED_RAISES = [
	'apps/web/src/lib/components/tools/calculators.browser.test.ts',
	'apps/web/src/lib/features/renter/outreach/OutreachSection.browser.test.ts',
	'apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts',
	'apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts',
	'apps/web/src/lib/features/studio/boundaries.test.ts',
	'apps/web/src/lib/seo/og-card.server.test.ts',
	'apps/web/src/lib/storage/agent/import-commit.test.ts'
];

/** Lane -> project root -> serial config -> parallel sibling (15-01; browser-serial is hyphenated). */
const LANES: Record<LaneName, { root: string; serialConfig: string; parallelSibling: string }> = {
	core: {
		root: 'packages/core/',
		serialConfig: 'packages/core/vitest.serial.config.ts',
		parallelSibling: 'packages/core/vitest.config.ts'
	},
	web: {
		root: 'apps/web/',
		serialConfig: 'apps/web/vitest.serial.config.ts',
		parallelSibling: 'apps/web/vite.config.ts'
	},
	'web-browser': {
		root: 'apps/web/',
		serialConfig: 'apps/web/vitest.browser-serial.config.ts',
		parallelSibling: 'apps/web/vitest.browser.config.ts'
	},
	scripts: {
		root: 'scripts/',
		serialConfig: 'scripts/vitest.serial.config.ts',
		parallelSibling: 'scripts/vitest.config.ts'
	}
};
const LANE_NAMES = Object.keys(LANES) as LaneName[];
const ROOT_CONFIG = 'vitest.config.ts';
const BROWSER_CONFIGS = [
	'apps/web/vitest.browser.config.ts',
	'apps/extension/vitest.browser.config.ts'
];
const WEB_PW = 'apps/web/playwright.config.ts';
const EXT_PW = 'apps/extension/playwright.config.ts';
const CI = '.github/workflows/ci.yml';

/** Every path git knows about or would add, repo-relative POSIX, still present on disk. */
let repoPaths: string[] = [];
/** The subset the rules apply to, with its text read once. */
let entries: Entry[] = [];

// Same widening as fileKind: .ts/.mts/.cts/.js/.mjs/.cjs configs, vitest.workspace files, and the
// lane manifest that supplies every serial project's `test` block.
const CONFIG_FILE =
	/(^|\/)(?:(?:vite|vitest|playwright)[\w.-]*\.config\.[cm]?[jt]s|vitest\.workspace(?:\.[\w-]+)*\.[cm]?[jt]s)$/;
const LANES_MANIFEST = 'tooling/vitest/lanes.ts';
const kindOf = (k: Kind) => entries.filter((e) => e.kind === k);
const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

beforeAll(() => {
	// -z: NUL-separated, so paths with spaces or quotes are never C-escaped.
	const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
		cwd: ROOT,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});
	expect(r.status, r.stderr).toBe(0);
	repoPaths = r.stdout
		.split('\0')
		.filter(Boolean)
		.map((p) => p.replace(/\\/g, '/'))
		// A path can be listed and already deleted in the working tree (unstaged rm).
		.filter((p) => existsSync(join(ROOT, p)));
	entries = repoPaths.flatMap((path) => {
		const kind = fileKind(path) as Kind | null;
		return kind === null ? [] : [{ path, kind, text: read(path) }];
	});
});

describe('repo sweep', () => {
	test('every rule reports nothing across all tracked and untracked-not-ignored files', () => {
		const findings: Finding[] = entries.flatMap((e) => scanFile(e.path, e.text, SERIAL));
		expect(findings.map((f) => `${f.path}:${f.line} ${f.rule} ${f.detail}`)).toEqual([]);
	});

	test('the sweep covers the Vitest tests, the Playwright tree, every config, package.json and ci.yml', () => {
		expect(kindOf('vitest-test').length).toBeGreaterThanOrEqual(300);
		expect(kindOf('playwright').length).toBeGreaterThanOrEqual(40);

		// WR-04: serialTest() in the lane manifest builds every serial project's `test` block, so the
		// sweep must scan it as a config.
		expect(fileKind(LANES_MANIFEST)).toBe('vitest-config');
		const configsInRepo = [
			...repoPaths.filter((p) => CONFIG_FILE.test(p)),
			...repoPaths.filter((p) => p === LANES_MANIFEST)
		];
		const configsScanned = [...kindOf('vitest-config'), ...kindOf('playwright-config')].map(
			(e) => e.path
		);
		expect(configsInRepo.length).toBeGreaterThanOrEqual(12);
		expect(sortedUnique(configsScanned)).toEqual(sortedUnique(configsInRepo));
		for (const must of [
			'vitest.config.ts',
			'packages/core/vitest.serial.config.ts',
			'apps/web/vitest.serial.config.ts',
			'apps/web/vitest.browser-serial.config.ts',
			'scripts/vitest.serial.config.ts',
			'apps/web/playwright.config.ts',
			'apps/extension/playwright.config.ts'
		]) {
			expect(configsScanned).toContain(must);
		}

		// Every package.json and workflow in the repo is scanned (CLI flags, workflow re-runs).
		const scannedPackages = kindOf('package-json').map((e) => e.path);
		expect(sortedUnique(scannedPackages)).toEqual(
			sortedUnique(repoPaths.filter((p) => /(^|\/)package\.json$/.test(p)))
		);
		const scannedWorkflows = kindOf('workflow').map((e) => e.path);
		expect(sortedUnique(scannedWorkflows)).toEqual(
			sortedUnique(repoPaths.filter((p) => /^\.github\/workflows\/.+\.ya?ml$/.test(p)))
		);
		expect(scannedWorkflows.length).toBeGreaterThanOrEqual(3);

		const packages = scannedPackages;
		expect(packages).toContain('package.json');
		expect(packages).toContain('apps/web/package.json');
		expect(packages).toContain('apps/extension/package.json');
		expect(kindOf('workflow').map((e) => e.path)).toContain('.github/workflows/ci.yml');
	});
});

describe('non-vacuity: the rules still see the known sites when lane membership is ignored', () => {
	test('A: the elapsed-time rule finds exactly the expected files', () => {
		const hit = kindOf('vitest-test')
			.filter((e) => elapsedTimeFindings(e.path, e.text).length > 0)
			.map((e) => e.path);
		expect(sortedUnique(hit)).toEqual(EXPECTED_ELAPSED);
	});

	test('B: with every file forced out of the serial lane, the raise rule finds exactly the expected files', () => {
		const hit = kindOf('vitest-test')
			.filter((e) => {
				const lane = laneOf(e.path, SERIAL) as Lane;
				return vitestTimeoutFindings(e.path, e.text, { ...lane, serial: false }).length > 0;
			})
			.map((e) => e.path);
		expect(sortedUnique(hit)).toEqual(EXPECTED_RAISES);
	});

	test('C: every expected elapsed-time and raise file is in the serial lane', () => {
		for (const p of [...EXPECTED_ELAPSED, ...EXPECTED_RAISES]) {
			const lane = laneOf(p, SERIAL) as Lane | null;
			expect(lane?.serial, p).toBe(true);
		}
		// And the manifest is not padded: every serial entry is a real timing/raise file or one of
		// the scripts files moved for duration, which the `reason` text explains.
		for (const [lane, list] of Object.entries(SERIAL)) {
			for (const entry of list) {
				expect(entry.reason.length, `${lane}: ${entry.file}`).toBeGreaterThan(10);
			}
		}
		expect(files('core').length + files('web').length + files('web-browser').length).toBe(
			sortedUnique([...EXPECTED_ELAPSED, ...EXPECTED_RAISES]).length
		);
	});
});

describe('lane manifest', () => {
	test('every SERIAL entry is a literal path to a file that exists, listed in exactly one lane', () => {
		const seen = new Map<string, LaneName>();
		for (const lane of LANE_NAMES) {
			for (const entry of SERIAL[lane]) {
				expect(entry.file, `${lane}: ${entry.file} must be a literal path`).not.toMatch(/[*?{[]/);
				const repoPath = LANES[lane].root + entry.file;
				expect(existsSync(join(ROOT, repoPath)), `${lane}: ${repoPath} does not exist`).toBe(true);
				expect(seen.get(repoPath), `${repoPath} is listed in two lanes`).toBeUndefined();
				seen.set(repoPath, lane);
			}
		}
		expect(seen.size).toBeGreaterThanOrEqual(17);
	});

	test('each lane has a file-based serial config and a parallel sibling that excludes it', () => {
		for (const lane of LANE_NAMES) {
			const { serialConfig, parallelSibling } = LANES[lane];
			expect(existsSync(join(ROOT, serialConfig)), serialConfig).toBe(true);
			expect(read(serialConfig), serialConfig).toContain(`serialTest('${lane}')`);
			expect(existsSync(join(ROOT, parallelSibling)), parallelSibling).toBe(true);
			expect(read(parallelSibling), parallelSibling).toContain(`files('${lane}')`);
		}
	});

	test('serialTest(lane) runs one file at a time in its own group, in the right order', () => {
		for (const lane of LANE_NAMES) {
			const t = serialTest(lane);
			expect(t.name).toBe(`${lane}-serial`);
			expect(t.include).toEqual(files(lane));
			expect(t.fileParallelism).toBe(false);
			expect(t.maxWorkers).toBe(1);
			expect(t.sequence.groupOrder).toBe(SERIAL_GROUP_ORDER[lane]);
			// > 0 keeps every serial lane out of the parallel group (Vitest's default order 0).
			expect(SERIAL_GROUP_ORDER[lane], lane).toBeGreaterThan(0);
		}
		// The browser pool runs beside the forks pool inside one group, so web-browser must be
		// strictly after every node lane (15-01 measured 8 cross-pool overlap pairs at a shared 1).
		for (const lane of LANE_NAMES.filter((l) => l !== 'web-browser')) {
			expect(SERIAL_GROUP_ORDER['web-browser'], lane).toBeGreaterThan(SERIAL_GROUP_ORDER[lane]);
		}
	});

	test('the root projects array is string literals only and lists the four serial configs', () => {
		const text = read(ROOT_CONFIG);
		const sf = ts.createSourceFile(ROOT_CONFIG, text, ts.ScriptTarget.Latest, true);
		let projects: ts.ArrayLiteralExpression | undefined;
		const visit = (n: ts.Node) => {
			if (
				ts.isPropertyAssignment(n) &&
				ts.isIdentifier(n.name) &&
				n.name.text === 'projects' &&
				ts.isArrayLiteralExpression(n.initializer)
			) {
				projects = n.initializer;
			}
			ts.forEachChild(n, visit);
		};
		visit(sf);
		expect(projects, 'test.projects array').toBeDefined();
		const elements = projects!.elements;
		// Inline project objects lose groupOrder under CLI --sequence.* flags (15-RESEARCH Pitfall 1).
		for (const el of elements) {
			expect(ts.isStringLiteral(el), `inline project entry: ${el.getText(sf)}`).toBe(true);
		}
		const listed = elements.map((el) => (el as ts.StringLiteral).text);
		for (const lane of LANE_NAMES) expect(listed).toContain(LANES[lane].serialConfig);
		expect(new Set(listed).size).toBe(listed.length);
	});
});

describe('worker caps', () => {
	test('MAX_WORKERS is a positive integer applied on the root config', () => {
		expect(Number.isInteger(MAX_WORKERS) && MAX_WORKERS > 0).toBe(true);
		const text = read(ROOT_CONFIG);
		expect(text).toContain('maxWorkers: MAX_WORKERS');
		// Fail closed: the env var is applied after fileParallelism:false and would break the lane.
		expect(text).toContain('process.env.VITEST_MAX_WORKERS');
	});

	test('both browser configs set the same cap (the browser pool ignores the root value)', () => {
		for (const cfg of BROWSER_CONFIGS) expect(read(cfg), cfg).toContain('maxWorkers: MAX_WORKERS');
	});

	test('Playwright workers are pinned to the known-good counts', () => {
		expect(read(WEB_PW)).toContain('workers: process.env.CI ? 2 : 4');
		expect(read(EXT_PW)).toMatch(/^\s*workers: 1,$/m);
	});
});

describe('CI and flaky gate', () => {
	test('ci.yml runs the unit suite through exactly one `run: pnpm test:unit`', () => {
		const lines = read(CI).split(/\r?\n/);
		expect(lines.filter((l) => /^\s*-?\s*run: pnpm test:unit\s*$/.test(l))).toHaveLength(1);
		expect(lines.filter((l) => l.includes('run: pnpm test:unit'))).toHaveLength(1);
	});

	test('package.json test:unit is exactly `vitest run`, so the lanes come from the config alone', () => {
		const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
		expect(pkg.scripts['test:unit']).toBe('vitest run');
	});

	test('exactly one ci.yml run line passes --fail-on-flaky-tests to playwright test', () => {
		const runLines = read(CI)
			.split(/\r?\n/)
			.filter((l) => /^\s*-?\s*run: /.test(l) && l.includes('--fail-on-flaky-tests'));
		expect(runLines).toHaveLength(1);
		expect(runLines[0]).toContain('playwright test');
	});

	test('both Playwright configs document the retry policy and fail flaky tests in CI', () => {
		for (const cfg of [WEB_PW, EXT_PW]) {
			const text = read(cfg);
			expect(text, cfg).toContain('failOnFlakyTests: !!process.env.CI');
			expect(text, cfg).toContain('Retry policy (TEST-03)');
		}
	});
});
