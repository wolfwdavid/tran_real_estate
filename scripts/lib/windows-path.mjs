// The one Windows PATH/taskkill teardown guard (Phase 1, tested in 15-07 under TEST-04). Every
// Playwright and Vitest browser config calls ensureSystem32OnPath() at module top level, inside the
// runner process, so the fix applies to that process only and never touches the machine.

/**
 * Playwright stops child processes on Windows with `taskkill /pid <pid> /T /F` through cmd.exe, using the
 * runner's PATH, and discards the output. Without %SystemRoot%\System32 on PATH that call fails silently
 * and teardown hangs for minutes. Prepend System32 when it is missing. Pure on (env, platform).
 *
 * The lookup is case-insensitive, ignores trailing slashes and treats `/` and `\` alike, and writes
 * back to whichever spelling of the PATH key the env already has (a plain object is case-sensitive,
 * unlike Windows `process.env`).
 * @param {Record<string, string | undefined>} [env]
 * @param {NodeJS.Platform} [platform]
 * @returns {boolean} true when PATH was changed
 */
export function ensureSystem32OnPath(env = process.env, platform = process.platform) {
	if (platform !== 'win32') return false;
	const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
	const system32 = `${env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	/** @param {string} p */
	const norm = (p) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
	const entries = (env[key] ?? '').split(';');
	if (entries.some((e) => norm(e) === norm(system32))) return false;
	env[key] = [system32, ...entries.filter(Boolean)].join(';');
	return true;
}
