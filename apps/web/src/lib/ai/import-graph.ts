// Test support for the AI-04 no-auto-send guarantee. Lives under lib/ai so the walker can import it;
// excluded from its own walk. Pure: all file access goes through the injected GraphIo, and every
// path is a POSIX string, so planted in-memory graphs and the real tree use the same code.
//
// Import extraction is the TypeScript preprocessor (ts.preProcessFile), not a hand-rolled regex:
// it reports static imports, `export … from`, `import type`, side-effect imports and dynamic
// import() calls with string-literal specifiers.
import ts from 'typescript';
import { posix } from 'node:path';

export type GraphIo = { read(path: string): string | undefined; exists(path: string): boolean };
export type GraphEdge = { from: string; spec: string; to: string | null };
export type GraphResult = { visited: string[]; external: string[]; edges: GraphEdge[] };

const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
const PARSEABLE = /\.(ts|js|mjs|svelte)$/;

/** For a .svelte file, the concatenated contents of every <script> block (module and instance). */
export function scriptOf(path: string, source: string): string {
	if (!path.endsWith('.svelte')) return source;
	return [...source.matchAll(SCRIPT_BLOCK)].map((m) => m[1]).join('\n');
}

/** Candidate files for a resolved base path, in the documented resolution order. */
function candidates(base: string): string[] {
	const list = [base, `${base}.ts`, `${base}.svelte.ts`, `${base}.svelte`];
	if (base.endsWith('.js')) list.push(`${base.slice(0, -3)}.ts`);
	list.push(`${base}/index.ts`);
	return list;
}

/** Maps a specifier to an absolute base path, or null when it is a bare (external) package. */
function baseFor(
	from: string,
	spec: string,
	o: { webSrc: string; coreSrc: string }
): string | null {
	if (spec === '$lib' || spec.startsWith('$lib/')) return `${o.webSrc}/lib${spec.slice(4)}`;
	if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
		// join, not resolve: resolve would prefix the process cwd to a Windows "C:/…" path.
		return posix.join(posix.dirname(from), spec);
	}
	if (spec === '@tran/core') return `${o.coreSrc}/index.ts`;
	if (spec.startsWith('@tran/core/'))
		return `${o.coreSrc}/${spec.slice('@tran/core/'.length)}/index.ts`;
	return null;
}

/**
 * Breadth-first walk of the import graph from `entries`. Every reachable local module lands in
 * `visited`; bare package specifiers land in `external`; every edge is recorded, with `to: null`
 * when a local specifier resolves to no file (callers assert there are none).
 */
export function collectImportGraph(
	entries: string[],
	o: { io: GraphIo; webSrc: string; coreSrc: string }
): GraphResult {
	const visited = new Set<string>();
	const external = new Set<string>();
	const edges: GraphEdge[] = [];
	const queue = [...entries];

	while (queue.length > 0) {
		const file = queue.shift() as string;
		if (visited.has(file)) continue;
		visited.add(file);
		if (!PARSEABLE.test(file)) continue;
		const source = o.io.read(file);
		if (source === undefined) continue;

		const { importedFiles } = ts.preProcessFile(scriptOf(file, source), true, true);
		for (const { fileName: spec } of importedFiles) {
			const base = baseFor(file, spec, o);
			if (base === null) {
				external.add(spec);
				continue;
			}
			const to = candidates(base).find((c) => o.io.exists(c)) ?? null;
			edges.push({ from: file, spec, to });
			if (to !== null && !visited.has(to)) queue.push(to);
		}
	}

	return { visited: [...visited], external: [...external].sort(), edges };
}
