// Pins the gate strings in .github/workflows/extension-release.yml (plan 11-07, RESEARCH Pattern 7
// and Pitfall 12). Read as TEXT on purpose, like workflow-gate.test.ts: .github/ is Prettier-ignored
// so every `if:` stays on one line, and actionlint (pnpm lint:workflows) covers structure.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const WORKFLOWS = join(import.meta.dirname, '../.github/workflows');
const RELEASE = join(WORKFLOWS, 'extension-release.yml');
const CI = join(WORKFLOWS, 'ci.yml');
const ACTIONLINT = join(import.meta.dirname, 'actionlint.mjs');

const text = existsSync(RELEASE) ? readFileSync(RELEASE, 'utf8') : '';
const ci = readFileSync(CI, 'utf8');
const actionlint = readFileSync(ACTIONLINT, 'utf8');

const GATE = "vars.EXTENSION_RELEASES_ENABLED == 'true'";

const INSTALL = 'run: pnpm install --frozen-lockfile';
const ANCESTOR = 'node scripts/extension-release-checks.mjs ancestor';
const VITEST = 'run: pnpm vitest run --project extension';
const ZIP = 'run: pnpm --filter extension zip';
const ORACLE =
	'run: node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output';
const VERSION = 'node scripts/extension-release-checks.mjs version';
const PROBE = 'node scripts/extension-release-checks.mjs probe';
const CHECKSUMS = 'sha256sum sponsored-listing-filter-*.zip > SHA256SUMS.txt';
const SELF_CHECK = 'sha256sum -c SHA256SUMS.txt';
const NOTES =
	'node scripts/extension-release-checks.mjs notes --out "$RUNNER_TEMP/release-notes.md"';
const SUMMARY = 'node scripts/extension-release-checks.mjs summary >> "$GITHUB_STEP_SUMMARY"';
const DRAFT_PUBLISH = 'gh release create "$GITHUB_REF_NAME" --draft --verify-tag';
const PUSH_ONLY = "if: github.event_name == 'push'";

function count(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

// The `- ` step block of `src` that contains `run`.
function stepOf(src: string, run: string): string {
	const at = src.indexOf(run);
	expect(at, run).toBeGreaterThan(-1);
	const next = src.indexOf('\n      - ', at);
	return src.slice(src.lastIndexOf('\n      - ', at), next === -1 ? undefined : next);
}

// Everything a publish step must satisfy; an empty list means the step is safe.
function publishProblems(src: string): string[] {
	const step = stepOf(src, 'gh release create');
	const problems: string[] = [];
	if (!step.includes(`${PUSH_ONLY}\n        env:\n          GH_TOKEN`))
		problems.push('not push-only');
	if (!step.includes(DRAFT_PUBLISH)) problems.push('not a draft');
	return problems;
}

function checkoutProblems(src: string): string[] {
	const step = stepOf(src, 'uses: actions/checkout@');
	return step.includes('          fetch-depth: 0') ? [] : ['shallow checkout'];
}

// Everything after `jobs:\n  release:\n` is the release job body (it is the only job).
function releaseJob(): string {
	const marker = '\njobs:\n  release:\n';
	const start = text.indexOf(marker);
	expect(start, 'release job missing').toBeGreaterThan(-1);
	return text.slice(start + marker.length);
}

describe('trigger', () => {
	test('the workflow file exists', () => {
		expect(existsSync(RELEASE)).toBe(true);
	});

	test('the only triggers are a push of an ext-v* tag and an input-less manual dry run', () => {
		expect(text).toContain("on:\n  push:\n    tags: ['ext-v*']\n  workflow_dispatch:\n\n");
		expect(count(text, 'workflow_dispatch')).toBe(1);
		expect(text).not.toContain('pull_request');
		expect(text).not.toContain('branches:');
		expect(text).not.toContain('inputs:');
		expect(text).not.toContain('schedule:');
	});
});

describe('variable gate', () => {
	test('EXTENSION_RELEASES_ENABLED appears exactly once, on a single if: line of the release job', () => {
		expect(count(text, 'EXTENSION_RELEASES_ENABLED')).toBe(1);
		const lines = text.match(/^ +if: .*EXTENSION_RELEASES_ENABLED.*$/gm) ?? [];
		expect(lines).toEqual([`    if: ${GATE}`]);
		expect(releaseJob()).toContain(`if: ${GATE}\n`);
	});
});

describe('permissions', () => {
	test('workflow-level permissions are read-only', () => {
		expect(text).toContain('\npermissions:\n  contents: read\n');
	});

	test('the release job alone gets contents: write; no id-token, no pages', () => {
		expect(releaseJob()).toContain('    permissions:\n      contents: write\n');
		expect(count(text, 'contents: write')).toBe(1);
		expect(text).not.toContain('id-token');
		expect(text).not.toMatch(/pages: /);
	});

	test('the only token is github.token in GH_TOKEN; no secrets, no pushes', () => {
		expect(count(text, 'GH_TOKEN: ${{ github.token }}')).toBe(1);
		expect(count(text, 'github.token')).toBe(1);
		expect(text).not.toContain('secrets.');
		expect(text).not.toContain('git push');
		expect(text).not.toContain('gh repo create');
	});
});

describe('supply chain', () => {
	test('every uses: is a 40-hex SHA that ci.yml already pins (no new pins)', () => {
		const refs = [...text.matchAll(/uses: (\S+)@(\S+)/g)];
		expect(refs.length).toBe(3);
		for (const [, action, sha] of refs) {
			expect(sha).toMatch(/^[0-9a-f]{40}$/);
			expect(ci, `${action}@${sha} not pinned in ci.yml`).toContain(`uses: ${action}@${sha}`);
		}
	});

	test('no third-party release action', () => {
		expect(text).not.toMatch(/softprops|action-gh-release|ncipollo|release-action/i);
	});

	test('no cache anywhere and checkout never persists credentials', () => {
		expect(text).not.toContain('cache:');
		expect(text).not.toContain('actions/cache');
		expect(count(text, 'uses: actions/checkout@')).toBe(1);
		expect(count(text, 'persist-credentials: false')).toBe(1);
	});

	test('releases are serialized and never cancelled mid-publish', () => {
		expect(text).toContain(
			'concurrency:\n  group: extension-release\n  cancel-in-progress: false\n'
		);
	});
});

describe('steps', () => {
	const ORDER = [
		INSTALL,
		ANCESTOR,
		VITEST,
		ZIP,
		ORACLE,
		VERSION,
		PROBE,
		CHECKSUMS,
		SELF_CHECK,
		NOTES,
		SUMMARY,
		DRAFT_PUBLISH
	];

	test('install, ancestor, tests, zip, oracle, versions, probe, checksums, notes, summary, draft run in that order', () => {
		const job = releaseJob();
		const idx = ORDER.map((s) => job.indexOf(s));
		ORDER.forEach((s, i) => expect(idx[i], s).toBeGreaterThan(-1));
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
	});

	test('each gate step appears exactly once', () => {
		for (const s of ORDER) expect(count(text, s), s).toBe(1);
	});

	// LIVE-08 / D-04: the published zip and its oracle run are built for the owner's site URL
	// (origin + base path). Both variables sit in each step's own env block, never at job or
	// workflow level.
	test('the zip, oracle and probe steps each carry PUBLIC_SITE_URL and BASE_PATH in their own step', () => {
		const SITE = 'PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}';
		const BASE = 'BASE_PATH: ${{ vars.BASE_PATH }}';
		for (const [name, run] of [
			['Zip the extension', ZIP],
			['Manifest and zero-network oracle', ORACLE],
			['Live privacy URL', PROBE]
		]) {
			const step = stepOf(text, run);
			expect(step, run).toContain(`- name: ${name}\n`);
			expect(step, run).toContain(`\n        env:\n          ${SITE}\n          ${BASE}`);
		}
		expect(count(text, SITE)).toBe(3);
		expect(count(text, 'vars.PUBLIC_SITE_URL')).toBe(3);
		expect(count(text, BASE)).toBe(3);
		expect(count(text, 'vars.BASE_PATH')).toBe(3);
		expect(text).not.toMatch(/^(?:env:| {4}env:)/m);
	});

	test('the release uploads the zip and SHA256SUMS.txt from the WXT output folder', () => {
		expect(text).toContain('working-directory: apps/extension/.output');
		expect(text).toContain('apps/extension/.output/sponsored-listing-filter-*.zip');
		expect(text).toContain('apps/extension/.output/SHA256SUMS.txt');
	});
});

describe('dry-run and draft (EXT-08)', () => {
	test('the checkout is full-depth so the ancestor check can resolve origin/main', () => {
		expect(count(text, 'fetch-depth: 0')).toBe(1);
		expect(checkoutProblems(text)).toEqual([]);
	});

	test('only the ancestor step and the draft publish step are push-only', () => {
		expect(count(text, PUSH_ONLY)).toBe(2);
		expect(stepOf(text, ANCESTOR)).toContain(PUSH_ONLY);
		expect(stepOf(text, DRAFT_PUBLISH)).toContain(PUSH_ONLY);
	});

	test('the release is a draft, created once, and never published or edited by the workflow', () => {
		expect(publishProblems(text)).toEqual([]);
		expect(count(text, 'gh release')).toBe(1);
		expect(text.indexOf('--draft')).toBeLessThan(text.indexOf('--verify-tag'));
		expect(text).not.toContain('--draft=false');
		expect(text).not.toContain('gh release edit');
		expect(text).not.toContain('gh release upload');
		expect(text).not.toContain('inputs.');
	});

	test('notes come from the changelog file, not the install guide', () => {
		expect(text).toContain('--notes-file "$RUNNER_TEMP/release-notes.md"');
		expect(text).not.toContain('docs/EXTENSION-INSTALL.md');
	});

	test('the version step reads the tag only on a push', () => {
		expect(stepOf(text, VERSION)).toContain(
			"env:\n          RELEASE_TAG: ${{ github.event_name == 'push' && github.ref_name || '' }}"
		);
	});

	test('no ${{ }} inside any run: line, no artifact upload action', () => {
		const runs = text.split('\n').filter((l) => /^\s*(- )?run:/.test(l));
		expect(runs.length).toBeGreaterThan(5);
		for (const l of runs) expect(l, l).not.toContain('${{');
		expect(text).not.toContain('actions/upload-artifact');
		expect(count(text, 'uses: ')).toBe(3);
	});

	// Non-vacuity: each predicate must actually fail on a planted mutant.
	test('planted mutants are caught', () => {
		expect(publishProblems(text.replace(' --draft', ''))).toContain('not a draft');
		expect(
			publishProblems(
				text.replace(`${PUSH_ONLY}\n        env:\n          GH_TOKEN`, 'env:\n          GH_TOKEN')
			)
		).toContain('not push-only');
		expect(checkoutProblems(text.replace('fetch-depth: 0\n', ''))).toContain('shallow checkout');
	});
});

describe('actionlint coverage', () => {
	test('with no args, actionlint.mjs lints every workflow under .github/workflows', () => {
		expect(actionlint).toContain('readdirSync');
		expect(actionlint).toContain('.github/workflows');
		expect(actionlint).toMatch(/\\.ya\?ml\$/);
		expect(actionlint).not.toContain(": ['.github/workflows/ci.yml']");
	});

	test('an empty workflow list fails closed', () => {
		expect(actionlint).toContain(
			'No workflow files found under .github/workflows; workflow lint blocked.'
		);
	});
});
