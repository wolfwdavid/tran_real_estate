// shadcn UI class guard. Usage: node scripts/ui-class-guard.mjs [--root <dir>]
// Walks SCOPE on the filesystem (not the git index) so new, not-yet-staged components are scanned.
// Fails closed: any hit exits 1, and an empty scope (zero files) exits 1.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCANNED_EXT, SCOPE, findUiClassViolations } from './lib/ui-class-rules.mjs';

/**
 * @param {string} root repository root
 * @returns {string[]} repo-relative POSIX paths of every scanned file, sorted
 */
export function collectFiles(root) {
	/** @type {string[]} */
	const files = [];
	for (const dir of SCOPE) {
		const abs = join(root, dir);
		if (!existsSync(abs)) continue;
		for (const entry of readdirSync(abs, { recursive: true, encoding: 'utf8' })) {
			const full = join(abs, entry);
			if (!statSync(full).isFile() || !SCANNED_EXT.test(full)) continue;
			files.push(relative(root, full).split(sep).join('/'));
		}
	}
	return files.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const i = process.argv.indexOf('--root');
	const root = resolve(i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : process.cwd());
	const files = collectFiles(root);

	if (files.length === 0) {
		console.error('UI class guard scanned 0 files; scope is misconfigured');
		process.exit(1);
	}

	const hits = files.flatMap((rel) =>
		findUiClassViolations(rel, readFileSync(join(root, rel), 'utf8'))
	);
	if (hits.length) {
		console.error(`UI class guard failed (${hits.length}):\n- ` + hits.join('\n- '));
		process.exit(1);
	}
	console.log(`UI class guard passed (${files.length} files)`);
}
