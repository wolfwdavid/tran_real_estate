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
import { beforeAll, describe, expect, test } from 'vitest';
import { SERIAL, files } from '../tooling/vitest/lanes';
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

/** Every path git knows about or would add, repo-relative POSIX, still present on disk. */
let repoPaths: string[] = [];
/** The subset the rules apply to, with its text read once. */
let entries: Entry[] = [];

const CONFIG_FILE = /(^|\/)(?:vite|vitest|playwright)[\w.-]*\.config\.ts$/;
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

		const configsInRepo = repoPaths.filter((p) => CONFIG_FILE.test(p));
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

		const packages = kindOf('package-json').map((e) => e.path);
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
