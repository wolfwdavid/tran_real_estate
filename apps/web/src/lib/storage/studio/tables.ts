// Content Studio table names, Dexie stores, row shapes, the snapshot privacy guard and the backup
// registration (Phase 9, STU-01 / STU-04). No Dexie or $lib/storage runtime import (zod/mini and
// pure @tran/core constants only), like the agent, investor and renter tables modules, so
// $lib/storage/db.ts and backup-registry.ts can import it without a cycle.
//
// Every stored row is a Phase 3 Syncable record (uuid id, ownerId 'local', ISO timestamps,
// deletedAt omitted), because the backup envelope validates every exported row that way:
// - studioDraft is keyed by `tool`, and each tool's row carries a FIXED uuid id (STUDIO_DRAFT_IDS),
//   so the same tool's form is the same record in every browser and a backup merge updates it.
// - snapshots are keyed by their uuid id; the repo adds the Syncable stamps around the frozen
//   SnapshotRecord and strips them on read.
import type { Table } from 'dexie';
import * as z from 'zod/mini';
import { SyncableSchema, type Syncable } from '@tran/core';
import { AGGREGATED_SAMPLE_KEYS, BEDROOM_AGGREGATE_KEYS } from '@tran/core/studio';
import type { TranDb } from '$lib/storage/db';
import { STUDIO_TOOLS, type SnapshotRecord, type StudioTool } from './types';

export const STUDIO_DRAFT_TABLE = 'studioDraft';
export const SNAPSHOTS_TABLE = 'snapshots';

/** schemaVersion stamped on every studio Syncable row. */
export const STUDIO_RECORD_SCHEMA_VERSION = 1;

/** Dexie stores for TranDb's version 7 block (one new block, additive only). */
export const STUDIO_STORES = Object.freeze({
	studioDraft: 'tool',
	snapshots: 'id, createdAt, zip'
} as const);

/** The fixed uuid row id of each tool's autosaved form (the same in every browser). */
export const STUDIO_DRAFT_IDS: Readonly<Record<StudioTool, string>> = Object.freeze({
	listing: '00000000-0000-4000-8000-000000057d01',
	social: '00000000-0000-4000-8000-000000057d02',
	reel: '00000000-0000-4000-8000-000000057d03',
	snapshot: '00000000-0000-4000-8000-000000057d04'
});

/** A stored studio form: Syncable stamps + the tool key + the form's plain value. */
export type StudioDraftRow = Syncable & { tool: StudioTool; data: unknown };

/** A stored snapshot: the frozen record plus the Syncable stamps the backup requires. */
export type SnapshotRow = SnapshotRecord &
	Pick<Syncable, 'ownerId' | 'updatedAt' | 'schemaVersion' | 'deletedAt'>;

/** The ONLY top-level keys a SnapshotRecord may carry. */
export const SNAPSHOT_RECORD_KEYS = [
	'id',
	'zip',
	'placeName',
	'createdAt',
	'sample',
	'source',
	'fetchedAt',
	'metrics',
	'series',
	'listingsSample',
	'listingsFetchedAt',
	'narrative',
	'options',
	'agent'
] as const;

const ROW_STAMP_KEYS = ['ownerId', 'updatedAt', 'schemaVersion', 'deletedAt'] as const;

/**
 * Keys that must never appear anywhere in a snapshot: listing identity and contact fields (a
 * snapshot must never advertise another broker's listing), the logo bytes (referenced from the
 * profile instead), and raw response wrappers.
 */
export const FORBIDDEN_SNAPSHOT_KEYS: readonly string[] = Object.freeze([
	'formattedAddress',
	'addressLine1',
	'addressLine2',
	'listingAgent',
	'listingOffice',
	'photos',
	'mlsNumber',
	'logo',
	'raw',
	'response'
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

const isBinary = (v: unknown): boolean =>
	(typeof Blob !== 'undefined' && v instanceof Blob) ||
	v instanceof ArrayBuffer ||
	ArrayBuffer.isView(v);

function extraKeys(v: Record<string, unknown>, allowed: readonly string[]): string[] {
	return Object.keys(v).filter((k) => !allowed.includes(k));
}

function listingsSampleViolations(s: unknown): string[] {
	if (s === null) return [];
	if (!isPlainObject(s)) return ['listingsSample:not-object'];
	const out = extraKeys(s, AGGREGATED_SAMPLE_KEYS).map((k) => `listingsSample.${k}`);
	if (!Array.isArray(s.byBedroom)) return [...out, 'listingsSample.byBedroom:not-array'];
	s.byBedroom.forEach((row: unknown, i: number) => {
		if (!isPlainObject(row)) out.push(`listingsSample.byBedroom.${i}:not-object`);
		else
			for (const k of extraKeys(row, BEDROOM_AGGREGATE_KEYS))
				out.push(`listingsSample.byBedroom.${i}.${k}`);
	});
	return out;
}

/** Deep walk: forbidden keys and binary values anywhere (cycle-safe). */
function deepViolations(v: unknown, path: string, seen: Set<unknown>, out: string[]): void {
	if (isBinary(v)) {
		out.push(`${path || '(root)'}:binary`);
		return;
	}
	if (typeof v !== 'object' || v === null || seen.has(v)) return;
	seen.add(v);
	if (Array.isArray(v)) {
		v.forEach((x, i) => deepViolations(x, `${path}.${i}`, seen, out));
		return;
	}
	for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
		const p = path ? `${path}.${k}` : k;
		if (FORBIDDEN_SNAPSHOT_KEYS.includes(k)) out.push(`${p}:forbidden`);
		deepViolations(x, p, seen, out);
	}
}

/**
 * Every privacy problem with a snapshot record (empty = safe): an unknown top-level key, a
 * listings summary key outside AGGREGATED_SAMPLE_KEYS / BEDROOM_AGGREGATE_KEYS, a forbidden key
 * anywhere, or a binary value anywhere. `stored: true` also allows the row's Syncable stamps.
 */
export function snapshotViolations(record: unknown, o: { stored?: boolean } = {}): string[] {
	if (!isPlainObject(record)) return ['(root):not-object'];
	const allowed: readonly string[] = o.stored
		? [...SNAPSHOT_RECORD_KEYS, ...ROW_STAMP_KEYS]
		: SNAPSHOT_RECORD_KEYS;
	const out = extraKeys(record, allowed).map((k) => `${k}:unknown`);
	out.push(...listingsSampleViolations(record.listingsSample ?? null));
	deepViolations(record, '', new Set(), out);
	return out;
}

/** Backup validator for a studio form row: Syncable, a known tool, and that tool's fixed id. */
export const studioDraftRowSchema = z
	.extend(SyncableSchema, { tool: z.enum(STUDIO_TOOLS) })
	.check(z.refine((r) => r.id === STUDIO_DRAFT_IDS[r.tool]));

/** Backup validator for a snapshot row: Syncable, the core fields, and the privacy guard. */
export const snapshotRowSchema = z
	.extend(SyncableSchema, {
		zip: z.string(),
		sample: z.boolean(),
		source: z.enum(['rentcast', 'sample'])
	})
	.check(z.refine((r) => snapshotViolations(r, { stored: true }).length === 0));

interface RecordValidator {
	safeParse(value: unknown): { success: boolean };
}

/** Studio tables in the backup, appended to the registry's built-in list. */
export const STUDIO_BACKUP_TABLES: readonly {
	readonly name: string;
	readonly label: string;
	readonly schema: RecordValidator;
}[] = Object.freeze([
	Object.freeze({ name: STUDIO_DRAFT_TABLE, label: 'Studio forms', schema: studioDraftRowSchema }),
	Object.freeze({ name: SNAPSHOTS_TABLE, label: 'Market Snapshots', schema: snapshotRowSchema })
]);

export const studioDraftTable = (db: TranDb): Table<StudioDraftRow, StudioTool> => db.studioDraft;
export const snapshotsTable = (db: TranDb): Table<SnapshotRow, string> => db.snapshots;
