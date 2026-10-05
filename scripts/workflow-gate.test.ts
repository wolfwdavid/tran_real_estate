// Pins the literal gate strings in .github/workflows/ci.yml that a careless edit would silently
// drop. The file is read as text on purpose: .github/ is Prettier-ignored so every `if:` stays on
// one line, and actionlint (pnpm lint:workflows) already covers structural validity.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const WORKFLOW = join(import.meta.dirname, '../.github/workflows/ci.yml');
const PLAYWRIGHT_CONFIG = join(import.meta.dirname, '../apps/web/playwright.config.ts');

const text = readFileSync(WORKFLOW, 'utf8');
const playwright = readFileSync(PLAYWRIGHT_CONFIG, 'utf8');

const GATE =
	"github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'";
const GITLEAKS_DOWNLOAD = 'gitleaks_${GITLEAKS_VERSION}_linux_x64';
const GITLEAKS_SHA256 = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb';

function count(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

// Splits the `jobs:` section into { jobId -> body } so assertions can target one job.
function jobs(): Map<string, string> {
	const start = text.indexOf('\njobs:\n');
	expect(start).toBeGreaterThan(-1);
	const section = text.slice(start + '\njobs:\n'.length);
	const out = new Map<string, string>();
	for (const m of section.matchAll(/^ {2}([a-z_]+):\n([\s\S]*?)(?=^ {2}[a-z_]+:\n|(?![\s\S]))/gm)) {
		out.set(m[1], m[2]);
	}
	return out;
}

function job(name: string): string {
	const body = jobs().get(name);
	expect(body, `job "${name}" missing from ci.yml`).toBeDefined();
	return body as string;
}

describe('deploy gate', () => {
	test("deploy job's if: requires a main push AND vars.PAGES_ENABLED == 'true'", () => {
		expect(job('deploy')).toContain(`if: ${GATE}`);
	});

	test('the artifact upload step carries the same gate plus the root target', () => {
		expect(job('quality')).toContain(`if: matrix.target == 'root' && ${GATE}`);
	});

	test('the PAGES_ENABLED gate appears exactly twice, each on a single if: line', () => {
		expect(count(text, "vars.PAGES_ENABLED == 'true'")).toBe(2);
		const singleLine = text.match(/^ +if: .*vars\.PAGES_ENABLED == 'true'$/gm) ?? [];
		expect(singleLine).toHaveLength(2);
	});

	test('deploy needs both hygiene and quality', () => {
		expect(job('deploy')).toContain('needs: [hygiene, quality]');
	});

	test('deploy uses the pages concurrency group without cancel-in-progress', () => {
		expect(job('deploy')).toContain(
			'concurrency:\n      group: pages\n      cancel-in-progress: false'
		);
	});

	test('deploy is the only job with pages/id-token write and runs deploy-pages', () => {
		const deploy = job('deploy');
		expect(deploy).toContain('pages: write');
		expect(deploy).toContain('id-token: write');
		expect(deploy).toContain('uses: actions/deploy-pages@');
		expect(job('hygiene')).not.toContain('id-token: write');
		expect(job('quality')).not.toContain('id-token: write');
	});
});

describe('artifact', () => {
	test('upload-pages-artifact includes hidden files so .nojekyll ships', () => {
		const quality = job('quality');
		const upload = quality.indexOf('uses: actions/upload-pages-artifact@');
		expect(upload).toBeGreaterThan(-1);
		expect(quality.slice(upload)).toContain('include-hidden-files: true');
		expect(quality.slice(upload)).toContain('path: apps/web/build');
	});
});

describe('supply chain', () => {
	test('every uses: is pinned to a 40-character commit SHA, at least 7 of them', () => {
		const refs = [...text.matchAll(/uses: \S+@(\S+)/g)].map((m) => m[1]);
		expect(refs.length).toBeGreaterThanOrEqual(7);
		for (const ref of refs) expect(ref).toMatch(/^[0-9a-f]{40}$/);
	});

	test('gitleaks-action is never used (license-encumbered for org repos)', () => {
		expect(text).not.toContain('gitleaks-action');
	});

	test('gitleaks version and tarball SHA-256 are pinned in env', () => {
		expect(text).toContain('GITLEAKS_VERSION: 8.30.1');
		expect(text).toContain(`GITLEAKS_SHA256: ${GITLEAKS_SHA256}`);
	});

	test('the checksum-verified gitleaks install exists in BOTH hygiene and quality', () => {
		expect(count(text, GITLEAKS_DOWNLOAD)).toBeGreaterThanOrEqual(2);
		expect(count(text, 'sha256sum -c -')).toBeGreaterThanOrEqual(2);
		expect(job('hygiene')).toContain(GITLEAKS_DOWNLOAD);
		expect(job('quality')).toContain(GITLEAKS_DOWNLOAD);
	});

	test('quality installs gitleaks BEFORE pnpm test:unit (precommit suite is fail-closed)', () => {
		const quality = job('quality');
		const install = quality.indexOf(GITLEAKS_DOWNLOAD);
		const unit = quality.indexOf('run: pnpm test:unit');
		expect(install).toBeGreaterThan(-1);
		expect(unit).toBeGreaterThan(-1);
		expect(install).toBeLessThan(unit);
	});

	test('checkouts never persist the token in the working tree', () => {
		expect(count(text, 'uses: actions/checkout@')).toBe(2);
		expect(count(text, 'persist-credentials: false')).toBe(2);
	});
});

describe('quality matrix', () => {
	test('matrix includes both root and sub targets', () => {
		const quality = job('quality');
		expect(quality).toContain('- target: root');
		expect(quality).toContain('- target: sub');
		expect(quality).toContain('base_path: /tran_real_estate');
		expect(quality).toContain('build_dir: build-sub');
	});

	test('BASE_PATH and BUILD_DIR come from the matrix and E2E runs the matching project', () => {
		const quality = job('quality');
		expect(quality).toContain('BASE_PATH: ${{ matrix.base_path }}');
		expect(quality).toContain('BUILD_DIR: ${{ matrix.build_dir }}');
		expect(quality).toContain('node scripts/assert-csp.mjs apps/web/${{ matrix.build_dir }}');
		expect(quality).toContain('playwright test --project=${{ matrix.target }}');
	});

	test('quality runs check, lint and unit before the build', () => {
		const quality = job('quality');
		const order = [
			'run: pnpm check',
			'run: pnpm lint',
			'run: pnpm test:unit',
			'run: pnpm --filter web build'
		];
		const idx = order.map((s) => quality.indexOf(s));
		for (const i of idx) expect(i).toBeGreaterThan(-1);
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
	});

	test('quality runs the fixture drift check after pnpm install (it needs Prettier)', () => {
		const quality = job('quality');
		const install = quality.indexOf('run: pnpm install --frozen-lockfile');
		const fixtures = quality.indexOf('run: node scripts/gen-fixtures.mjs --check');
		expect(install).toBeGreaterThan(-1);
		expect(fixtures).toBeGreaterThan(install);
	});

	test('Playwright readiness probe targets the always-on attacker listener', () => {
		// Each quality leg builds ONE target; the root listener never starts on the sub leg, so a
		// root-URL probe would time out. The attacker listener always answers 200 (plan 01-05).
		expect(playwright).toContain('url: `http://127.0.0.1:${ATTACKER}/`');
		expect(count(playwright, 'webServer:')).toBe(1);
	});
});

describe('hygiene job', () => {
	test('runs the canary self-test, the full-history scan and the real-data guard', () => {
		const hygiene = job('hygiene');
		expect(hygiene).toContain('run: node scripts/gitleaks-canary.mjs');
		expect(hygiene).toContain('run: gitleaks git --no-banner --redact --config .gitleaks.toml .');
		expect(hygiene).toContain('run: node scripts/guard-real-data.mjs --all');
		expect(hygiene).toContain('fetch-depth: 0');
	});

	test('runs the banned marketing/legal terms gate', () => {
		expect(job('hygiene')).toContain('run: node scripts/banned-terms.mjs');
	});
});

describe('no remote side effects', () => {
	test('the workflow never pushes, creates a repo, or hard-codes a repository URL', () => {
		expect(text).not.toContain('git push');
		expect(text).not.toContain('gh repo create');
		expect(text).not.toContain('git@github.com:');
		expect(text).not.toMatch(/tranrealestate\.github\.io|wolfwdavid/i);
		// The only github.com URL allowed is the pinned gitleaks release download.
		const urls = [...text.matchAll(/https:\/\/github\.com\/\S+/g)].map((m) => m[0]);
		for (const url of urls) expect(url).toContain('/gitleaks/gitleaks/releases/download/');
	});

	test('workflow-level permissions are read-only', () => {
		expect(text).toContain('\npermissions:\n  contents: read\n');
	});
});
