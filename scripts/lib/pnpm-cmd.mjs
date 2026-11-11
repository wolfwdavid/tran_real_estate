// The one place that decides how scripts spawn the pinned pnpm (Phase 16, TOOL-01). pnpm 11 sets
// npm_execpath to a JavaScript entry (`node <execpath> ...`); pnpm 12 is a native binary and sets it to
// pnpm.exe, which `node` cannot load (ERR_UNKNOWN_FILE_EXTENSION). build-web, smoke, audit-evidence and
// launch-audit all go through this helper so both forms keep working.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How to spawn the pnpm that invoked the current script, else corepack's pnpm.
 *  - npm_execpath is a .js/.cjs/.mjs entry: run it with this node.
 *  - npm_execpath is anything else (a native pnpm binary): run it directly.
 *  - npm_execpath unset: `corepack pnpm`; corepack is a .cmd shim on Windows, so that needs a shell.
 * Pure on (env, platform).
 * @param {Record<string, string | undefined>} [env]
 * @param {NodeJS.Platform} [platform]
 * @returns {{ bin: string, pre: string[], shell: boolean }}
 */
export function pnpmCommand(env = process.env, platform = process.platform) {
	const execPath = env.npm_execpath;
	if (!execPath) return { bin: 'corepack', pre: ['pnpm'], shell: platform === 'win32' };
	if (/\.[cm]?js$/i.test(execPath)) return { bin: process.execPath, pre: [execPath], shell: false };
	return { bin: execPath, pre: [], shell: false };
}

/**
 * The pnpm version pinned in package.json `packageManager` (`pnpm@x.y.z`).
 * @param {() => string} [readText]
 * @returns {string}
 */
export function pinnedPnpmVersion(
	readText = () => readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')
) {
	const pm = JSON.parse(readText()).packageManager;
	const m = typeof pm === 'string' ? /^pnpm@(\d+\.\d+\.\d+)$/.exec(pm) : null;
	if (!m)
		throw new Error(`package.json packageManager must be pnpm@x.y.z, got ${JSON.stringify(pm)}`);
	return m[1];
}
