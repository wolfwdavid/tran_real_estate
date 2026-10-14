// Integration test of the pre-commit gate: the same command string package.json installs via
// simple-git-hooks is wired into a throwaway repository under os.tmpdir(), then git commit is
// driven for real. Every canary and real-looking value is assembled at runtime so this file never
// matches the rules it exercises. Nothing here commits to, or writes into, this repository.
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..');
const repoRootPosix = repoRoot.replace(/\\/g, '/');

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
	'simple-git-hooks': { 'pre-commit': string };
};
const HOOK_COMMAND = pkg['simple-git-hooks']['pre-commit'];

// The temp repo runs the identical command with the script paths made absolute, so the hook under
// test can never drift from the one package.json installs.
const tempHookCommand = HOOK_COMMAND.replace(
	/node scripts\//g,
	`node "${repoRootPosix}/scripts/`
).replace(/\.mjs/g, '.mjs"');

const canary = () => 'TRAN' + 'CANARY_' + 'A1B2C3D4E5F6G7H8J9K0L1M2N3P4Q5R6';
const realEmail = () => ['agent', '@', 'brokerage', '.com'].join('');
const realPhone = () => ['512', '-', '867', '-', '5309'].join('');

type Run = { status: number; stdout: string; stderr: string };
const git = (cwd: string, ...args: string[]): Run => {
	const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
	if (r.error) throw r.error;
	return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
};

const commitCount = (cwd: string): number => {
	const r = git(cwd, 'rev-list', '--count', 'HEAD');
	return r.status === 0 ? Number(r.stdout.trim()) : 0;
};

const stage = (cwd: string, relPath: string, content: string) => {
	const abs = join(cwd, relPath);
	mkdirSync(dirname(abs), { recursive: true });
	writeFileSync(abs, content);
	const r = git(cwd, 'add', '--', relPath);
	expect(r.status, r.stderr).toBe(0);
};

const commit = (cwd: string, message: string): Run => git(cwd, 'commit', '-q', '-m', message);

function makeRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), 'tran-precommit-'));
	expect(git(dir, 'init', '-q', '-b', 'main').status).toBe(0);
	for (const [k, v] of [
		['user.email', 'tester@example.com'], // TEST_AUTHOR
		['user.name', 'Test'],
		['commit.gpgsign', 'false'],
		['core.hooksPath', '.git/hooks']
	]) {
		expect(git(dir, 'config', k, v).status).toBe(0);
	}
	copyFileSync(join(repoRoot, '.gitleaks.toml'), join(dir, '.gitleaks.toml'));
	const hook = join(dir, '.git', 'hooks', 'pre-commit');
	mkdirSync(dirname(hook), { recursive: true });
	writeFileSync(hook, `#!/bin/sh\n${tempHookCommand}\n`);
	try {
		chmodSync(hook, 0o755);
	} catch {
		// Windows has no exec bit; git runs hook files through sh regardless.
	}
	// Baseline commit goes through the hook too, so a broken gate surfaces here, not later.
	stage(dir, '.gitleaks.toml', readFileSync(join(dir, '.gitleaks.toml'), 'utf8'));
	const first = commit(dir, 'baseline');
	expect(first.status, first.stdout + first.stderr).toBe(0);
	expect(commitCount(dir)).toBe(1);
	return dir;
}

describe('pre-commit gate prerequisites', () => {
	test('gitleaks is on PATH (the gate is fail-closed, so this suite must not skip)', () => {
		const probe = spawnSync(process.env.GITLEAKS_BIN || 'gitleaks', ['version'], {
			encoding: 'utf8'
		});
		expect(probe.error).toBeUndefined();
		expect(probe.status).toBe(0);
		expect(probe.stdout).toMatch(/\d+\.\d+\.\d+/);
	});

	test('package.json installs both the secret scan and the real-data guard on pre-commit', () => {
		expect(HOOK_COMMAND).toContain('scripts/gitleaks.mjs staged');
		expect(HOOK_COMMAND).toContain('scripts/guard-real-data.mjs --staged');
		expect(HOOK_COMMAND.split('&&')).toHaveLength(2);
	});

	test('the temp-repo hook is the package.json command with absolute script paths', () => {
		const normalised = tempHookCommand
			.replaceAll(`"${repoRootPosix}/scripts/`, 'scripts/')
			.replaceAll('.mjs"', '.mjs');
		expect(normalised).toBe(HOOK_COMMAND);
		expect(tempHookCommand).toContain(`${repoRootPosix}/scripts/gitleaks.mjs`);
		expect(tempHookCommand).toContain(`${repoRootPosix}/scripts/guard-real-data.mjs`);
	});

	test('this repository has the simple-git-hooks pre-commit hook installed with the same command', () => {
		const hookPath = join(repoRoot, '.git', 'hooks', 'pre-commit');
		expect(existsSync(hookPath)).toBe(true);
		const hook = readFileSync(hookPath, 'utf8');
		// simple-git-hooks emits its uppercase env-var guards into the hook, never its package name.
		expect(hook).toMatch(/SIMPLE_GIT_HOOKS_RC/);
		expect(hook).toContain(HOOK_COMMAND);
	});
});

// The test identity makeRepo() configures; no commit by it may ever reach this repository.
const TEST_AUTHOR = 'tester@example.com';

describe('pre-commit gate in an isolated repository', () => {
	// One template repository (its baseline commit goes through the real hook once), copied fresh
	// for every test. Building a repo per test ran the hook twice per test; under a fully loaded
	// parallel `vitest run` one test took 56 s against the 60 s limit (10-23).
	let template = '';
	let dir = '';

	beforeAll(() => {
		template = makeRepo();
	});

	afterAll(() => {
		if (template) rmSync(template, { recursive: true, force: true });
	});

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'tran-precommit-'));
		cpSync(template, dir, { recursive: true });
		expect(commitCount(dir)).toBe(1);
	});

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
		dir = '';
		// The suite never commits to this repository. Checked by author, not by comparing HEAD:
		// other processes may legitimately commit here while the suite runs.
		const leaked = git(repoRoot, 'log', '-n', '1', '--format=%H', `--author=${TEST_AUTHOR}`);
		expect(leaked.status, leaked.stderr).toBe(0);
		expect(leaked.stdout.trim()).toBe('');
	});

	test('a staged canary secret blocks the commit', () => {
		stage(dir, 'src/config.ts', `export const key = '${canary()}';\n`);
		const r = commit(dir, 'add key');
		expect(r.status).not.toBe(0);
		expect(r.stdout + r.stderr).toMatch(/leaks found/i);
		expect(commitCount(dir)).toBe(1);
	});

	test('a staged fixture with a real-looking email blocks the commit', () => {
		stage(dir, 'fixtures/leads.json', JSON.stringify({ email: realEmail() }, null, 2) + '\n');
		const r = commit(dir, 'add leads');
		expect(r.status).not.toBe(0);
		expect(r.stdout + r.stderr).toMatch(/Real-data guard failed/);
		expect(commitCount(dir)).toBe(1);
	});

	test('a staged fixture with a real-looking phone blocks the commit', () => {
		stage(dir, 'data/agents.csv', `name,phone\nPat,${realPhone()}\n`);
		const r = commit(dir, 'add agents');
		expect(r.status).not.toBe(0);
		expect(r.stdout + r.stderr).toMatch(/real-looking US phone/);
		expect(commitCount(dir)).toBe(1);
	});

	test('a costar-named path blocks the commit regardless of content', () => {
		stage(dir, 'imports/costar-export.csv', 'address,rent\n');
		const r = commit(dir, 'add export');
		expect(r.status).not.toBe(0);
		expect(r.stdout + r.stderr).toMatch(/costar/i);
		expect(commitCount(dir)).toBe(1);
	});

	test('a clean file commits normally', () => {
		stage(
			dir,
			'README.md',
			'# Scratch\n\nOrdinary prose with a fictional contact: jane@example.com, (512) 555-0142.\n'
		);
		const r = commit(dir, 'add readme');
		expect(r.status, r.stdout + r.stderr).toBe(0);
		expect(commitCount(dir)).toBe(2);
	});

	test('staged content is what the gate reads, not the working tree', () => {
		// Stage the secret, then overwrite the working copy with clean content: the hook must still
		// reject, because guard/gitleaks read the index, not the file on disk.
		stage(dir, 'fixtures/leads.json', JSON.stringify({ email: realEmail() }) + '\n');
		writeFileSync(
			join(dir, 'fixtures', 'leads.json'),
			JSON.stringify({ email: 'x@example.com' }) + '\n'
		);
		const r = commit(dir, 'sneaky');
		expect(r.status).not.toBe(0);
		expect(commitCount(dir)).toBe(1);
	});
});
