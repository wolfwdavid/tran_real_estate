// Saved Market Snapshots (STU-04, 09-UI-SPEC "Your snapshots"). Records are FROZEN: there is no
// update, only add and delete (to change one, the agent builds a new snapshot). Lives under
// $lib/storage (not $lib/data) so the print route reads snapshots without touching the gateway.
//
// addSnapshot runs the aggregate-only privacy guard before writing: a record with an unknown
// top-level key, a listings-summary key outside the whitelists, a listing identity field
// (address, agent, office, photos, MLS number), a `logo` key or any binary value anywhere is
// refused and nothing is written. Browser callers only (onMount / event handlers).
import { SyncableSchema } from '@tran/core';
import { getDb } from '$lib/storage/db';
import {
	STUDIO_RECORD_SCHEMA_VERSION,
	snapshotViolations,
	snapshotsTable,
	type SnapshotRow
} from './tables';
import type { SnapshotRecord } from './types';

/** A snapshot that failed the privacy guard. `violations` lists the offending paths. */
export class SnapshotPrivacyError extends Error {
	readonly violations: readonly string[];
	constructor(violations: readonly string[]) {
		super('snapshot-not-aggregate-only');
		this.name = 'SnapshotPrivacyError';
		this.violations = Object.freeze([...violations]);
	}
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toRecord(row: SnapshotRow): SnapshotRecord {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { ownerId, updatedAt, schemaVersion, deletedAt, ...record } = row;
	return record;
}

/**
 * Stores a frozen snapshot. Throws SnapshotPrivacyError (nothing written) when the guard fails,
 * and Error('snapshot-id-invalid') when the id is not a uuid (the 'sample' record is never stored).
 */
export async function addSnapshot(record: SnapshotRecord): Promise<void> {
	if (typeof record?.id !== 'string' || !UUID_RE.test(record.id)) {
		throw new Error('snapshot-id-invalid');
	}
	const violations = snapshotViolations(record);
	if (violations.length > 0) throw new SnapshotPrivacyError(violations);
	const row: SnapshotRow = {
		...structuredClone(record),
		ownerId: 'local',
		updatedAt: record.createdAt,
		schemaVersion: STUDIO_RECORD_SCHEMA_VERSION
	};
	// The backup validates every exported row as Syncable; refuse a row it would reject later.
	if (!SyncableSchema.safeParse(row).success) throw new Error('snapshot-record-invalid');
	await snapshotsTable(getDb()).add(row);
}

/** The saved snapshot, or null when this browser has none with that id. */
export async function getSnapshot(id: string): Promise<SnapshotRecord | null> {
	const row = await snapshotsTable(getDb()).get(id);
	return row && row.deletedAt === undefined ? toRecord(row) : null;
}

/** Every saved snapshot, newest createdAt first. */
export async function listSnapshots(): Promise<SnapshotRecord[]> {
	const rows = await snapshotsTable(getDb()).orderBy('createdAt').reverse().toArray();
	return rows.filter((r) => r.deletedAt === undefined).map(toRecord);
}

/** Deletes one snapshot (no-op when absent). */
export async function deleteSnapshot(id: string): Promise<void> {
	await snapshotsTable(getDb()).delete(id);
}

/** How many snapshots are saved in this browser. */
export async function countSnapshots(): Promise<number> {
	return snapshotsTable(getDb())
		.filter((r) => r.deletedAt === undefined)
		.count();
}
