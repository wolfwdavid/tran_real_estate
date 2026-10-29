import { spawnSync } from 'node:child_process';
import { resolveBuildStamp } from '../apps/web/src/lib/build-stamp.js';
import { targetEnv } from './lib/build-targets.mjs';

const name = process.argv[2] ?? 'root';
let t;
try {
	t = targetEnv(name);
} catch {
	console.error('usage: node scripts/build-web.mjs root|sub|configured');
	process.exit(2);
}
// LIVE-04: resolve the commit stamp once so the log line and the build agree on it.
let stamp;
try {
	stamp = resolveBuildStamp(process.env, () =>
		(spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout ?? '').trim()
	);
} catch (err) {
	console.error(`build-web: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(2);
}
// Drive the SAME pnpm that invoked this script (pinned 11.27.0 via `packageManager`),
// never the machine-global `pnpm` on PATH (11.0.9 on this machine).
const execPath = process.env.npm_execpath;
const [bin, pre] = execPath ? [process.execPath, [execPath]] : ['corepack', ['pnpm']];
// corepack is a .cmd shim on Windows, so the direct-`node` fallback needs a shell for both spawns.
const shell = !execPath && process.platform === 'win32';
const probe = spawnSync(bin, [...pre, '--version'], { encoding: 'utf8', shell });
const version = (probe.stdout ?? '').trim();
if (version !== '11.27.0')
	console.warn(`build-web: pnpm ${version || 'unknown'} found; pinned version is 11.27.0`);
console.log(
	`build-web: pnpm ${version} target=${name} BUILD_DIR=${t.BUILD_DIR} BUILD_SHA=${stamp}`
);
const r = spawnSync(bin, [...pre, '--filter', 'web', 'build'], {
	stdio: 'inherit',
	env: { ...process.env, ...t, BUILD_SHA: stamp },
	shell
});
process.exit(r.status ?? 1);
