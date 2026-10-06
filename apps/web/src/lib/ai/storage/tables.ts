// Phase 5 table names, Dexie stores, backup entries and the stored row shape. Dependency-free
// (type imports only), like $lib/data/tables, so $lib/storage/db.ts and
// $lib/storage/backup-registry.ts can import it without an import cycle.
import type { Syncable } from '@tran/core';
import type { AiProviderId } from '@tran/core/ai';

export const AI_ARTIFACTS_TABLE = 'aiArtifacts';
export const AI_ARTIFACTS_LABEL = 'AI drafts';

/** Phase 5 Dexie stores, added by TranDb's version(3) block. */
export const AI_STORES = {
	aiArtifacts: 'id, feature, [feature+createdAt], status, updatedAt'
} as const;

/** Phase 5 tables in the backup (appended to the registry's built-in list). */
export const AI_BACKUP_TABLES: readonly { readonly name: string; readonly label: string }[] =
	Object.freeze([{ name: AI_ARTIFACTS_TABLE, label: AI_ARTIFACTS_LABEL }]);

export const AI_ARTIFACT_SCHEMA_VERSION = 1;

/** UI labels: Draft / Reviewed / Marked as sent. */
export const ARTIFACT_STATUSES = ['draft', 'acknowledged', 'sent'] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

/** A record of what was flagged at save time. Never trusted on reopen: the text is re-checked. */
export type StoredFinding = { phrase: string; severity: 'block' | 'warn'; entryIds: string[] };

export interface AiArtifact extends Syncable {
	schemaVersion: typeof AI_ARTIFACT_SCHEMA_VERSION;
	feature: string;
	/** e.g. 'shared/demo@1'. */
	promptId: string;
	provider: AiProviderId;
	model: string;
	/** True when the draft came from the keyless sample provider. */
	sample: boolean;
	/** SHA-256 hex of the post-redaction prompt. */
	inputHash: string;
	text: string;
	findings: StoredFinding[];
	status: ArtifactStatus;
	sentAt: string | null;
	/**
	 * Optional opaque id of what the draft is about (Phase 6: the listing id), so Draft history
	 * can be filtered to it. Absent on Phase 5 rows. Never holds prompt inputs. Not indexed:
	 * filtered in memory after the [feature+createdAt] range, so no Dexie version bump.
	 */
	subjectId?: string;
	/**
	 * Optional string metadata (Phase 7: the memo's analysisHash). At most 16 keys, values at most
	 * 200 chars. Absent unless given. Never holds prompt inputs or key material (the backup key
	 * scan still covers it).
	 */
	meta?: Record<string, string>;
}
