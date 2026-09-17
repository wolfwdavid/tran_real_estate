// Fail-closed gitleaks runner. Usage: node scripts/gitleaks.mjs [staged | history]
import { spawnSync } from 'node:child_process';

const bin = process.env.GITLEAKS_BIN || 'gitleaks';
const probe = spawnSync(bin, ['version'], { encoding: 'utf8' });
if (probe.error) {
	console.error(
		'gitleaks not found. Install: winget install --id Gitleaks.Gitleaks -e (or set GITLEAKS_BIN). Commit blocked.'
	);
	process.exit(1);
}
if (!probe.stdout.includes('8.30.1')) {
	console.warn(`gitleaks ${probe.stdout.trim()} found; pinned version is 8.30.1`);
}

const mode = process.argv[2] ?? 'staged';
const args =
	mode === 'staged'
		? ['git', '--staged', '--no-banner', '--redact', '--config', '.gitleaks.toml', '.']
		: ['git', '--no-banner', '--redact', '--config', '.gitleaks.toml', '.'];
process.exit(spawnSync(bin, args, { stdio: 'inherit' }).status ?? 1);
