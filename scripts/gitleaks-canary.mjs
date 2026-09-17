// Self-test: prove the gitleaks config rejects the canary pattern (expects exit 1 on detection).
import { spawnSync } from 'node:child_process';

// Assembled at runtime from two literals so this source file never matches the rule itself.
const canary = 'TRANCANARY_' + 'A1B2C3D4E5F6G7H8J9K0L1M2N3P4Q5R6';
const r = spawnSync(
	process.env.GITLEAKS_BIN || 'gitleaks',
	['stdin', '--no-banner', '--redact', '--config', '.gitleaks.toml'],
	{ input: `const k = "${canary}";\n` }
);
if (r.status !== 1) {
	console.error('Canary NOT detected: secret scanning is misconfigured');
	process.exit(1);
}
console.log('gitleaks canary detected as expected');
