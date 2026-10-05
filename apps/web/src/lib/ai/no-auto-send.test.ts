// AI-04 "no AI output is ever sent automatically", layers 2 and 3 of RESEARCH Pattern 10.
// Layer 2 walks the real import graph of every lib/ai module with the TypeScript preprocessor and
// proves no path reaches lib/leads or a web3forms module. Planted in-memory graphs prove the walker
// can fail, so a green result is not vacuous. Layer 3 asserts the exits have one implementation.
// This file contains the banned words as assertion strings, which is why test files are excluded
// from the text scan below.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { collectImportGraph, scriptOf, type GraphIo } from './import-graph';

const posix = (p: string) => p.split(sep).join('/');

const memoryIo = (files: Record<string, string>): GraphIo => ({
	read: (p) => files[p],
	exists: (p) => p in files
});

const V = { webSrc: '/v/web', coreSrc: '/v/core/src' };

describe('collectImportGraph (planted graphs, injected io)', () => {
	test('follows a dynamic import through a second file into lib/leads', () => {
		const io = memoryIo({
			'/v/web/lib/ai/a.ts': "import { b } from './b';\nexport const a = b;\n",
			'/v/web/lib/ai/b.ts': "export const b = () => import('$lib/leads/web3forms');\n",
			'/v/web/lib/leads/web3forms.ts': 'export const send = () => 1;\n'
		});
		const g = collectImportGraph(['/v/web/lib/ai/a.ts'], { io, ...V });
		expect(g.visited).toContain('/v/web/lib/ai/b.ts');
		expect(g.visited).toContain('/v/web/lib/leads/web3forms.ts');
		expect(g.visited.some((p) => p.includes('/lib/leads/'))).toBe(true);
	});

	test('scans both the module and instance <script> blocks of a .svelte file', () => {
		const io = memoryIo({
			'/v/web/lib/ai/ui/P.svelte': `<script module lang="ts">
	import { m } from './m';
</script>
<script lang="ts">
	import X from '../../leads/x.svelte';
</script>
<X />{m}
`,
			'/v/web/lib/ai/ui/m.ts': 'export const m = 1;\n',
			'/v/web/lib/leads/x.svelte': '<p>x</p>\n'
		});
		const g = collectImportGraph(['/v/web/lib/ai/ui/P.svelte'], { io, ...V });
		expect(g.visited).toContain('/v/web/lib/ai/ui/m.ts');
		expect(g.visited).toContain('/v/web/lib/leads/x.svelte');
	});

	test('scriptOf returns only script contents for .svelte and the source otherwise', () => {
		const svelte = '<script>import a from "a";</script><p>import b from "b"</p>';
		expect(scriptOf('/x/C.svelte', svelte)).toBe('import a from "a";');
		expect(scriptOf('/x/c.ts', 'const x = 1;')).toBe('const x = 1;');
	});

	test('type-only imports are followed (the boundary is module coupling)', () => {
		const io = memoryIo({
			'/v/web/lib/ai/t.ts': "import type { T } from '$lib/leads/types';\nexport type U = T;\n",
			'/v/web/lib/leads/types.ts': 'export type T = string;\n'
		});
		const g = collectImportGraph(['/v/web/lib/ai/t.ts'], { io, ...V });
		expect(g.visited).toContain('/v/web/lib/leads/types.ts');
	});

	test('bare specifiers are external; @tran/core subpaths resolve to their index and are walked', () => {
		const io = memoryIo({
			'/v/web/lib/ai/e.ts':
				"import { mount } from 'svelte';\nimport 'bits-ui';\nimport { x } from '@tran/core/ai';\nimport { y } from '@tran/core';\nexport const e = [mount, x, y];\n",
			'/v/core/src/ai/index.ts': "export { z as x } from './z';\n",
			'/v/core/src/ai/z.ts': 'export const z = 1;\n',
			'/v/core/src/index.ts': 'export const y = 2;\n'
		});
		const g = collectImportGraph(['/v/web/lib/ai/e.ts'], { io, ...V });
		expect(g.external.sort()).toEqual(['bits-ui', 'svelte']);
		expect(g.visited).toEqual(
			expect.arrayContaining(['/v/core/src/ai/index.ts', '/v/core/src/ai/z.ts', '/v/core/src/index.ts'])
		);
	});

	test('resolution order: exact, .ts, .svelte.ts, .svelte, .js→.ts, /index.ts; misses record to:null', () => {
		const io = memoryIo({
			'/v/web/lib/ai/r.ts': [
				"import './exact.txt';",
				"import './plain';",
				"import './state.svelte';",
				"import './Comp';",
				"import './swapped.js';",
				"import './dir';",
				"import './missing';"
			].join('\n'),
			'/v/web/lib/ai/exact.txt': '',
			'/v/web/lib/ai/plain.ts': '',
			'/v/web/lib/ai/state.svelte.ts': '',
			'/v/web/lib/ai/Comp.svelte': '',
			'/v/web/lib/ai/swapped.ts': '',
			'/v/web/lib/ai/dir/index.ts': ''
		});
		const g = collectImportGraph(['/v/web/lib/ai/r.ts'], { io, ...V });
		const to = Object.fromEntries(g.edges.map((e) => [e.spec, e.to]));
		expect(to).toEqual({
			'./exact.txt': '/v/web/lib/ai/exact.txt',
			'./plain': '/v/web/lib/ai/plain.ts',
			'./state.svelte': '/v/web/lib/ai/state.svelte.ts',
			'./Comp': '/v/web/lib/ai/Comp.svelte',
			'./swapped.js': '/v/web/lib/ai/swapped.ts',
			'./dir': '/v/web/lib/ai/dir/index.ts',
			'./missing': null
		});
	});
});

// ---- The real tree -------------------------------------------------------------------------------

const aiDir = import.meta.dirname;
const webSrc = resolve(aiDir, '../..');
const coreSrc = resolve(aiDir, '../../../../../packages/core/src');
const fsIo: GraphIo = {
	read: (p) => (existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : undefined),
	exists: (p) => existsSync(p) && statSync(p).isFile()
};

const EXCLUDED = new Set(['import-graph.ts', 'providers/fake-sse.ts']);
const isTest = (rel: string) => /\.test\.ts$/.test(rel);
// Every production module under lib/ai, relative POSIX path. New files are picked up automatically.
const aiFiles = (readdirSync(aiDir, { recursive: true }) as string[])
	.map(posix)
	.filter((rel) => /\.(ts|svelte)$/.test(rel) && !isTest(rel) && !EXCLUDED.has(rel))
	.sort();
const abs = (rel: string) => posix(resolve(aiDir, rel));
const textOf = (rel: string) => readFileSync(resolve(aiDir, rel), 'utf8');

describe('no auto-send: the real lib/ai import graph', () => {
	const graph = collectImportGraph(aiFiles.map(abs), {
		io: fsIo,
		webSrc: posix(webSrc),
		coreSrc: posix(coreSrc)
	});

	test('non-vacuity: the walker covered the tree', () => {
		expect(aiFiles.length).toBeGreaterThanOrEqual(15);
		expect(graph.visited.length).toBeGreaterThanOrEqual(15);
		expect(graph.visited.some((p) => p.endsWith('/lib/ai/exits.ts'))).toBe(true);
		expect(graph.visited.some((p) => p.endsWith('/lib/ai/runner.ts'))).toBe(true);
	});

	test('no reachable module lives under /lib/leads/', () => {
		expect(graph.visited.filter((p) => p.includes('/lib/leads/'))).toEqual([]);
	});

	test('no external or resolved specifier mentions web3forms', () => {
		expect(graph.external.filter((s) => /web3forms/i.test(s))).toEqual([]);
		expect(graph.edges.filter((e) => /web3forms/i.test(e.spec))).toEqual([]);
	});

	test('zero unresolved relative or $lib specifiers (a typo cannot hide a file)', () => {
		const unresolved = graph.edges.filter(
			(e) => e.to === null && (e.spec.startsWith('.') || e.spec.startsWith('$lib/'))
		);
		expect(unresolved).toEqual([]);
	});

	test('no production module imports the test-only providers/fake-sse helper', () => {
		expect(graph.visited.filter((p) => p.endsWith('/lib/ai/providers/fake-sse.ts'))).toEqual([]);
		expect(aiFiles.filter((rel) => /fake-sse/.test(textOf(rel)))).toEqual([]);
	});
});

const BANNED_TEXT = [
	'web3forms',
	'sendBeacon',
	'XMLHttpRequest',
	'WebSocket',
	'EventSource',
	'location.href',
	'location.assign(',
	'location.replace(',
	'window.open(',
	"localStorage.setItem('tran.ai.gemini"
];

describe('no auto-send: text bans and the single exit implementation', () => {
	test.each(BANNED_TEXT)('no production lib/ai file contains %s', (needle) => {
		expect(aiFiles.filter((rel) => textOf(rel).includes(needle))).toEqual([]);
	});

	test.each(['navigator.clipboard', 'mailto:'])(
		'%s appears in exactly one lib/ai production file: exits.ts',
		(needle) => {
			expect(aiFiles.filter((rel) => textOf(rel).includes(needle))).toEqual(['exits.ts']);
		}
	);
});
