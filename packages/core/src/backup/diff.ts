// Dry-run diff for importing a backup. Pure: it only counts and lists the records to write; the
// web layer applies `writes` inside one database transaction (merge = bulkPut, replace = clear
// every registered table, then bulkPut).
//
// Merge rules, compared by id per table:
// - incoming id absent locally            -> add
// - incoming tombstone absent locally     -> skipped (not counted, not written)
// - incoming.updatedAt > local.updatedAt  -> update (strict: local wins ties)
// - everything else local                 -> unchanged
// Invariant: add + update + unchanged === size of the resulting table.
// updatedAt values are ISO-8601 UTC strings, so plain string comparison orders them correctly.
import type { Syncable } from '../syncable.js';

export interface BackupTableRef {
	readonly name: string;
	readonly label: string;
}

export interface MergeRow {
	table: string;
	label: string;
	add: number;
	update: number;
	unchanged: number;
}

export interface ReplaceRow {
	table: string;
	label: string;
	delete: number;
	add: number;
}

export interface MergePlan {
	mode: 'merge';
	perTable: MergeRow[];
	totals: { add: number; update: number; unchanged: number };
	writes: Record<string, Syncable[]>;
	/** True when the import would change nothing (drives the "No differences" state). */
	noChanges: boolean;
}

export interface ReplacePlan {
	mode: 'replace';
	perTable: ReplaceRow[];
	totals: { delete: number; add: number };
	writes: Record<string, Syncable[]>;
}

export function planMerge(
	local: Record<string, Syncable[]>,
	incoming: Record<string, Syncable[]>,
	tables: readonly BackupTableRef[]
): MergePlan {
	const perTable: MergeRow[] = [];
	const writes: Record<string, Syncable[]> = {};
	const totals = { add: 0, update: 0, unchanged: 0 };

	for (const { name, label } of tables) {
		const localRecs = local[name] ?? [];
		const byId = new Map(localRecs.map((r) => [r.id, r]));
		const toWrite: Syncable[] = [];
		let add = 0;
		let update = 0;

		for (const rec of incoming[name] ?? []) {
			const mine = byId.get(rec.id);
			if (!mine) {
				if (rec.deletedAt !== undefined) continue;
				add++;
				toWrite.push(rec);
			} else if (rec.updatedAt > mine.updatedAt) {
				update++;
				toWrite.push(rec);
			}
		}

		const unchanged = localRecs.length - update;
		perTable.push({ table: name, label, add, update, unchanged });
		writes[name] = toWrite;
		totals.add += add;
		totals.update += update;
		totals.unchanged += unchanged;
	}

	return {
		mode: 'merge',
		perTable,
		totals,
		writes,
		noChanges: totals.add + totals.update === 0
	};
}

export function planReplace(
	local: Record<string, Syncable[]>,
	incoming: Record<string, Syncable[]>,
	tables: readonly BackupTableRef[]
): ReplacePlan {
	const perTable: ReplaceRow[] = [];
	const writes: Record<string, Syncable[]> = {};
	const totals = { delete: 0, add: 0 };

	for (const { name, label } of tables) {
		const del = (local[name] ?? []).length;
		// Nothing to tombstone in a freshly cleared table, so incoming tombstones are dropped.
		const live = (incoming[name] ?? []).filter((r) => r.deletedAt === undefined);
		perTable.push({ table: name, label, delete: del, add: live.length });
		writes[name] = live;
		totals.delete += del;
		totals.add += live.length;
	}

	return { mode: 'replace', perTable, totals, writes };
}
