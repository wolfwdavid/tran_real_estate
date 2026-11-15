// Repo-wide gate for the SvelteKit 3 migration (phase 16, TOOL-02). Every tracked or untracked-unignored
// text file must be free of the retired spellings below, so the old alias or a codemod leftover cannot
// creep back. The only exception is this file, which has to spell the tokens to look for them.
// Planted strings prove each token is reported, so a green sweep is not vacuous
// (same style as scripts/service-worker-guard.test.ts and the sweep scaffold in scripts/test-lanes.test.ts).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

// Assembled from parts only where a literal would be a hit in some other sweep; here the file is allowlisted.
const FORBIDDEN_TOKENS = [
	'$lib',
	'@migration-task',
	'$app/environment',
	'$app/stores',
	'svelte.config.js',
	'$service-worker'
] as const;

/** Exact repo-relative paths, no globs. Frozen so a test cannot widen it at runtime. */
const ALLOWLIST: readonly string[] = Object.freeze([
	'scripts/kit3-migration.test.ts',
	// Its FORBIDDEN list has to spell the retired `$service-worker` import to ban it.
	'scripts/service-worker-guard.test.ts'
]);

const BINARY_EXT =
	/\.(png|jpe?g|gif|webp|avif|ico|icns|woff2?|ttf|otf|eot|pdf|zip|gz|br|mp4|webm|wasm|lockb|xlsx?)$/i;
const SKIPPED = (path: string) =>
	path.endsWith('.md') ||
	path.startsWith('.planning/') ||
	path === 'pnpm-lock.yaml' ||
	BINARY_EXT.test(path);

/** Tokens present in `text` for a repo-relative POSIX `path`; [] for skipped, allowlisted or binary files. */
function findings(path: string, text: string, allow: readonly string[] = ALLOWLIST): string[] {
	if (SKIPPED(path) || allow.includes(path) || text.includes('\0')) return [];
	return FORBIDDEN_TOKENS.filter((t) => text.includes(t));
}

describe('findings() reports every forbidden token (planted)', () => {
	test.each(FORBIDDEN_TOKENS)('a planted %s is reported', (token) => {
		expect(findings('apps/web/src/planted.ts', `const x = "${token}/y";\n`)).toEqual([token]);
	});

	test('a path that is not on the allowlist is reported even when it sits next to an allowed one', () => {
		const text = `// ${FORBIDDEN_TOKENS.join(' ')}\n`;
		expect(findings('scripts/kit3-migration.test.ts', text)).toEqual([]);
		expect(findings('scripts/service-worker-guard.test.ts', text)).toEqual([]);
		expect(findings('scripts/service-worker-guard.test.tsx', text)).toEqual([...FORBIDDEN_TOKENS]);
		expect(findings('scripts/kit3-migration.test.tsx', text)).toEqual([...FORBIDDEN_TOKENS]);
		expect(findings('scripts/other.test.ts', text)).toEqual([...FORBIDDEN_TOKENS]);
	});

	test('control: clean text, markdown, planning docs, the lockfile and binary content are silent', () => {
		expect(findings('apps/web/src/clean.ts', "import x from '#lib/x.ts';\n")).toEqual([]);
		for (const p of ['docs/a.md', '.planning/STATE.json', 'pnpm-lock.yaml', 'static/a.png']) {
			expect(findings(p, FORBIDDEN_TOKENS.join(' '))).toEqual([]);
		}
		expect(findings('static/blob.bin', `${FORBIDDEN_TOKENS[0]}\0`)).toEqual([]);
	});

	test('the allowlist is frozen, exact-path and holds only this file and the worker guard', () => {
		expect(Object.isFrozen(ALLOWLIST)).toBe(true);
		expect([...ALLOWLIST]).toEqual([
			'scripts/kit3-migration.test.ts',
			'scripts/service-worker-guard.test.ts'
		]);
		expect(ALLOWLIST.some((p) => /[*?[\]{}]/.test(p))).toBe(false);
	});
});

describe('repo sweep', () => {
	let repoPaths: string[] = [];
	const texts = new Map<string, string>();

	beforeAll(() => {
		// -z: NUL-separated, so paths with spaces or quotes are never C-escaped.
		const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
			cwd: ROOT,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		});
		expect(r.status, r.stderr).toBe(0);
		// A path git lists can be gone from disk (deleted, not yet staged): only read what exists.
		repoPaths = r.stdout
			.split('\0')
			.filter(Boolean)
			.filter((p) => existsSync(resolve(ROOT, p)));
		for (const p of repoPaths) {
			if (SKIPPED(p)) continue;
			texts.set(p, readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n'));
		}
	});

	test('non-vacuity: the sweep reads the tree and this file is on it', () => {
		expect(repoPaths.length).toBeGreaterThan(500);
		expect(texts.size).toBeGreaterThan(500);
		expect(texts.has('scripts/kit3-migration.test.ts')).toBe(true);
		expect(texts.has('apps/web/vite.config.ts')).toBe(true);
		// The allowlisted file itself spells every token, so a sweep that skipped nothing would fail.
		const own = texts.get('scripts/kit3-migration.test.ts') ?? '';
		expect(FORBIDDEN_TOKENS.every((t) => own.includes(t))).toBe(true);
	});

	test('no file outside the allowlist contains a retired spelling', () => {
		const hits = [...texts]
			.map(([path, text]) => ({ path, tokens: findings(path, text) }))
			.filter((h) => h.tokens.length > 0);
		expect(hits).toEqual([]);
	});

	test('no codemod task file was left behind', () => {
		expect(repoPaths.filter((p) => /(^|\/)MIGRATION_TASKS\.md$/.test(p))).toEqual([]);
	});
});
