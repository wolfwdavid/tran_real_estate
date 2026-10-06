// Transitive boundary proof for Phase 8 (AGT-02/AGT-04, success criterion 5): the agent CRM spends
// zero RentCast calls and the public inquiry page touches no app internals. eslint.config.js bans
// the DIRECT imports; this walks the whole graph so a shared barrel cannot smuggle lib/data in.
// The planted control proves the walker reports a gateway two hops away (no vacuous green).
import { existsSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { importGraph, type GraphFs, walkFiles } from '../tooling/import-graph';

const WEB = resolve(import.meta.dirname, '../apps/web/src').replace(/\\/g, '/');
const LIB = posix.join(WEB, 'lib');
const PUBLIC_ROUTES = posix.join(WEB, 'routes/(public)');
// Phase 9's Market Studio legitimately reads market data through the gateway (CONTEXT amendment).
const STUDIO_ROUTES = posix.join(WEB, 'routes/(app)/agent/studio');

const isSource = (f: string) => /\.(ts|js|svelte)$/.test(f) && !/\.(test|spec)\.[tj]s$/.test(f);
const under = (dir: string) => (f: string) => f.startsWith(`${dir}/`);

const publicEntries = walkFiles(PUBLIC_ROUTES).filter(isSource);
const agentEntries = [
	...walkFiles(posix.join(LIB, 'features/agent')),
	...walkFiles(posix.join(WEB, 'routes/(app)/agent')).filter((f) => !under(STUDIO_ROUTES)(f)),
	...walkFiles(posix.join(LIB, 'leads')),
	...publicEntries
].filter(isSource);

describe('agent and public import-graph boundaries', () => {
	test('agent CRM, lib/leads and the public inquiry page never reach lib/data (transitively)', () => {
		// Non-vacuity: routes/(app)/agent/+page.svelte exists from Phase 2 onwards.
		expect(agentEntries.length).toBeGreaterThan(0);
		const reached = [...importGraph(agentEntries, LIB)].filter(under(posix.join(LIB, 'data')));
		expect(reached).toEqual([]);
	});

	test('the (public) route group either exists with sources or not at all', () => {
		if (publicEntries.length === 0) expect(existsSync(PUBLIC_ROUTES)).toBe(false);
		else expect(publicEntries.length).toBeGreaterThan(0);
	});

	// Plan 08-13 creates routes/(public)/agent/inquire; this test activates automatically then.
	test.skipIf(publicEntries.length === 0)(
		'the (public) route graph never reaches storage, ai, security or features',
		() => {
			const banned = ['storage', 'ai', 'security', 'features', 'data'].map((m) =>
				under(posix.join(LIB, m))
			);
			const reached = [...importGraph(publicEntries, LIB)].filter((f) => banned.some((b) => b(f)));
			expect(reached).toEqual([]);
		}
	);

	test('studio routes are excluded from the agent entries', () => {
		expect(agentEntries.filter((f) => f.includes('routes/(app)/agent/studio'))).toEqual([]);
	});

	test('planted control: a gateway import two hops away is reported', () => {
		const files = new Map<string, string>([
			['/v/lib/features/agent/a.ts', "import { b } from '$lib/features/shared/b';\n"],
			['/v/lib/features/shared/b.ts', "export * from '$lib/data/rentcast/c';\n"],
			['/v/lib/data/rentcast/c.ts', 'export const c = 1;\n'],
			[
				'/v/lib/features/agent/View.svelte',
				"<script lang=\"ts\">\n\timport X from './Y.svelte';\n\tconst lazy = () => import('./lazy.js');\n</script>\n"
			],
			['/v/lib/features/agent/Y.svelte', '<p>y</p>\n'],
			['/v/lib/features/agent/lazy.ts', "import type { T } from '../shared/b';\n"]
		]);
		const memFs: GraphFs = {
			read: (p) => files.get(p) ?? '',
			isFile: (p) => files.has(p)
		};

		const planted = importGraph(['/v/lib/features/agent/a.ts'], '/v/lib', memFs);
		expect(planted.has('/v/lib/data/rentcast/c.ts')).toBe(true);

		const svelte = importGraph(['/v/lib/features/agent/View.svelte'], '/v/lib', memFs);
		expect(svelte.has('/v/lib/features/agent/Y.svelte')).toBe(true);
		expect(svelte.has('/v/lib/features/agent/lazy.ts')).toBe(true);
		// lazy.ts -> shared/b (relative, type-only) -> data: still reported.
		expect(svelte.has('/v/lib/data/rentcast/c.ts')).toBe(true);
	});
});
