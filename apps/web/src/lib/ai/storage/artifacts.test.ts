import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupError, SyncableSchema, parseBackup } from '@tran/core';
import type { Finding } from '@tran/core/fair-housing';
import { fakeKey } from '../../../../tests/support/fake-keys';
import { _resetBackupRegistry, listBackupTables } from '$lib/storage/backup-registry';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import { TranDb } from '$lib/storage/db';
import { META, getMeta } from '$lib/storage/meta';
import { freshIdb } from '$lib/storage/test-utils';
import {
	AI_ARTIFACTS_LABEL,
	AI_ARTIFACTS_TABLE,
	AI_STORES,
	createArtifactRepo,
	toStoredFindings,
	type AiArtifact
} from './artifacts';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = 'a'.repeat(64);
const T0 = Date.parse('2026-10-05T12:00:00.000Z');

/** Deterministic clock: each call advances one minute from T0. */
function clock(start = T0) {
	let t = start;
	return () => {
		const d = new Date(t);
		t += 60_000;
		return d;
	};
}

const FINDING: Finding = {
	id: '10-17',
	start: 10,
	end: 17,
	severity: 'block',
	phrase: 'no kids',
	members: [
		{
			entryId: 'familial.no-kids',
			checker: 'fair-housing',
			category: 'familial-status',
			categoryLabel: 'Familial status',
			scope: 'federal',
			severity: 'block',
			explanation: 'Excludes families with children.',
			alternative: 'all households welcome',
			source: 'HUD',
			phrase: 'no kids',
			start: 10,
			end: 17
		},
		{
			entryId: 'familial.adults-only',
			checker: 'fair-housing',
			category: 'familial-status',
			categoryLabel: 'Familial status',
			scope: 'federal',
			severity: 'warn',
			explanation: 'x',
			alternative: '',
			source: 'HUD',
			phrase: 'no kids',
			start: 10,
			end: 17
		}
	]
};

const input = (
	o: Partial<Parameters<ReturnType<typeof createArtifactRepo>['create']>[0]> = {}
) => ({
	feature: 'demo',
	promptId: 'shared/demo@1',
	provider: 'anthropic' as const,
	model: 'claude-sonnet-5-5',
	sample: false,
	inputHash: HASH,
	text: 'A bright, no kids condo.',
	findings: [FINDING],
	...o
});

const ARTIFACT_KEYS = [
	'id',
	'ownerId',
	'createdAt',
	'updatedAt',
	'schemaVersion',
	'feature',
	'promptId',
	'provider',
	'model',
	'sample',
	'inputHash',
	'text',
	'findings',
	'status',
	'sentAt'
].sort();

let db: TranDb;

beforeEach(async () => {
	_resetBackupRegistry();
	db = new TranDb(freshIdb());
	await db.open();
});

afterEach(() => {
	db.close();
	_resetBackupRegistry();
});

describe('aiArtifacts table', () => {
	it('declares the aiArtifacts store with the feature+createdAt index', () => {
		expect(AI_ARTIFACTS_TABLE).toBe('aiArtifacts');
		expect(AI_STORES).toEqual({
			aiArtifacts: 'id, feature, [feature+createdAt], status, updatedAt'
		});
		expect(db.tables.map((t) => t.name)).toContain('aiArtifacts');
	});

	it("is registered for backup as 'AI drafts'", () => {
		expect(AI_ARTIFACTS_LABEL).toBe('AI drafts');
		expect(listBackupTables()).toContainEqual({ name: 'aiArtifacts', label: 'AI drafts' });
	});
});

describe('toStoredFindings', () => {
	it('keeps phrase, severity and the member entry ids only', () => {
		expect(toStoredFindings([FINDING])).toEqual([
			{
				phrase: 'no kids',
				severity: 'block',
				entryIds: ['familial.no-kids', 'familial.adults-only']
			}
		]);
		expect(toStoredFindings([])).toEqual([]);
	});
});

describe('createArtifactRepo', () => {
	it('create() stamps a Syncable draft', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(input());
		expect(a.id).toMatch(V4);
		expect(a.ownerId).toBe('local');
		expect(a.schemaVersion).toBe(1);
		expect(a.status).toBe('draft');
		expect(a.sentAt).toBeNull();
		expect(a.deletedAt).toBeUndefined();
		expect(a.createdAt).toBe(new Date(T0).toISOString());
		expect(a.updatedAt).toBe(a.createdAt);
		expect(a.promptId).toBe('shared/demo@1');
		expect(a.findings).toEqual(toStoredFindings([FINDING]));
		expect(SyncableSchema.safeParse(a).success).toBe(true);
		expect(await repo.get(a.id)).toEqual(a);
		expect(await getMeta(db, META.firstRecordAt)).toBe(a.createdAt);
	});

	it('stores exactly the artifact keys: never inputs, prompts or key material', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const extra = {
			...input(),
			inputs: { client: 'Pat' },
			system: 'sys',
			user: 'raw prompt',
			key: fakeKey('anthropic'),
			apiKey: fakeKey('openai')
		};
		const a = await repo.create(extra);
		const stored = (await db.table(AI_ARTIFACTS_TABLE).get(a.id)) as Record<string, unknown>;
		expect(Object.keys(stored).sort()).toEqual(ARTIFACT_KEYS);
		for (const k of ['inputs', 'system', 'user', 'key', 'apiKey']) {
			expect(stored).not.toHaveProperty(k);
		}
		expect(JSON.stringify(stored)).not.toContain(fakeKey('anthropic'));
	});

	it('rejects an inputHash that is not a SHA-256 hex digest (no raw input can slip in)', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		await expect(repo.create(input({ inputHash: 'Pat Doe, pat@example.com' }))).rejects.toThrow(
			'artifact-input-hash'
		);
		expect(await db.table(AI_ARTIFACTS_TABLE).count()).toBe(0);
	});

	it('listByFeature: newest first, ten per page, other features never appear', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const made: AiArtifact[] = [];
		for (let i = 0; i < 12; i++) made.push(await repo.create(input({ text: `draft ${i}` })));
		await repo.create(input({ feature: 'other', text: 'elsewhere' }));

		const page1 = await repo.listByFeature('demo');
		expect(page1).toHaveLength(10);
		expect(page1.map((a) => a.text)).toEqual(
			made
				.slice(2)
				.reverse()
				.map((a) => a.text)
		);
		const page2 = await repo.listByFeature('demo', { offset: 10 });
		expect(page2.map((a) => a.text)).toEqual(['draft 1', 'draft 0']);
		expect((await repo.listByFeature('demo', { limit: 3 })).map((a) => a.text)).toEqual([
			'draft 11',
			'draft 10',
			'draft 9'
		]);
		expect(await repo.countByFeature('demo')).toBe(12);
		expect(await repo.countByFeature('other')).toBe(1);
		expect((await repo.listByFeature('other')).map((a) => a.text)).toEqual(['elsewhere']);
	});

	it("setStatus('sent') sets sentAt; leaving 'sent' clears it", async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(input());
		const d = new Date('2026-10-05T13:00:00.000Z');
		await repo.setStatus(a.id, 'sent', d);
		const sent = await repo.get(a.id);
		expect(sent?.status).toBe('sent');
		expect(sent?.sentAt).toBe(d.toISOString());
		expect(sent?.updatedAt).toBe(d.toISOString());

		const d2 = new Date('2026-10-05T14:00:00.000Z');
		await repo.setStatus(a.id, 'acknowledged', d2);
		const ack = await repo.get(a.id);
		expect(ack?.status).toBe('acknowledged');
		expect(ack?.sentAt).toBeNull();
		expect(ack?.updatedAt).toBe(d2.toISOString());
		expect(ack?.createdAt).toBe(a.createdAt);
	});

	it('setStatus rejects an unknown status', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(input());
		await expect(
			repo.setStatus(a.id, 'published' as unknown as 'sent', new Date(T0 + 1))
		).rejects.toThrow('artifact-status');
		expect((await repo.get(a.id))?.status).toBe('draft');
	});

	it('updateText changes text and findings and bumps updatedAt', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(input());
		await repo.updateText(a.id, 'A bright condo. All households welcome.', []);
		const b = await repo.get(a.id);
		expect(b?.text).toBe('A bright condo. All households welcome.');
		expect(b?.findings).toEqual([]);
		expect(b?.updatedAt).toBe(new Date(T0 + 60_000).toISOString());
		expect(b?.createdAt).toBe(a.createdAt);
	});

	it('softDelete tombstones: hidden from list and count, still readable with deletedAt', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(input({ text: 'keep' }));
		const b = await repo.create(input({ text: 'drop' }));
		const at = new Date('2026-10-05T15:00:00.000Z');
		await repo.softDelete(b.id, at);
		expect((await repo.listByFeature('demo')).map((x) => x.id)).toEqual([a.id]);
		expect(await repo.countByFeature('demo')).toBe(1);
		const dead = await repo.get(b.id);
		expect(dead?.deletedAt).toBe(at.toISOString());
		expect(dead?.updatedAt).toBe(at.toISOString());
	});

	it('writes to a missing id are no-ops', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const missing = '00000000-0000-4000-8000-000000000999';
		await repo.updateText(missing, 'x', []);
		await repo.setStatus(missing, 'sent', new Date(T0));
		await repo.softDelete(missing, new Date(T0));
		expect(await db.table(AI_ARTIFACTS_TABLE).count()).toBe(0);
	});
});

describe('backup export', () => {
	it('includes the artifact under aiArtifacts and passes the key-free scan', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(input());
		const out = await buildBackupText(db, {
			now: new Date(T0 + 3_600_000),
			knownSecrets: [fakeKey('anthropic')]
		});
		const env = JSON.parse(out.text) as { tables: Record<string, unknown[]> };
		expect(env.tables.aiArtifacts).toEqual([a]);
		expect(out.counts.aiArtifacts).toBe(1);
		const parsed = parseBackup(out.text, {
			registeredTables: listBackupTables().map((t) => t.name)
		});
		expect(parsed.envelope.tables.aiArtifacts).toHaveLength(1);
	});

	it('a key pasted into a draft blocks the export (key-material)', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		await repo.create(input({ text: `use ${fakeKey('openai')} here` }));
		const err = await buildBackupText(db, { now: new Date(T0), knownSecrets: [] }).catch(
			(e: unknown) => e
		);
		expect(err).toBeInstanceOf(BackupError);
		expect((err as BackupError).code).toBe('key-material');
	});
});

describe('subjectId (Phase 6: per-listing draft history)', () => {
	const outreach = (o: Parameters<typeof input>[0] = {}) =>
		input({ feature: 'renter-outreach', promptId: 'renter/outreach.v1@1', text: 'Hello', ...o });

	it('listBySubject returns only that subject, newest first; countBySubject matches', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(outreach({ subjectId: 'L1', text: 'first L1' }));
		await repo.create(outreach({ subjectId: 'L2', text: 'only L2' }));
		const c = await repo.create(outreach({ subjectId: 'L1', text: 'second L1' }));
		await repo.create(input({ subjectId: 'L1', text: 'demo feature, same subject' }));

		const l1 = await repo.listBySubject('renter-outreach', 'L1');
		expect(l1.map((x) => x.id)).toEqual([c.id, a.id]);
		expect(l1.every((x) => x.subjectId === 'L1')).toBe(true);
		expect((await repo.listBySubject('renter-outreach', 'L2')).map((x) => x.text)).toEqual([
			'only L2'
		]);
		expect(await repo.listBySubject('renter-outreach', 'L3')).toEqual([]);
		expect(await repo.countBySubject('renter-outreach', 'L1')).toBe(2);
		expect(await repo.countBySubject('renter-outreach', 'L2')).toBe(1);
	});

	it("a draft saved for 'L1' never appears for subjectId: 'L2'", async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		await repo.create(outreach({ subjectId: 'L1' }));
		expect(await repo.listBySubject('renter-outreach', 'L2')).toEqual([]);
		expect(await repo.countBySubject('renter-outreach', 'L2')).toBe(0);
	});

	it('listBySubject pages ten at a time and skips tombstones', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const made: AiArtifact[] = [];
		for (let i = 0; i < 12; i++) {
			made.push(await repo.create(outreach({ subjectId: 'L1', text: `d${i}` })));
			await repo.create(outreach({ subjectId: 'L2', text: `other ${i}` }));
		}
		await repo.softDelete(made[11]!.id, new Date(T0 + 86_400_000));
		const page1 = await repo.listBySubject('renter-outreach', 'L1');
		expect(page1.map((x) => x.text)).toEqual(
			made
				.slice(1, 11)
				.reverse()
				.map((x) => x.text)
		);
		const page2 = await repo.listBySubject('renter-outreach', 'L1', { offset: 10 });
		expect(page2.map((x) => x.text)).toEqual(['d0']);
		expect(await repo.countBySubject('renter-outreach', 'L1')).toBe(11);
	});

	it('listByFeature still returns every draft of the feature (Phase 5 behavior unchanged)', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		await repo.create(outreach({ subjectId: 'L1' }));
		await repo.create(outreach({ subjectId: 'L2' }));
		await repo.create(outreach());
		expect(await repo.listByFeature('renter-outreach')).toHaveLength(3);
		expect(await repo.countByFeature('renter-outreach')).toBe(3);
	});

	it('stores subjectId only when given; without it the stored keys are unchanged', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const withSubject = await repo.create(outreach({ subjectId: 'L1' }));
		const stored = (await db.table(AI_ARTIFACTS_TABLE).get(withSubject.id)) as Record<
			string,
			unknown
		>;
		expect(Object.keys(stored).sort()).toEqual([...ARTIFACT_KEYS, 'subjectId'].sort());
		expect(stored.subjectId).toBe('L1');

		const without = await repo.create(outreach());
		const bare = (await db.table(AI_ARTIFACTS_TABLE).get(without.id)) as Record<string, unknown>;
		expect(Object.keys(bare).sort()).toEqual(ARTIFACT_KEYS);
		expect(bare).not.toHaveProperty('subjectId');
		const undef = await repo.create(outreach({ subjectId: undefined }));
		expect(await db.table(AI_ARTIFACTS_TABLE).get(undef.id)).not.toHaveProperty('subjectId');
	});

	it('rejects a subjectId that is not a short opaque id (never inputs)', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		for (const bad of ['', 'x'.repeat(201), 42 as unknown as string]) {
			await expect(repo.create(outreach({ subjectId: bad }))).rejects.toThrow(
				'artifact-subject-id'
			);
		}
		expect(await db.table(AI_ARTIFACTS_TABLE).count()).toBe(0);
	});

	it('backup export then import keeps subjectId; a row without it still imports', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const tagged = await repo.create(outreach({ subjectId: 'L1' }));
		const plain = await repo.create(input());
		const out = await buildBackupText(db, { now: new Date(T0 + 3_600_000), knownSecrets: [] });

		const target = new TranDb(freshIdb());
		await target.open();
		try {
			const file = { name: 'backup.json', size: out.text.length, text: async () => out.text };
			const preview = await previewImport(target, file);
			await applyImport(target, preview, 'replace');
			const restored = createArtifactRepo(target);
			expect((await restored.get(tagged.id))?.subjectId).toBe('L1');
			expect(await restored.get(plain.id)).toEqual(plain);
			expect((await restored.listBySubject('renter-outreach', 'L1')).map((a) => a.id)).toEqual([
				tagged.id
			]);
		} finally {
			target.close();
		}
	});
});

describe('meta + deleteBySubjectId (Phase 7: deal-scoped memos)', () => {
	const memo = (o: Parameters<typeof input>[0] = {}) =>
		input({ feature: 'investor-memo', promptId: 'investor/memo.v1@1', text: 'Memo', ...o });

	it('stores subjectId and meta; both read back', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(memo({ subjectId: 'deal-1', meta: { analysisHash: 'abc12345' } }));
		const got = await repo.get(a.id);
		expect(got?.subjectId).toBe('deal-1');
		expect(got?.meta).toEqual({ analysisHash: 'abc12345' });
		const stored = (await db.table(AI_ARTIFACTS_TABLE).get(a.id)) as Record<string, unknown>;
		expect(Object.keys(stored).sort()).toEqual([...ARTIFACT_KEYS, 'meta', 'subjectId'].sort());
	});

	it('without meta the stored keys are unchanged; meta is copied, not aliased', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const bare = await repo.create(memo({ meta: undefined }));
		expect(await db.table(AI_ARTIFACTS_TABLE).get(bare.id)).not.toHaveProperty('meta');
		const m: Record<string, string> = { k: 'v' };
		const a = await repo.create(memo({ meta: m }));
		m.k = 'changed';
		expect((await repo.get(a.id))?.meta).toEqual({ k: 'v' });
	});

	it('rejects meta with more than 16 keys, a value over 200 chars, or a non-string value', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, 'v']));
		const sixteen = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`k${i}`, 'v']));
		for (const bad of [
			many,
			{ k: 'x'.repeat(201) },
			{ k: 1 as unknown as string },
			['a'] as unknown as Record<string, string>
		]) {
			await expect(repo.create(memo({ meta: bad }))).rejects.toThrow('artifact-meta');
		}
		expect(await db.table(AI_ARTIFACTS_TABLE).count()).toBe(0);
		await repo.create(memo({ meta: sixteen }));
		await repo.create(memo({ meta: { k: 'x'.repeat(200) } }));
		expect(await db.table(AI_ARTIFACTS_TABLE).count()).toBe(2);
	});

	it('updateMeta merges into stored meta, validates, and ignores a missing id (Phase 9)', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const a = await repo.create(memo({ meta: { analysisHash: 'abc' } }));
		await repo.updateMeta!(a.id, { copied: 'instagram' });
		await repo.updateMeta!(a.id, { copied: 'instagram,linkedin' });
		const got = await repo.get(a.id);
		expect(got?.meta).toEqual({ analysisHash: 'abc', copied: 'instagram,linkedin' });
		expect(got?.updatedAt).not.toBe(a.updatedAt);
		expect(got?.text).toBe(a.text);
		const bare = await repo.create(memo({ meta: undefined }));
		await repo.updateMeta!(bare.id, { copied: 'facebook' });
		expect((await repo.get(bare.id))?.meta).toEqual({ copied: 'facebook' });
		await expect(repo.updateMeta!(a.id, { k: 'x'.repeat(201) })).rejects.toThrow('artifact-meta');
		const full = await repo.create(
			memo({ meta: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`k${i}`, 'v'])) })
		);
		await expect(repo.updateMeta!(full.id, { extra: 'v' })).rejects.toThrow('artifact-meta');
		expect(Object.keys((await repo.get(full.id))?.meta ?? {})).toHaveLength(16);
		await expect(repo.updateMeta!('missing', { copied: 'facebook' })).resolves.toBeUndefined();
	});

	it('backup export then import keeps meta; an older row without it still imports', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const tagged = await repo.create(memo({ subjectId: 'deal-1', meta: { analysisHash: 'abc' } }));
		const plain = await repo.create(input());
		const out = await buildBackupText(db, { now: new Date(T0 + 3_600_000), knownSecrets: [] });
		const target = new TranDb(freshIdb());
		await target.open();
		try {
			const file = { name: 'backup.json', size: out.text.length, text: async () => out.text };
			await applyImport(target, await previewImport(target, file), 'replace');
			const restored = createArtifactRepo(target);
			expect(await restored.get(tagged.id)).toEqual(tagged);
			expect(await restored.get(plain.id)).toEqual(plain);
		} finally {
			target.close();
		}
	});

	it('deleteBySubjectId tombstones every live artifact of that subject across features', async () => {
		const repo = createArtifactRepo(db, { now: clock() });
		const m1 = await repo.create(memo({ subjectId: 'deal-1' }));
		const m2 = await repo.create(memo({ subjectId: 'deal-1' }));
		const other = await repo.create(input({ subjectId: 'deal-1' }));
		const d2 = await repo.create(memo({ subjectId: 'deal-2' }));
		const none = await repo.create(memo());
		const earlier = new Date(T0 + 1_000);
		await repo.softDelete(m2.id, earlier);

		const at = new Date(T0 + 86_400_000);
		expect(await repo.deleteBySubjectId('deal-1', at)).toBe(2);
		for (const id of [m1.id, other.id]) {
			const dead = await repo.get(id);
			expect(dead?.deletedAt).toBe(at.toISOString());
			expect(dead?.updatedAt).toBe(at.toISOString());
		}
		// An earlier tombstone keeps its own timestamp.
		expect((await repo.get(m2.id))?.deletedAt).toBe(earlier.toISOString());
		// Other subjects and subject-less drafts are untouched.
		expect(await repo.get(d2.id)).toEqual(d2);
		expect(await repo.get(none.id)).toEqual(none);
		expect(await repo.listBySubject('investor-memo', 'deal-1')).toEqual([]);
		expect(await repo.countBySubject('investor-memo', 'deal-2')).toBe(1);
		expect(await repo.deleteBySubjectId('deal-1', at)).toBe(0);
	});
});
