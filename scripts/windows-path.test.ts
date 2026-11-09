// TEST-04: the Windows PATH/taskkill teardown guard (Phase 1) as one tested module.
//
// Playwright (and Vitest browser mode through it) stops child processes on Windows with
// `taskkill /pid <pid> /T /F` run through cmd.exe, using the runner's PATH, with the output
// discarded. When PATH omits %SystemRoot%\System32 the call fails silently and teardown hangs for
// minutes. scripts/lib/windows-path.mjs prepends System32 when it is missing; the five Playwright
// and Vitest browser configs call it at module top level. This file pins the pure function, pins
// that every config uses it (no inline copy survives), and on win32 reproduces the root cause: the
// same cmd.exe call shape cannot find taskkill before the guard and can after it.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureSystem32OnPath } from './lib/windows-path.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

/** The five configs that carried an identical inline copy of the guard before 15-07. */
const CONFIGS = [
	'apps/web/playwright.config.ts',
	'apps/web/playwright.smoke.config.ts',
	'apps/extension/playwright.config.ts',
	'apps/web/vitest.browser.config.ts',
	'apps/extension/vitest.browser.config.ts'
];
const IMPORT_LINE = "import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';";

describe('ensureSystem32OnPath', () => {
	test('(a) prepends System32 when PATH lacks it and reports the change', () => {
		const env = { PATH: 'C:\\tools;D:\\bin', SystemRoot: 'C:\\Windows' };
		expect(ensureSystem32OnPath(env, 'win32')).toBe(true);
		expect(env.PATH).toBe('C:\\Windows\\System32;C:\\tools;D:\\bin');
	});

	test('(b) leaves PATH alone when System32 is present in another case or with a trailing slash', () => {
		const back = { PATH: 'C:\\tools;c:\\windows\\system32\\', SystemRoot: 'C:\\Windows' };
		expect(ensureSystem32OnPath(back, 'win32')).toBe(false);
		expect(back.PATH).toBe('C:\\tools;c:\\windows\\system32\\');

		const fwd = { PATH: 'C:/Windows/System32/;C:\\tools', SystemRoot: 'C:\\Windows' };
		expect(ensureSystem32OnPath(fwd, 'win32')).toBe(false);
		expect(fwd.PATH).toBe('C:/Windows/System32/;C:\\tools');
	});

	test('(c) falls back to C:\\Windows when SystemRoot is unset', () => {
		const env: Record<string, string | undefined> = { PATH: 'C:\\tools' };
		expect(ensureSystem32OnPath(env, 'win32')).toBe(true);
		expect(env.PATH?.startsWith('C:\\Windows\\System32;')).toBe(true);
		expect(env.PATH).toBe('C:\\Windows\\System32;C:\\tools');
	});

	test.each(['linux', 'darwin'] as const)('(d) is a no-op on %s', (platform) => {
		const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' };
		const before = structuredClone(env);
		expect(ensureSystem32OnPath(env, platform)).toBe(false);
		expect(env).toEqual(before);
	});

	test('(e) writes back to the existing key when it is spelled Path', () => {
		const env: Record<string, string | undefined> = { Path: 'C:\\tools', SystemRoot: 'D:\\Win' };
		expect(ensureSystem32OnPath(env, 'win32')).toBe(true);
		expect(env.Path).toBe('D:\\Win\\System32;C:\\tools');
		expect(Object.keys(env)).toEqual(['Path', 'SystemRoot']);
		expect('PATH' in env).toBe(false);
	});

	test('(f) an empty PATH becomes System32 alone, with no trailing separator', () => {
		const empty = { PATH: '', SystemRoot: 'C:\\Windows' };
		expect(ensureSystem32OnPath(empty, 'win32')).toBe(true);
		expect(empty.PATH).toBe('C:\\Windows\\System32');

		const missing: Record<string, string | undefined> = { SystemRoot: 'C:\\Windows' };
		expect(ensureSystem32OnPath(missing, 'win32')).toBe(true);
		expect(missing.PATH).toBe('C:\\Windows\\System32');
	});
});

describe('the five configs call the module instead of carrying an inline copy', () => {
	test.each(CONFIGS)('(g) %s imports ensureSystem32OnPath and calls it at top level', (p) => {
		const src = read(p);
		expect(src, 'import line').toContain(IMPORT_LINE);
		expect(src.match(/^ensureSystem32OnPath\(\);$/gm), 'exactly one top-level call').toHaveLength(
			1
		);
		// No inline copy: outside the identifier itself the literal never appears, and the old
		// `if (process.platform === 'win32')` branch is gone.
		const stripped = src.replace(/ensureSystem32OnPath/g, '');
		expect(stripped, 'literal System32 outside the identifier').not.toMatch(/system32/i);
		expect(stripped, 'inline platform branch').not.toContain("process.platform === 'win32'");
	});
});

describe('win32 root cause', () => {
	// cmd.exe resolves `taskkill` from the PATH in its own environment, exactly as Playwright's
	// teardown does. ComSpec is an absolute path, so cmd.exe itself spawns even with the bare PATH.
	const taskkillHelp = (env: Record<string, string | undefined>) =>
		spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'taskkill /?'], {
			env,
			encoding: 'utf8'
		});

	test.runIf(process.platform === 'win32')(
		'(h) ensureSystem32OnPath makes taskkill resolvable through cmd.exe',
		() => {
			const env: Record<string, string | undefined> = { ...process.env };
			for (const k of Object.keys(env)) if (k.toUpperCase() === 'PATH') delete env[k];
			env.PATH = dirname(process.execPath);

			const before = taskkillHelp(env);
			expect(before.error).toBeUndefined();
			expect(before.status, `before: ${before.stdout}${before.stderr}`).not.toBe(0);

			expect(ensureSystem32OnPath(env)).toBe(true);
			const after = taskkillHelp(env);
			expect(after.error).toBeUndefined();
			expect(after.status, `after: ${after.stdout}${after.stderr}`).toBe(0);
			expect(after.stdout).toContain('TASKKILL');
		}
	);
});
