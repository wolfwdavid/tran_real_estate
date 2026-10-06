// Stored AI generations ('AI drafts'). Every generation the user keeps is one aiArtifacts row in
// the Phase 3 'tran' Dexie database (version block appended in $lib/storage/db.ts), and the table
// is part of the backup (built into the default list in $lib/storage/backup-registry.ts).
//
// Security rule (05-UI-SPEC): an artifact never holds raw prompt inputs or key material. Only the
// SHA-256 hex of the post-redaction prompt (inputHash) and the draft text are kept. create()
// copies a fixed allow-list of fields, so stray properties on its input never reach storage.
//
// Rows are Phase 3 Syncable records (uuid id, ISO timestamps, schemaVersion). A deleted draft is
// a tombstone (deletedAt set, absent while live), never a hard delete, so deletions survive
// backup merges and a future sync.
import Dexie from 'dexie';
import { newSyncable, tombstone } from '@tran/core';
import type { Finding } from '@tran/core/fair-housing';
import type { TranDb } from '$lib/storage/db';
import { META } from '$lib/storage/meta';
import {
	AI_ARTIFACTS_TABLE,
	AI_ARTIFACT_SCHEMA_VERSION,
	ARTIFACT_STATUSES,
	type AiArtifact,
	type ArtifactStatus,
	type StoredFinding
} from './tables';

export {
	AI_ARTIFACTS_LABEL,
	AI_ARTIFACTS_TABLE,
	AI_ARTIFACT_SCHEMA_VERSION,
	AI_BACKUP_TABLES,
	AI_STORES,
	ARTIFACT_STATUSES,
	type AiArtifact,
	type ArtifactStatus,
	type StoredFinding
} from './tables';

export const DEFAULT_PAGE_SIZE = 10;

export type ArtifactInput = {
	feature: string;
	promptId: string;
	provider: AiArtifact['provider'];
	model: string;
	sample: boolean;
	inputHash: string;
	text: string;
	findings: readonly Finding[];
	/** Opaque id of what the draft is about (e.g. a listing id). Stored only when given. */
	subjectId?: string;
	/** Short string metadata (<= 16 keys, values <= 200 chars). Stored only when given. */
	meta?: Readonly<Record<string, string>>;
};

export interface ArtifactRepo {
	create(i: ArtifactInput): Promise<AiArtifact>;
	updateText(id: string, text: string, findings: readonly Finding[]): Promise<void>;
	/** 'sent' sets sentAt; any other status clears it. */
	setStatus(id: string, status: ArtifactStatus, at: Date): Promise<void>;
	/** Includes tombstones. */
	get(id: string): Promise<AiArtifact | undefined>;
	/** Newest first, tombstones excluded, `limit` defaults to 10. */
	listByFeature(feature: string, o?: { limit?: number; offset?: number }): Promise<AiArtifact[]>;
	countByFeature(feature: string): Promise<number>;
	/** listByFeature narrowed to one subjectId: newest first, tombstones excluded. */
	listBySubject(
		feature: string,
		subjectId: string,
		o?: { limit?: number; offset?: number }
	): Promise<AiArtifact[]>;
	countBySubject(feature: string, subjectId: string): Promise<number>;
	softDelete(id: string, at: Date): Promise<void>;
	/**
	 * Tombstones (softDelete semantics) every live artifact with that subjectId, in any feature,
	 * in one transaction. Returns how many were tombstoned (used by Phase 7 deleteDeal).
	 */
	deleteBySubjectId(subjectId: string, at: Date): Promise<number>;
}

export type ArtifactRepoOptions = { now?: () => Date; uuid?: () => string };

const SHA256_HEX = /^[0-9a-f]{64}$/;
/** A subjectId is a short opaque id (a listing or deal id), never free text from the prompt. */
const SUBJECT_ID_MAX = 200;

function isSubjectId(v: unknown): v is string {
	return typeof v === 'string' && v.length > 0 && v.length <= SUBJECT_ID_MAX;
}

const META_MAX_KEYS = 16;
const META_VALUE_MAX = 200;

function isMeta(v: unknown): v is Record<string, string> {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
	const entries = Object.entries(v);
	return (
		entries.length <= META_MAX_KEYS &&
		entries.every(([, x]) => typeof x === 'string' && x.length <= META_VALUE_MAX)
	);
}

export function toStoredFindings(findings: readonly Finding[]): StoredFinding[] {
	return findings.map((f) => ({
		phrase: f.phrase,
		severity: f.severity,
		entryIds: f.members.map((m) => m.entryId)
	}));
}

const isLive = (a: AiArtifact) => a.deletedAt === undefined;

/**
 * Repository over the aiArtifacts table. `db` defaults to the app singleton, loaded lazily so
 * importing this module never opens IndexedDB.
 */
export function createArtifactRepo(db?: TranDb, o: ArtifactRepoOptions = {}): ArtifactRepo {
	const now = o.now ?? (() => new Date());
	const uuid = o.uuid ?? (() => crypto.randomUUID());
	let resolved: Promise<TranDb> | undefined;
	const getDb = (): Promise<TranDb> =>
		(resolved ??= db
			? Promise.resolve(db)
			: import('$lib/storage/db').then(({ getDb: appDb }) => appDb()));
	const table = async () => (await getDb()).table<AiArtifact, string>(AI_ARTIFACTS_TABLE);

	/** Read-modify-write of one row in a single transaction; a missing id is a no-op. */
	async function update(id: string, fn: (a: AiArtifact) => AiArtifact): Promise<void> {
		const d = await getDb();
		const t = d.table<AiArtifact, string>(AI_ARTIFACTS_TABLE);
		await d.transaction('rw', t, async () => {
			const existing = await t.get(id);
			if (existing) await t.put(fn(existing));
		});
	}

	return {
		async create(i) {
			if (!SHA256_HEX.test(i.inputHash)) throw new Error('artifact-input-hash');
			if (i.subjectId !== undefined && !isSubjectId(i.subjectId)) {
				throw new Error('artifact-subject-id');
			}
			if (i.meta !== undefined && !isMeta(i.meta)) throw new Error('artifact-meta');
			const d = await getDb();
			const t = d.table<AiArtifact, string>(AI_ARTIFACTS_TABLE);
			const at = now();
			// Allow-list copy: only these fields are ever stored.
			const artifact: AiArtifact = {
				...newSyncable({ id: uuid(), now: at, schemaVersion: AI_ARTIFACT_SCHEMA_VERSION }),
				schemaVersion: AI_ARTIFACT_SCHEMA_VERSION,
				feature: i.feature,
				promptId: i.promptId,
				provider: i.provider,
				model: i.model,
				sample: i.sample,
				inputHash: i.inputHash,
				text: i.text,
				findings: toStoredFindings(i.findings),
				status: 'draft',
				sentAt: null,
				...(i.subjectId !== undefined ? { subjectId: i.subjectId } : {}),
				...(i.meta !== undefined ? { meta: { ...i.meta } } : {})
			};
			await d.transaction('rw', [t, d.meta], async () => {
				await t.add(artifact);
				// Same bookkeeping as Phase 3 createRepo: the first user record starts the backup nudge.
				if (!(await d.meta.get(META.firstRecordAt))) {
					await d.meta.put({ key: META.firstRecordAt, value: artifact.createdAt });
				}
			});
			return artifact;
		},

		updateText(id, text, findings) {
			const stored = toStoredFindings(findings);
			return update(id, (a) => ({
				...a,
				text,
				findings: stored,
				updatedAt: now().toISOString()
			}));
		},

		setStatus(id, status, at) {
			if (!ARTIFACT_STATUSES.includes(status)) return Promise.reject(new Error('artifact-status'));
			const stamp = at.toISOString();
			return update(id, (a) => ({
				...a,
				status,
				sentAt: status === 'sent' ? stamp : null,
				updatedAt: stamp
			}));
		},

		async get(id) {
			return (await table()).get(id);
		},

		async listByFeature(feature, opts = {}) {
			const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
			const offset = opts.offset ?? 0;
			return (await table())
				.where('[feature+createdAt]')
				.between([feature, Dexie.minKey], [feature, Dexie.maxKey])
				.reverse()
				.filter(isLive)
				.offset(offset)
				.limit(limit)
				.toArray();
		},

		async countByFeature(feature) {
			return (await table()).where('feature').equals(feature).filter(isLive).count();
		},

		async listBySubject(feature, subjectId, opts = {}) {
			const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
			const offset = opts.offset ?? 0;
			return (await table())
				.where('[feature+createdAt]')
				.between([feature, Dexie.minKey], [feature, Dexie.maxKey])
				.reverse()
				.filter((a) => isLive(a) && a.subjectId === subjectId)
				.offset(offset)
				.limit(limit)
				.toArray();
		},

		async countBySubject(feature, subjectId) {
			return (await table())
				.where('feature')
				.equals(feature)
				.filter((a) => isLive(a) && a.subjectId === subjectId)
				.count();
		},

		softDelete(id, at) {
			return update(id, (a) => tombstone(a, at));
		},

		async deleteBySubjectId(subjectId, at) {
			// subjectId is not indexed (no Dexie version bump): a filter scan over a small
			// per-browser drafts table, inside one rw transaction.
			const d = await getDb();
			const t = d.table<AiArtifact, string>(AI_ARTIFACTS_TABLE);
			return d.transaction('rw', t, () =>
				t
					.filter((a) => isLive(a) && a.subjectId === subjectId)
					.modify((a, ref) => {
						ref.value = tombstone(a, at);
					})
			);
		}
	};
}
