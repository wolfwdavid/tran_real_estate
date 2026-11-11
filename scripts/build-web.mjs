import { spawnSync } from 'node:child_process';
import { resolveBuildStamp } from '../apps/web/src/lib/build-stamp.js';
import { targetEnv } from './lib/build-targets.mjs';
import { pinnedPnpmVersion, pnpmCommand } from './lib/pnpm-cmd.mjs';

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
// Drive the SAME pnpm that invoked this script (pinned via `packageManager`), never the
// machine-global `pnpm` on PATH. The helper covers the .js entry, the native binary and corepack.
const { bin, pre, shell } = pnpmCommand();
const pinned = pinnedPnpmVersion();
const probe = spawnSync(bin, [...pre, '--version'], { encoding: 'utf8', shell });
const version = (probe.stdout ?? '').trim();
if (version !== pinned)
	console.warn(`build-web: pnpm ${version || 'unknown'} found; pinned version is ${pinned}`);
console.log(
	`build-web: pnpm ${version} target=${name} BASE_PATH=${t.BASE_PATH || "''"} BUILD_DIR=${t.BUILD_DIR} BUILD_SHA=${stamp}`
);
const r = spawnSync(bin, [...pre, '--filter', 'web', 'build'], {
	stdio: 'inherit',
	env: { ...process.env, ...t, BUILD_SHA: stamp },
	shell
});
process.exit(r.status ?? 1);
