import { spawnSync } from 'node:child_process';

const targets = {
	root: { BASE_PATH: '', BUILD_DIR: 'build' },
	sub: { BASE_PATH: '/tran_real_estate', BUILD_DIR: 'build-sub' }
};
const t = targets[process.argv[2] ?? 'root'];
if (!t) {
	console.error('usage: node scripts/build-web.mjs root|sub');
	process.exit(2);
}
// Drive the SAME pnpm that invoked this script (pinned 11.27.0 via `packageManager`),
// never the machine-global `pnpm` on PATH (11.0.9 on this machine).
const execPath = process.env.npm_execpath;
const [bin, pre] = execPath ? [process.execPath, [execPath]] : ['corepack', ['pnpm']];
const probe = spawnSync(bin, [...pre, '--version'], { encoding: 'utf8' });
const version = (probe.stdout ?? '').trim();
if (version !== '11.27.0')
	console.warn(`build-web: pnpm ${version || 'unknown'} found; pinned version is 11.27.0`);
console.log(
	`build-web: pnpm ${version} target=${process.argv[2] ?? 'root'} BUILD_DIR=${t.BUILD_DIR}`
);
const r = spawnSync(bin, [...pre, '--filter', 'web', 'build'], {
	stdio: 'inherit',
	env: { ...process.env, ...t },
	shell: !execPath && process.platform === 'win32'
});
process.exit(r.status ?? 1);
