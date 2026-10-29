// Pins the literal gate strings in .github/workflows/ci.yml that a careless edit would silently
// drop. The file is read as text on purpose: .github/ is Prettier-ignored so every `if:` stays on
// one line, and actionlint (pnpm lint:workflows) already covers structural validity.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { OWNER_KEYS, targetEnv } from './lib/build-targets.mjs';

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
	test('matrix lists the root, sub and configured targets with their build dirs', () => {
		const quality = job('quality');
		expect(quality).toContain('- target: root\n            build_dir: build\n');
		expect(quality).toContain('- target: sub\n            build_dir: build-sub\n');
		expect(quality).toContain('- target: configured\n            build_dir: build-configured\n');
		// build-targets.mjs owns BASE_PATH; the matrix must not carry a second copy.
		expect(quality).not.toContain('base_path');
	});

	test('the Build step runs the build-targets script for the matrix target', () => {
		const quality = job('quality');
		expect(quality).toContain('run: pnpm run build:${{ matrix.target }}');
		expect(quality).not.toContain('BASE_PATH:');
		expect(quality).not.toContain('BUILD_DIR:');
	});

	test('build-targets.mjs maps each target to its BASE_PATH and BUILD_DIR', () => {
		const pick = (name: string) => {
			const t = targetEnv(name, {});
			return [t.BASE_PATH, t.BUILD_DIR];
		};
		expect(pick('root')).toEqual(['', 'build']);
		expect(pick('sub')).toEqual(['/tran_real_estate', 'build-sub']);
		expect(pick('configured')).toEqual(['', 'build-configured']);
	});

	test('owner variables reach only the root leg, in every env block', () => {
		const quality = job('quality');
		const blocks = count(quality, '\n        env:\n');
		expect(blocks).toBe(4); // Build, CSP oracle, SEO oracle, E2E
		for (const name of OWNER_KEYS) {
			const gated = `${name}: \${{ matrix.target == 'root' && vars.${name} || '' }}`;
			expect(count(quality, gated), name).toBe(blocks);
			// No other use of the variable anywhere in the workflow.
			expect(count(text, `vars.${name}`), name).toBe(blocks);
		}
		expect(count(quality, 'PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}')).toBe(blocks);
	});

	test('the CSP oracle and E2E run for the matching target', () => {
		const quality = job('quality');
		expect(quality).toContain(
			'run: node scripts/assert-csp.mjs apps/web/${{ matrix.build_dir }} --target ${{ matrix.target }}'
		);
		expect(quality).toContain('playwright test --project=${{ matrix.target }}');
	});

	test('the SEO oracle runs on every leg for the matching target, after the build', () => {
		const quality = job('quality');
		const seo =
			'run: node scripts/assert-seo.mjs apps/web/${{ matrix.build_dir }} --target ${{ matrix.target }}';
		expect(count(quality, seo)).toBe(1);
		// No `if:` on the SEO step: it must run on root, sub and configured alike.
		const step = quality.slice(quality.lastIndexOf('- name:', quality.indexOf(seo)));
		expect(step.slice(0, step.indexOf(seo))).not.toContain('if:');
		expect(quality.indexOf(seo)).toBeGreaterThan(
			quality.indexOf('run: pnpm run build:${{ matrix.target }}')
		);
		expect(quality.indexOf(seo)).toBeLessThan(quality.indexOf('name: E2E + axe'));
	});

	test('the JS budget gates the deploy build (root leg) and the analytics-on build (configured leg)', () => {
		const quality = job('quality');
		expect(quality).toContain(
			"if: matrix.target == 'root'\n        run: node scripts/assert-budget.mjs apps/web/build --require-tools\n"
		);
		expect(quality).toContain(
			"if: matrix.target == 'configured'\n        run: node scripts/assert-budget.mjs apps/web/build-configured --require-tools\n"
		);
		expect(count(quality, 'scripts/assert-budget.mjs')).toBe(2);
		// Never on the sub leg and never via matrix.build_dir (that would include build-sub).
		expect(quality).not.toMatch(/assert-budget\.mjs apps\/web\/\$\{\{ matrix\.build_dir \}\}/);
	});

	test('the full dependency audit runs once, on the root leg, right after pnpm install', () => {
		const quality = job('quality');
		const step = "- if: matrix.target == 'root'\n        run: pnpm audit:deps\n";
		expect(count(quality, 'pnpm audit:deps')).toBe(1);
		expect(quality).toContain(step);
		expect(quality.indexOf(step)).toBeGreaterThan(
			quality.indexOf('run: pnpm install --frozen-lockfile')
		);
		expect(quality.indexOf(step)).toBeLessThan(quality.indexOf('run: pnpm check'));
		// pnpm audit:deps must stay the full audit (prod + dev, low and up).
		const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
		expect(pkg.scripts['audit:deps']).toBe('pnpm audit --audit-level low');
	});

	test('the new gates add no third-party action: exactly 7 uses: lines', () => {
		expect(count(text, 'uses: ')).toBe(7);
	});

	test('quality runs check, lint and unit before the build', () => {
		const quality = job('quality');
		const order = [
			'run: pnpm check',
			'run: pnpm lint',
			'run: pnpm test:unit',
			'run: pnpm run build:${{ matrix.target }}'
		];
		const idx = order.map((s) => quality.indexOf(s));
		for (const i of idx) expect(i).toBeGreaterThan(-1);
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
	});

	test('quality installs Chromium BEFORE pnpm test:unit (browser component tests)', () => {
		// pnpm test:unit includes the web-browser Vitest project, which launches real Chromium.
		const quality = job('quality');
		const deps = quality.indexOf('run: pnpm install --frozen-lockfile');
		const chromium = quality.indexOf('playwright install --with-deps chromium');
		const unit = quality.indexOf('run: pnpm test:unit');
		expect(deps).toBeGreaterThan(-1);
		expect(chromium).toBeGreaterThan(deps);
		expect(unit).toBeGreaterThan(chromium);
		expect(count(quality, 'playwright install --with-deps chromium')).toBe(1);
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

describe('extension (Phase 11)', () => {
	const BUILD = 'run: pnpm ext:build && pnpm ext:assert';
	const BROWSER = 'run: pnpm ext:test:browser && pnpm ext:e2e';

	// The `if:` line directly above a run line, within the same step.
	const ifAbove = (quality: string, run: string): string => {
		const at = quality.indexOf(run);
		const step = quality.slice(quality.lastIndexOf('- name:', at), at);
		return step.match(/^ +if: (.*)$/m)?.[1] ?? '';
	};

	test('the root leg builds the extension and runs the manifest/zero-network oracle', () => {
		const quality = job('quality');
		expect(count(quality, BUILD)).toBe(1);
		expect(ifAbove(quality, BUILD)).toBe("matrix.target == 'root'");
	});

	test('the root leg runs the popup axe suite and the runtime E2E', () => {
		const quality = job('quality');
		expect(count(quality, BROWSER)).toBe(1);
		expect(ifAbove(quality, BROWSER)).toBe("matrix.target == 'root'");
	});

	test('extension steps run after Chromium install and web E2E, before the Pages upload', () => {
		const quality = job('quality');
		const chromium = quality.indexOf('playwright install --with-deps chromium');
		const webE2e = quality.indexOf('name: E2E + axe');
		const build = quality.indexOf(BUILD);
		const browser = quality.indexOf(BROWSER);
		const upload = quality.indexOf('uses: actions/upload-pages-artifact@');
		expect(chromium).toBeGreaterThan(-1);
		expect(build).toBeGreaterThan(chromium);
		expect(build).toBeGreaterThan(webE2e);
		expect(browser).toBeGreaterThan(build);
		expect(upload).toBeGreaterThan(browser);
	});

	test('root package.json wires the ext:* scripts into the end of verify', () => {
		const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
		expect(pkg.scripts['ext:build']).toBe('pnpm --filter extension zip');
		expect(pkg.scripts['ext:assert']).toBe(
			'node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output'
		);
		expect(pkg.scripts['ext:test:browser']).toBe('pnpm --filter extension test:browser');
		expect(pkg.scripts['ext:e2e']).toBe('pnpm --filter extension e2e');
		expect(pkg.scripts.verify).toMatch(
			/ && pnpm ext:build && pnpm ext:assert && pnpm ext:test:browser && pnpm ext:e2e$/
		);
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

	test('runs the commit-message hygiene check over the full history', () => {
		const hygiene = job('hygiene');
		const step = 'run: node scripts/commit-hygiene.mjs --history';
		expect(hygiene).toContain(step);
		expect(hygiene).toContain('fetch-depth: 0');
		const at = hygiene.indexOf(step);
		expect(at).toBeGreaterThan(hygiene.indexOf('uses: actions/checkout@'));
		expect(at).toBeLessThan(
			hygiene.indexOf('run: gitleaks git --no-banner --redact --config .gitleaks.toml .')
		);
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
