// Fail-closed actionlint runner. Usage: node scripts/actionlint.mjs [workflow files...]
// With no arguments it lints every .github/workflows/*.yml|*.yaml file; an empty list fails closed.
//
// Resolution order:
//   1. ACTIONLINT_BIN, when set and non-empty, is the ONLY candidate. If it does not resolve the
//      run fails immediately; it never falls through to .tools/ or PATH (mirrors GITLEAKS_BIN).
//   2. .tools/actionlint.exe (win32) or .tools/actionlint, the gitignored local download.
//   3. Bare `actionlint` on PATH.
// If nothing resolves the run exits 1 with the install hint. Missing linter is never a silent skip.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED_VERSION = '1.7.12';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL_HINT = [
	`actionlint ${PINNED_VERSION} not found. Install it into the gitignored .tools/ directory:`,
	`  gh release download v${PINNED_VERSION} -R rhysd/actionlint -p 'actionlint_${PINNED_VERSION}_windows_amd64.zip' -D .tools`,
	'  then extract actionlint.exe into .tools/',
	'or set ACTIONLINT_BIN to an actionlint binary. Workflow lint blocked.'
].join('\n');

function probe(bin) {
	const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
	if (r.error || r.status !== 0) return null;
	return (r.stdout ?? '').split(/\r?\n/)[0].trim();
}

function resolveBinary() {
	const override = process.env.ACTIONLINT_BIN;
	if (override !== undefined && override !== '') {
		const version = probe(override);
		if (version === null) {
			console.error(`ACTIONLINT_BIN=${override} does not run.`);
			console.error(INSTALL_HINT);
			process.exit(1);
		}
		return { bin: override, version };
	}
	const local = join(
		repoRoot,
		'.tools',
		process.platform === 'win32' ? 'actionlint.exe' : 'actionlint'
	);
	const candidates = [...(existsSync(local) ? [local] : []), 'actionlint'];
	for (const bin of candidates) {
		const version = probe(bin);
		if (version !== null) return { bin, version };
	}
	console.error(INSTALL_HINT);
	process.exit(1);
}

const { bin, version } = resolveBinary();
if (version !== PINNED_VERSION) {
	console.warn(`actionlint ${version} found; pinned version is ${PINNED_VERSION}`);
}

function listWorkflows() {
	const dir = join(repoRoot, '.github/workflows');
	const names = existsSync(dir)
		? readdirSync(dir)
				.filter((name) => /\.ya?ml$/.test(name))
				.sort()
		: [];
	if (names.length === 0) {
		console.error('No workflow files found under .github/workflows; workflow lint blocked.');
		process.exit(1);
	}
	return names.map((name) => `.github/workflows/${name}`);
}

const files = process.argv.length > 2 ? process.argv.slice(2) : listWorkflows();
const result = spawnSync(bin, files, { cwd: repoRoot, stdio: 'inherit' });
process.exit(result.status ?? 1);
