import { describe, expect, test } from 'vitest';

import type { Syncable } from '../syncable.js';
import { planMerge, planReplace, type BackupTableRef, type MergePlan } from './diff.js';

const TABLES: readonly BackupTableRef[] = [
	{ name: 'prefs', label: 'Preferences' },
	{ name: 'searches', label: 'Saved searches' }
];

const T1 = '2026-10-01T12:00:00.000Z';
const T2 = '2026-10-02T12:00:00.000Z';
const T3 = '2026-10-03T12:00:00.000Z';

function id(n: number): string {
	return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function rec(
	n: number,
	updatedAt: string,
	extra: Partial<Syncable> & Record<string, unknown> = {}
) {
	return {
		id: id(n),
		ownerId: 'local' as const,
		createdAt: T1,
		updatedAt,
		schemaVersion: 1,
		...extra
	} satisfies Syncable;
}

/** Applies a merge plan the way the web layer will: bulkPut(writes) over the local tables. */
function applyMerge(
	local: Record<string, Syncable[]>,
	plan: MergePlan
): Record<string, Syncable[]> {
	const out: Record<string, Syncable[]> = {};
	for (const { name } of TABLES) {
		const byId = new Map((local[name] ?? []).map((r) => [r.id, r]));
		for (const w of plan.writes[name] ?? []) byId.set(w.id, w);
		out[name] = [...byId.values()];
	}
	return out;
}

/** add + update + unchanged === size of the resulting table, for every table and the totals. */
function expectInvariant(plan: MergePlan, local: Record<string, Syncable[]>): void {
	const result = applyMerge(local, plan);
	let total = 0;
	for (const row of plan.perTable) {
		const size = result[row.table]?.length ?? 0;
		expect(row.add + row.update + row.unchanged, row.table).toBe(size);
		total += size;
	}
	expect(plan.totals.add + plan.totals.update + plan.totals.unchanged).toBe(total);
	expect(plan.noChanges).toBe(plan.totals.add + plan.totals.update === 0);
}

function row(plan: MergePlan, table = 'prefs') {
	const r = plan.perTable.find((x) => x.table === table);
	if (!r) throw new Error(`no row for ${table}`);
	return r;
}

describe('planMerge', () => {
	test('incoming id absent locally -> add (written)', () => {
		const local = { prefs: [] };
		const plan = planMerge(local, { prefs: [rec(1, T1)] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 1, update: 0, unchanged: 0 });
		expect(plan.writes.prefs).toEqual([rec(1, T1)]);
		expect(plan.noChanges).toBe(false);
		expectInvariant(plan, local);
	});

	test('incoming tombstone with no local record -> skipped entirely', () => {
		const local = { prefs: [] };
		const plan = planMerge(local, { prefs: [rec(1, T2, { deletedAt: T2 })] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 0, update: 0, unchanged: 0 });
		expect(plan.writes.prefs ?? []).toEqual([]);
		expect(plan.noChanges).toBe(true);
		expectInvariant(plan, local);
	});

	test('strictly newer incoming -> update (written)', () => {
		const local = { prefs: [rec(1, T1)] };
		const incoming = rec(1, T2, { value: 'new' });
		const plan = planMerge(local, { prefs: [incoming] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 0, update: 1, unchanged: 0 });
		expect(plan.writes.prefs).toEqual([incoming]);
		expectInvariant(plan, local);
	});

	test('equal updatedAt -> unchanged (local wins ties)', () => {
		const local = { prefs: [rec(1, T2, { value: 'mine' })] };
		const plan = planMerge(local, { prefs: [rec(1, T2, { value: 'theirs' })] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 0, update: 0, unchanged: 1 });
		expect(plan.writes.prefs ?? []).toEqual([]);
		expect(plan.noChanges).toBe(true);
		expectInvariant(plan, local);
	});

	test('older incoming -> unchanged', () => {
		const local = { prefs: [rec(1, T3)] };
		const plan = planMerge(local, { prefs: [rec(1, T1)] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 0, update: 0, unchanged: 1 });
		expectInvariant(plan, local);
	});

	test('local-only record -> unchanged', () => {
		const local = { prefs: [rec(1, T1), rec(2, T1)] };
		const plan = planMerge(local, { prefs: [rec(3, T1)] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 1, update: 0, unchanged: 2 });
		expectInvariant(plan, local);
	});

	test('newer incoming tombstone over a live local record -> update (tombstone written)', () => {
		const local = { prefs: [rec(1, T1)] };
		const dead = rec(1, T2, { deletedAt: T2 });
		const plan = planMerge(local, { prefs: [dead] }, TABLES);
		expect(row(plan)).toMatchObject({ add: 0, update: 1, unchanged: 0 });
		expect(plan.writes.prefs).toEqual([dead]);
		expectInvariant(plan, local);
	});

	test('a registered table missing from incoming behaves as []', () => {
		const local = { prefs: [rec(1, T1)], searches: [rec(2, T1)] };
		const plan = planMerge(local, { prefs: [rec(1, T2)] }, TABLES);
		expect(row(plan, 'searches')).toMatchObject({ add: 0, update: 0, unchanged: 1 });
		expect(plan.writes.searches ?? []).toEqual([]);
		expectInvariant(plan, local);
	});

	test('perTable follows the order and labels of `tables`; totals sum the rows', () => {
		const local = { prefs: [rec(1, T1)], searches: [] };
		const incoming = { searches: [rec(2, T1), rec(3, T1)], prefs: [rec(1, T2)] };
		const plan = planMerge(local, incoming, TABLES);
		expect(plan.mode).toBe('merge');
		expect(plan.perTable.map((r) => [r.table, r.label])).toEqual([
			['prefs', 'Preferences'],
			['searches', 'Saved searches']
		]);
		expect(plan.totals).toEqual({ add: 2, update: 1, unchanged: 0 });
		expectInvariant(plan, local);
	});

	test('re-planning the same incoming against the applied result is a no-op (idempotent)', () => {
		const local = { prefs: [rec(1, T1), rec(2, T3)], searches: [] };
		const incoming = {
			prefs: [rec(1, T2), rec(2, T1), rec(4, T1), rec(5, T2, { deletedAt: T2 })],
			searches: [rec(6, T1)]
		};
		const first = planMerge(local, incoming, TABLES);
		expectInvariant(first, local);
		const applied = applyMerge(local, first);
		const second = planMerge(applied, incoming, TABLES);
		expect(second.totals.add).toBe(0);
		expect(second.totals.update).toBe(0);
		expect(second.noChanges).toBe(true);
		expectInvariant(second, applied);
	});

	test('does not mutate its inputs', () => {
		const local = { prefs: [rec(1, T1)] };
		const incoming = { prefs: [rec(1, T2), rec(2, T1)] };
		const snapshot = JSON.stringify({ local, incoming });
		const plan = planMerge(local, incoming, TABLES);
		expect(JSON.stringify({ local, incoming })).toBe(snapshot);
		expectInvariant(plan, local);
	});
});

describe('planReplace', () => {
	test('delete = local count (tombstones included); add excludes incoming tombstones', () => {
		const local = { prefs: [rec(1, T1), rec(2, T1, { deletedAt: T1 })], searches: [rec(3, T1)] };
		const incoming = {
			prefs: [rec(4, T1), rec(5, T2, { deletedAt: T2 })],
			searches: [rec(6, T1), rec(7, T1)]
		};
		const plan = planReplace(local, incoming, TABLES);
		expect(plan.mode).toBe('replace');
		expect(plan.perTable).toEqual([
			{ table: 'prefs', label: 'Preferences', delete: 2, add: 1 },
			{ table: 'searches', label: 'Saved searches', delete: 1, add: 2 }
		]);
		expect(plan.totals).toEqual({ delete: 3, add: 3 });
		expect(plan.writes.prefs).toEqual([rec(4, T1)]);
		expect(plan.writes.searches).toEqual([rec(6, T1), rec(7, T1)]);
	});

	test('never writes incoming tombstones', () => {
		const plan = planReplace({}, { prefs: [rec(1, T1, { deletedAt: T1 })] }, TABLES);
		expect(plan.writes.prefs ?? []).toEqual([]);
		expect(plan.totals).toEqual({ delete: 0, add: 0 });
	});

	test('a registered table missing on either side behaves as []', () => {
		const plan = planReplace({ searches: [rec(1, T1)] }, { prefs: [rec(2, T1)] }, TABLES);
		expect(plan.perTable).toEqual([
			{ table: 'prefs', label: 'Preferences', delete: 0, add: 1 },
			{ table: 'searches', label: 'Saved searches', delete: 1, add: 0 }
		]);
	});
});
