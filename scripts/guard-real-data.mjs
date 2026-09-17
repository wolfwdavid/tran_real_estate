// Real-data / CoStar guard. Usage: node scripts/guard-real-data.mjs [--all | --staged]
// --staged reads blob contents via `git show :path` so unstaged edits cannot mask staged content.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { findProblems } from './lib/real-data-rules.mjs';

const mode = process.argv.includes('--staged') ? 'staged' : 'all';
const files = (
	mode === 'staged'
		? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
		: execFileSync('git', ['ls-files', '-z'])
)
	.toString('utf8')
	.split('\0')
	.filter(Boolean);

const contentOf = (file) => {
	if (mode === 'staged') return execFileSync('git', ['show', `:${file}`]).toString('utf8');
	return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

const problems = files.flatMap((file) => findProblems(file, contentOf(file)));

if (problems.length) {
	console.error(`Real-data guard failed (${problems.length}):\n- ` + problems.join('\n- '));
	process.exit(1);
}
console.log(`Real-data guard passed (${files.length} ${mode} files checked)`);
