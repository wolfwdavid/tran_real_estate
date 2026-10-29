// Tests for the commit-message hygiene guard (12-01, LIVE-01): the pure check, the log parser,
// the CLI in both modes, and the commit-msg hook wiring. Planted attribution strings are assembled
// at runtime so this file never reads as a trailer itself. Every git repository used here is a
// throwaway under os.tmpdir(); nothing commits to this repository.
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import {
	ATTRIBUTION_PATTERNS,
	attributionOffences,
	parseLog,
	stripCommentLines
} from './commit-hygiene.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const script = join(repoRoot, 'scripts', 'commit-hygiene.mjs');
const scriptPosix = script.replace(/\\/g, '/');

const vendor = ['anth', 'ropic'].join('');
const model = ['Cla', 'ude'].join('');
const noreply = ['noreply', '@', vendor, '.com'].join('');
const trailerKey = ['Co', 'Authored', 'By'].join('-');
const trailer = `${trailerKey}: ${model} Opus 5.5 <${noreply}>`;
const robot = String.fromCodePoint(0x1f916);
const generated = `${robot} Generated with [${model} Code](https://${model.toLowerCase()}.com/${model.toLowerCase()}-code)`;

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
	'simple-git-hooks': Record<string, string>;
};
const HOOK_COMMAND = 'node scripts/commit-hygiene.mjs --message-file $1';

const temps: string[] = [];
afterAll(() => {
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
const tempDir = (prefix: string) => {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	temps.push(dir);
	return dir;
};

type Run = { status: number; stdout: string; stderr: string };
const run = (cmd: string, args: string[], cwd: string): Run => {
	const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
	if (r.error) throw r.error;
	return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
};
const git = (cwd: string, ...args: string[]) =>
	run(
		'git',
		['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
		cwd
	);
const cli = (cwd: string, ...args: string[]) => run(process.execPath, [script, ...args], cwd);

function initRepo(prefix: string): string {
	const dir = tempDir(prefix);
	expect(git(dir, 'init', '-q', '-b', 'main').status).toBe(0);
	return dir;
}

describe('attributionOffences', () => {
	test('product content naming model providers passes', () => {
		expect(attributionOffences('feat(05-02): add Anthropic streaming adapter\n')).toEqual([]);
		expect(attributionOffences('fix(05-07): Gemini dialog copy')).toEqual([]);
		expect(attributionOffences('feat: add claude-sonnet-5 to the model registry')).toEqual([]);
	});

	test('a human co-author is allowed', () => {
		expect(attributionOffences(`chore: z\n\n${trailerKey}: Jane Doe <jane@example.com>\n`)).toEqual(
			[]
		);
	});

	test('a model co-author trailer is rejected', () => {
		expect(attributionOffences(`fix: x\n\n${trailer}\n`).length).toBeGreaterThan(0);
	});

	test('the generated-with footer is rejected', () => {
		expect(attributionOffences(`docs: y\n\n${generated}\n`).length).toBeGreaterThan(0);
	});

	// One planted positive per pattern, each matching that pattern and no earlier one by accident.
	const planted: [number, string][] = [
		[0, `fix: a\n\n${trailerKey.toLowerCase()}: ${model}\n`],
		[1, `fix: b\n\nreviewed-by: bot <${noreply}>\n`],
		[2, `fix: c\n\ngenerated with ${model}\n`],
		[3, `fix: d\n\nmade in ${model} code\n`],
		[4, `fix: e ${robot}\n`]
	];
	for (const [i, message] of planted) {
		test(`pattern ${i} (${ATTRIBUTION_PATTERNS[i].source}) has a planted positive`, () => {
			expect(ATTRIBUTION_PATTERNS[i].test(message)).toBe(true);
			expect(attributionOffences(message)).toContain(ATTRIBUTION_PATTERNS[i].source);
		});
	}

	test('there are exactly five frozen patterns', () => {
		expect(ATTRIBUTION_PATTERNS).toHaveLength(5);
		expect(Object.isFrozen(ATTRIBUTION_PATTERNS)).toBe(true);
	});

	test('the trailer pattern is anchored to a line start', () => {
		expect(attributionOffences(`fix: mention x${trailerKey}: ${model} inline`)).not.toContain(
			ATTRIBUTION_PATTERNS[0].source
		);
	});
});

describe('stripCommentLines', () => {
	test('drops # lines and everything below the scissors line', () => {
		const raw = `feat: ok\n\n# ${trailer}\n# ------------------------ >8 ------------------------\ndiff ${model} code\n`;
		const kept = stripCommentLines(raw);
		expect(kept).toBe('feat: ok\n\n');
		expect(attributionOffences(kept)).toEqual([]);
	});
});

describe('parseLog', () => {
	test('yields one {sha, message} per commit of a NUL-delimited stream', () => {
		const a = 'a'.repeat(40);
		const b = 'b'.repeat(40);
		const raw = `${a}\0feat: one\n\nbody\n\0\n${b}\0fix: two\n\0\n`;
		expect(parseLog(raw)).toEqual([
			{ sha: a, message: 'feat: one\n\nbody\n' },
			{ sha: b, message: 'fix: two\n' }
		]);
	});

	test('an empty stream yields no commits', () => {
		expect(parseLog('')).toEqual([]);
	});
});

describe('CLI --message-file', () => {
	const dir = tempDir('tran-hygiene-msg-');
	const file = (name: string, content: string) => {
		const p = join(dir, name);
		writeFileSync(p, content);
		return p;
	};

	test('a planted trailer exits 1 with the explanation on stderr', () => {
		const r = cli(repoRoot, '--message-file', file('bad.txt', `fix: x\n\n${trailer}\n`));
		expect(r.status).toBe(1);
		expect(r.stderr).toContain('commit-hygiene: commit message carries assistant attribution');
	});

	test('a clean message exits 0', () => {
		const r = cli(
			repoRoot,
			'--message-file',
			file('ok.txt', 'feat(05-02): add Anthropic streaming adapter\n')
		);
		expect(r.status, r.stderr).toBe(0);
	});

	test('a trailer that only appears on a # comment line exits 0', () => {
		const r = cli(
			repoRoot,
			'--message-file',
			file('comment.txt', `feat: ok\n\n# ${trailerKey}: ${model}\n`)
		);
		expect(r.status, r.stderr).toBe(0);
	});

	test('no arguments, a bare flag or an unknown flag exits 2 with usage', () => {
		for (const args of [[], ['--message-file'], ['--bogus']]) {
			const r = cli(repoRoot, ...args);
			expect(r.status).toBe(2);
			expect(r.stderr).toContain('Usage:');
		}
	});
});

describe('CLI --history', () => {
	test('reports the one attributed commit of a throwaway repository', () => {
		const dir = initRepo('tran-hygiene-hist-');
		expect(
			git(dir, 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'feat: clean').status
		).toBe(0);
		expect(
			git(dir, 'commit', '-q', '--allow-empty', '--no-verify', '-m', `fix: planted\n\n${trailer}`)
				.status
		).toBe(0);
		const r = cli(dir);
		expect(r.status).toBe(2);
		const h = cli(dir, '--history');
		expect(h.status).toBe(1);
		expect(h.stdout).toContain('2 commits scanned, 1 with assistant attribution');
		expect(h.stdout).toMatch(/^[0-9a-f]{7} fix: planted$/m);
	});

	test('an amended-away trailer leaves a clean history (exit 0)', () => {
		const dir = initRepo('tran-hygiene-amend-');
		expect(
			git(dir, 'commit', '-q', '--allow-empty', '--no-verify', '-m', `fix: planted\n\n${trailer}`)
				.status
		).toBe(0);
		expect(
			git(dir, 'commit', '-q', '--amend', '--allow-empty', '--no-verify', '-m', 'clean').status
		).toBe(0);
		const h = cli(dir, '--history');
		expect(h.status, h.stdout + h.stderr).toBe(0);
		expect(h.stdout).toContain('1 commits scanned, 0 with assistant attribution');
	});

	test('a git failure exits 2', () => {
		const dir = tempDir('tran-hygiene-nogit-');
		const h = cli(dir, '--history', 'no-such-rev');
		expect(h.status).toBe(2);
	});
});

describe('commit-msg hook', () => {
	test('package.json wires the hygiene check as the commit-msg hook', () => {
		expect(pkg['simple-git-hooks']['commit-msg']).toBe(HOOK_COMMAND);
	});

	test('this repository has the commit-msg hook installed', () => {
		const hookPath = join(repoRoot, '.git', 'hooks', 'commit-msg');
		expect(existsSync(hookPath)).toBe(true);
		const hook = readFileSync(hookPath, 'utf8');
		expect(hook).toContain('commit-hygiene.mjs');
		expect(hook).toMatch(/SIMPLE_GIT_HOOKS_RC/);
	});

	test('the package.json command rejects an attributed commit before it exists', () => {
		const dir = initRepo('tran-hygiene-hook-');
		expect(git(dir, 'config', 'core.hooksPath', '.git/hooks').status).toBe(0);
		const hook = join(dir, '.git', 'hooks', 'commit-msg');
		mkdirSync(dirname(hook), { recursive: true });
		const command = HOOK_COMMAND.replace('scripts/commit-hygiene.mjs', `"${scriptPosix}"`);
		writeFileSync(hook, `#!/bin/sh\n${command}\n`);
		try {
			chmodSync(hook, 0o755);
		} catch {
			// Windows has no exec bit; git runs hook files through sh regardless.
		}
		const bad = git(dir, 'commit', '-q', '--allow-empty', '-m', `fix: planted\n\n${trailer}`);
		expect(bad.status).not.toBe(0);
		expect(bad.stderr).toContain('commit-hygiene:');
		expect(git(dir, 'rev-list', '--count', '--all').stdout.trim()).toBe('0');
		const ok = git(
			dir,
			'commit',
			'-q',
			'--allow-empty',
			'-m',
			'feat: add Anthropic streaming adapter'
		);
		expect(ok.status, ok.stderr).toBe(0);
		expect(git(dir, 'rev-list', '--count', 'HEAD').stdout.trim()).toBe('1');
	});
});
