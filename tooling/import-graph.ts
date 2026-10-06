// Transitive import-graph walker for structural boundary tests (Phase 8: "the agent CRM spends
// zero RentCast calls", "the public inquiry page touches no app internals"). ESLint only sees
// direct imports; this follows barrels and re-exports through the whole web source tree.
//
// Pure TypeScript on Node built-ins. All file access goes through an injectable GraphFs, and every
// path is normalised to forward slashes, so planted in-memory graphs and the real tree share code.
// Bare package specifiers (including @tran/*) are out of scope: workspace packages never import
// web code, so they cannot carry a path back into lib/data.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { posix } from 'node:path';

export interface GraphFs {
	read(path: string): string;
	isFile(path: string): boolean;
}

export const nodeFs: GraphFs = {
	read: (path) => readFileSync(path, 'utf8'),
	isFile: (path) => existsSync(path) && statSync(path).isFile()
};

/** Static imports, `export … from`, `import type`, dynamic import() and side-effect imports. */
export const IMPORT_RE =
	/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

const EXT = ['', '.ts', '.js', '.svelte', '.svelte.ts', '.svelte.js', '/index.ts', '/index.js'];

const toPosix = (p: string) => p.replace(/\\/g, '/');

/** Resolves a specifier to an existing file path, or null for bare packages and missing files. */
export function resolveSpec(
	spec: string,
	from: string,
	libDir: string,
	fs: GraphFs = nodeFs
): string | null {
	let base: string;
	if (spec === '$lib' || spec.startsWith('$lib/')) {
		base = posix.join(toPosix(libDir), spec.slice(4));
	} else if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
		// join, not resolve: resolve would prefix the cwd to a virtual "/v/…" path on Windows.
		base = posix.join(posix.dirname(toPosix(from)), spec);
	} else {
		return null;
	}
	const bases = base.endsWith('.js') ? [base, base.slice(0, -3)] : [base];
	for (const b of bases) {
		for (const ext of EXT) {
			const candidate = `${b}${ext}`;
			if (fs.isFile(candidate)) return candidate;
		}
	}
	return null;
}

/** Every local module reachable from `entries` (entries included), as forward-slash paths. */
export function importGraph(entries: string[], libDir: string, fs: GraphFs = nodeFs): Set<string> {
	const seen = new Set<string>();
	const queue = entries.map(toPosix);
	while (queue.length > 0) {
		const file = queue.pop() as string;
		if (seen.has(file)) continue;
		seen.add(file);
		if (!/\.(ts|js|mjs|svelte)$/.test(file)) continue;
		// A fresh regex per file: the global flag's lastIndex must never leak between files.
		const re = new RegExp(IMPORT_RE.source, 'g');
		for (const m of fs.read(file).matchAll(re)) {
			const spec = m[1] ?? m[2] ?? m[3];
			const to = resolveSpec(spec, file, libDir, fs);
			if (to !== null && !seen.has(to)) queue.push(to);
		}
	}
	return seen;
}

/** Recursive file listing as forward-slash paths; [] when the directory does not exist. */
export function walkFiles(dir: string): string[] {
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((d) => d.isFile())
		.map((d) => posix.join(toPosix(d.parentPath), d.name));
}
