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

function count(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
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

	test('the only trigger is a push of an ext-v* tag', () => {
		expect(text).toContain("on:\n  push:\n    tags: ['ext-v*']\n\n");
		expect(text).not.toContain('pull_request');
		expect(text).not.toContain('branches:');
		expect(text).not.toContain('workflow_dispatch');
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
		'run: pnpm install --frozen-lockfile',
		'"ext-v$(node -p',
		'run: pnpm vitest run --project extension',
		'run: pnpm --filter extension zip',
		'run: node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output',
		'sha256sum sponsored-listing-filter-*.zip > SHA256SUMS.txt',
		'gh release create "$GITHUB_REF_NAME" --verify-tag'
	];

	test('install, version check, tests, zip, oracle, checksums, publish run in that order', () => {
		const job = releaseJob();
		const idx = ORDER.map((s) => job.indexOf(s));
		ORDER.forEach((s, i) => expect(idx[i], s).toBeGreaterThan(-1));
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
	});

	test('each gate step appears exactly once', () => {
		for (const s of ORDER) expect(count(text, s), s).toBe(1);
	});

	// LIVE-08: the published zip and its oracle run are built for the owner's site origin. The
	// variable sits in each step's own env block, never at job or workflow level.
	test('the zip and oracle steps each carry PUBLIC_SITE_URL in their own step', () => {
		const SITE = 'PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}';
		const job = releaseJob();
		const stepOf = (run: string): string => {
			const at = job.indexOf(run);
			expect(at, run).toBeGreaterThan(-1);
			const next = job.indexOf('\n      - ', at);
			return job.slice(job.lastIndexOf('\n      - ', at), next === -1 ? undefined : next);
		};
		for (const [name, run] of [
			['Zip the extension', ORDER[3]],
			['Manifest and zero-network oracle', ORDER[4]]
		]) {
			const step = stepOf(run);
			expect(step, run).toContain(`- name: ${name}\n`);
			expect(step, run).toContain(`\n        env:\n          ${SITE}`);
		}
		expect(count(text, SITE)).toBe(2);
		expect(count(text, 'vars.PUBLIC_SITE_URL')).toBe(2);
		expect(text).not.toMatch(/^(?:env:| {4}env:)/m);
	});

	test('the release uploads the zip and SHA256SUMS.txt from the WXT output folder', () => {
		expect(text).toContain('working-directory: apps/extension/.output');
		expect(text).toContain('apps/extension/.output/sponsored-listing-filter-*.zip');
		expect(text).toContain('apps/extension/.output/SHA256SUMS.txt');
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
