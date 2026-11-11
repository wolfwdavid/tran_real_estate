// TOOL-01: how scripts spawn the pinned pnpm. pnpm 12 is a native binary whose npm_execpath is
// pnpm.exe; `node pnpm.exe` crashes with ERR_UNKNOWN_FILE_EXTENSION. scripts/lib/pnpm-cmd.mjs owns
// the decision; this file pins its branches and that no spawner carries an inline copy.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { pinnedPnpmVersion, pnpmCommand } from './lib/pnpm-cmd.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const SPAWNERS = [
	'scripts/build-web.mjs',
	'scripts/smoke.mjs',
	'scripts/audit-evidence.mjs',
	'scripts/launch-audit.mjs'
];
const HELPER = 'scripts/lib/pnpm-cmd.mjs';
const IMPORT = "from './lib/pnpm-cmd.mjs'";
const INLINE_PAIR = '[process.execPath, [execPath]]';

describe('pnpmCommand', () => {
	test.each(['C:\\x\\pnpm.cjs', 'C:\\x\\pnpm.js', 'C:\\x\\pnpm.mjs', '/x/bin/pnpm.CJS'])(
		'(a) a JavaScript npm_execpath (%s) runs through this node',
		(npm_execpath) => {
			expect(pnpmCommand({ npm_execpath }, 'win32')).toEqual({
				bin: process.execPath,
				pre: [npm_execpath],
				shell: false
			});
		}
	);

	test.each([
		['C:\\x\\node_modules\\pnpm\\pnpm.exe', 'win32'],
		['/opt/pnpm/pnpm', 'linux']
	] as const)('(b) a native npm_execpath (%s) is run directly', (npm_execpath, platform) => {
		expect(pnpmCommand({ npm_execpath }, platform)).toEqual({
			bin: npm_execpath,
			pre: [],
			shell: false
		});
	});

	test('(c) an unset npm_execpath falls back to corepack, with a shell only on win32', () => {
		expect(pnpmCommand({}, 'win32')).toEqual({ bin: 'corepack', pre: ['pnpm'], shell: true });
		expect(pnpmCommand({}, 'linux')).toEqual({ bin: 'corepack', pre: ['pnpm'], shell: false });
		expect(pnpmCommand({ npm_execpath: '' }, 'win32').bin).toBe('corepack');
	});

	test('(d) defaults to the process env and platform', () => {
		expect(pnpmCommand()).toEqual(pnpmCommand(process.env, process.platform));
	});

	test('(e) the command it returns really reports a version', () => {
		const { bin, pre, shell } = pnpmCommand();
		const r = spawnSync(bin, [...pre, '--version'], { encoding: 'utf8', shell });
		expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
	});
});

describe('pinnedPnpmVersion', () => {
	test('(f) reads the version after pnpm@', () => {
		expect(pinnedPnpmVersion(() => '{"packageManager":"pnpm@12.18.0"}')).toBe('12.18.0');
	});

	test.each(['{}', '{"packageManager":"yarn@4.0.0"}', '{"packageManager":"pnpm@12"}'])(
		'(g) rejects a missing or malformed packageManager: %s',
		(json) => {
			expect(() => pinnedPnpmVersion(() => json)).toThrow(/packageManager/);
		}
	);

	test('(h) the default reader agrees with package.json', () => {
		const pm = JSON.parse(read('package.json')).packageManager as string;
		expect(`pnpm@${pinnedPnpmVersion()}`).toBe(pm);
	});
});

describe('no inline copy survives', () => {
	/** The sweep predicate: does a source carry the old inline spawn pair? */
	const hasInlinePair = (src: string) => src.includes(INLINE_PAIR);

	test.each(SPAWNERS)('(i) %s imports the helper and has no inline pair', (p) => {
		expect(existsSync(join(ROOT, p))).toBe(true);
		const src = read(p);
		expect(src, 'import').toContain(IMPORT);
		expect(hasInlinePair(src), 'inline pair').toBe(false);
	});

	test('(j) no scripts/*.mjs outside the helper carries the inline pair', () => {
		const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
			cwd: ROOT,
			encoding: 'utf8'
		});
		expect(r.status, r.stderr).toBe(0);
		const offenders = r.stdout
			.split('\0')
			.filter(Boolean)
			.map((p) => p.replace(/\\/g, '/'))
			.filter((p) => /^scripts\/.*\.mjs$/.test(p) && p !== HELPER && existsSync(join(ROOT, p)))
			.filter((p) => hasInlinePair(read(p)));
		expect(offenders).toEqual([]);
	});

	test('(k) non-vacuity: the predicate reports a source that still has the old pair', () => {
		const planted = `const [bin, pre] = execPath ? ${INLINE_PAIR} : ['corepack', ['pnpm']];`;
		expect(hasInlinePair(planted)).toBe(true);
		expect(hasInlinePair('const { bin, pre, shell } = pnpmCommand();')).toBe(false);
	});
});
