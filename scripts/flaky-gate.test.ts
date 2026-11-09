// Behavioural proof of the flaky gate (TEST-03) on the installed Playwright: a throwaway spec under
// apps/web/.tools passes only on its retry (test.info().retry === 1). Without the gate that run is
// green and merely reports "1 flaky"; with --fail-on-flaky-tests, or with the Playwright configs'
// CI-only failOnFlakyTests under CI=1, the same run exits non-zero. No browser is launched
// (the spec uses no page fixture). Lives in scripts-serial: it spawns Playwright once per case.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const REPO = join(import.meta.dirname, '..');
// @playwright/test is not hoisted to the root node_modules; the fixture dir sits under apps/web so
// its own `import ... from '@playwright/test'` resolves the same copy.
const PLAYWRIGHT = join(REPO, 'apps/web/node_modules/@playwright/test/cli.js');

let dir: string;

const SPEC = [
	"import { expect, test } from '@playwright/test';",
	"test('passes only on its retry', () => {",
	'\texpect(test.info().retry).toBe(1);',
	'});',
	''
].join('\n');

const config = (outputDir: string, extra = '') =>
	[
		"import { defineConfig } from '@playwright/test';",
		'export default defineConfig({',
		"\ttestDir: '.',",
		"\ttestMatch: 'flip.spec.ts',",
		'\tretries: 1,',
		'\tworkers: 1,',
		"\treporter: 'list',",
		...(extra ? [`\t${extra}`] : []),
		`\toutputDir: '${outputDir}'`,
		'});',
		''
	].join('\n');

/** process.env without VITEST* (the parent run's keys) and without CI; cases add CI back as needed. */
const baseEnv = (): NodeJS.ProcessEnv =>
	Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^VITEST/.test(k) && k !== 'CI'));

function pw(configFile: string, extra: string[] = [], env: NodeJS.ProcessEnv = baseEnv()) {
	const r = spawnSync(
		process.execPath,
		[PLAYWRIGHT, 'test', '--config', join(dir, configFile), ...extra],
		{ cwd: dir, encoding: 'utf8', env, timeout: 50_000 }
	);
	if (r.error) throw r.error;
	return { status: r.status, out: r.stdout + r.stderr };
}

beforeAll(() => {
	dir = join(
		REPO,
		'apps/web/.tools',
		`flaky-gate-${process.pid}-${Math.random().toString(36).slice(2)}`
	);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'flip.spec.ts'), SPEC);
	writeFileSync(join(dir, 'plain.config.ts'), config('./out-plain'));
	writeFileSync(
		join(dir, 'ci.config.ts'),
		config('./out-ci', 'failOnFlakyTests: !!process.env.CI,')
	);
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('a test that passes only on its retry', () => {
	test('is reported flaky and still passes the run without the gate (non-vacuity)', () => {
		const r = pw('plain.config.ts');
		expect(r.out, r.out).toMatch(/1 flaky/);
		expect(r.status, r.out).toBe(0);
	});

	test('fails the run with --fail-on-flaky-tests (the ci.yml E2E line)', () => {
		const r = pw('plain.config.ts', ['--fail-on-flaky-tests']);
		expect(r.out, r.out).toMatch(/1 flaky/);
		expect(r.status, r.out).not.toBe(0);
	});

	test("fails the run with the configs' CI-only failOnFlakyTests under CI=1", () => {
		const r = pw('ci.config.ts', [], { ...baseEnv(), CI: '1' });
		expect(r.out, r.out).toMatch(/1 flaky/);
		expect(r.status, r.out).not.toBe(0);
	});

	test('passes with the same config when CI is unset (retries only classify locally)', () => {
		const r = pw('ci.config.ts');
		expect(r.out, r.out).toMatch(/1 flaky/);
		expect(r.status, r.out).toBe(0);
	});
});
