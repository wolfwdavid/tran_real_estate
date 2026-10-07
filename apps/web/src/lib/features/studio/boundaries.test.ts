// Content Studio import-graph boundaries (09-UI-SPEC Planner Notes 1 and 4; STU-04). ESLint only
// sees direct imports; this walks the whole transitive graph with the Phase 8 walker
// (tooling/import-graph.ts), so a shared barrel cannot smuggle a forbidden module in.
//
// (a) features/studio never reaches the investor portal, the agent CRM or lib/leads: the Studio
//     reads the agent through features/shared/agent-profile only.
// (b) The Market Snapshot printout spends 0 calls: its graph never reaches lib/data. The single
//     exemption is the Phase 4 store-schema leaf lib/data/tables.ts, which lib/storage/db.ts needs
//     to open the shared database (scripts/agent-boundary.test.ts proves it imports nothing and
//     has no network access).
// Both walks see the shared schema registries: lib/storage/db.ts opens ONE Dexie database for every
// portal and lib/storage/backup-registry.ts lists every backed-up table, so they import each
// portal's store-schema module (for the investor portal, features/investor/deals/tables.ts and its
// zod record schemas). Those two modules are reachable only through the registries: the tests walk
// once with the registries treated as opaque (the studio's own imports must reach no forbidden
// folder) and once in full (anything forbidden must be exactly those schema modules).
// (c) Planted controls prove the walker reports what these tests forbid (no vacuous green).
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import {
	importGraph,
	nodeFs,
	walkFiles,
	type GraphFs
} from '../../../../../../tooling/import-graph';

const toPosix = (p: string) => p.replace(/\\/g, '/');
const WEB = toPosix(resolve(import.meta.dirname, '../../../..'));
const LIB = posix.join(WEB, 'src/lib');
const STUDIO = posix.join(LIB, 'features/studio');
const PRINT_ROUTE = posix.join(WEB, 'src/routes/(print)/print/snapshot/+page.svelte');
const DATA_TABLES = posix.join(LIB, 'data/tables.ts');
const DB = posix.join(LIB, 'storage/db.ts');
const REGISTRIES = [DB, posix.join(LIB, 'storage/backup-registry.ts')];
/** The investor store schemas the shared registries import (reachable only through them). */
const DB_SCHEMAS = [
	posix.join(LIB, 'features/investor/deals/schema.ts'),
	posix.join(LIB, 'features/investor/deals/tables.ts')
];
/** The real tree with the registries read as empty, so a walk stops at them. */
const opaqueDb: GraphFs = {
	read: (p) => (REGISTRIES.includes(p) ? '' : nodeFs.read(p)),
	isFile: nodeFs.isFile
};

const isSource = (f: string) => /\.(ts|js|svelte)$/.test(f) && !/\.(test|spec)\.[tj]s$/.test(f);
const under = (dir: string) => (f: string) => f.startsWith(`${dir}/`);

const FORBIDDEN_FOR_STUDIO = ['features/investor', 'features/agent/crm', 'leads'].map((d) =>
	under(posix.join(LIB, d))
);

const studioEntries = walkFiles(STUDIO).filter(isSource);

const reachesData = (entries: string[], lib: string) =>
	[...importGraph(entries, lib)].filter(
		(f) => under(posix.join(lib, 'data'))(f) && f !== posix.join(lib, 'data/tables.ts')
	);

describe('Content Studio import-graph boundaries', () => {
	test('features/studio never reaches features/investor, features/agent/crm or lib/leads', () => {
		// Non-vacuity: the studio folder holds sources from 09-12 on, including the snapshot print.
		expect(studioEntries.length).toBeGreaterThan(0);
		expect(studioEntries).toContain(posix.join(STUDIO, 'snapshot/SnapshotReport.svelte'));
		const forbidden = (g: Set<string>) =>
			[...g].filter((f) => FORBIDDEN_FOR_STUDIO.some((bad) => bad(f))).sort();
		// The studio's own imports, with the shared schema registry opaque: nothing forbidden.
		const own = importGraph(studioEntries, LIB, opaqueDb);
		expect(own.has(DB)).toBe(true);
		expect(forbidden(own)).toEqual([]);
		// The full walk: the only forbidden modules are the store schemas the registries import.
		const full = forbidden(importGraph(studioEntries, LIB));
		expect(
			full.every((f) => DB_SCHEMAS.includes(f)),
			full.join(', ')
		).toBe(true);
		expect(forbidden(importGraph(REGISTRIES, LIB))).toEqual([...DB_SCHEMAS].sort());
	});

	test('the snapshot print route never reaches lib/data (only the store-schema leaf)', () => {
		const graph = importGraph([PRINT_ROUTE], LIB);
		// Non-vacuity: the walk follows the route into the report and the saved-snapshot repo.
		expect(graph.has(posix.join(STUDIO, 'snapshot/SnapshotReport.svelte'))).toBe(true);
		expect(graph.has(posix.join(LIB, 'storage/studio/snapshots-repo.ts'))).toBe(true);
		expect(reachesData([PRINT_ROUTE], LIB)).toEqual([]);
		// The exemption is exactly the leaf, never the gateway.
		expect([...graph].filter(under(posix.join(LIB, 'data')))).toEqual(
			graph.has(DATA_TABLES) ? [DATA_TABLES] : []
		);
	});

	test('the snapshot print route never reaches the investor portal or the agent CRM (beyond the shared schemas)', () => {
		const reached = [...importGraph([PRINT_ROUTE], LIB, opaqueDb)].filter((f) =>
			FORBIDDEN_FOR_STUDIO.some((bad) => bad(f))
		);
		expect(reached).toEqual([]);
	});
});

describe('planted controls (real files under os.tmpdir())', () => {
	const root = toPosix(mkdtempSync(join(tmpdir(), 'studio-boundary-')));
	const lib = posix.join(root, 'lib');
	const write = (rel: string, body: string) => {
		const file = posix.join(lib, rel);
		mkdirSync(posix.dirname(file), { recursive: true });
		writeFileSync(file, body);
		return file;
	};
	afterAll(() => rmSync(root, { recursive: true, force: true }));

	test('a studio entry importing $lib/data/x is reported', () => {
		write('data/x.ts', 'export const x = 1;\n');
		write('data/tables.ts', 'export const t = 1;\n');
		const entry = write(
			'features/studio/planted/Planted.svelte',
			"<script lang=\"ts\">\n\timport { x } from '$lib/data/x';\n\timport { t } from '$lib/data/tables';\n</script>\n"
		);
		expect(reachesData([entry], lib)).toEqual([posix.join(lib, 'data/x.ts')]);
	});

	test('a studio entry reaching the agent CRM, the investor portal or lib/leads via a barrel is reported', () => {
		write('features/agent/crm/contacts.ts', 'export const c = 1;\n');
		write('features/investor/deals/deal.ts', 'export const d = 1;\n');
		write('leads/normalize.ts', 'export const n = 1;\n');
		write(
			'features/shared/barrel.ts',
			"export * from '$lib/features/agent/crm/contacts';\nexport { d } from '../investor/deals/deal';\nexport const lazy = () => import('$lib/leads/normalize');\n"
		);
		const entry = write(
			'features/studio/planted/entry.ts',
			"import { c } from '$lib/features/shared/barrel';\n"
		);
		const reached = [...importGraph([entry], lib)].filter((f) =>
			['features/investor', 'features/agent/crm', 'leads'].some((d) => under(posix.join(lib, d))(f))
		);
		expect(reached.sort()).toEqual(
			[
				posix.join(lib, 'features/agent/crm/contacts.ts'),
				posix.join(lib, 'features/investor/deals/deal.ts'),
				posix.join(lib, 'leads/normalize.ts')
			].sort()
		);
	});
});
