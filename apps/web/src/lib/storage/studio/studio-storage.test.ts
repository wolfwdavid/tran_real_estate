// Studio storage (09-11): the version 7 block, studio form drafts per tool, frozen snapshots with
// the aggregate-only privacy guard, and the backup registration ('Studio forms', 'Market
// Snapshots'). fake-indexeddb, a fresh IDBFactory per test.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import { listBackupTables, _resetBackupRegistry } from '$lib/storage/backup-registry';
import { TranDb, _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import {
	SnapshotPrivacyError,
	addSnapshot,
	countSnapshots,
	deleteSnapshot,
	getSnapshot,
	listSnapshots
} from './snapshots-repo';
import { clearStudioDraft, getStudioDraft, putStudioDraft } from './studio-draft-repo';
import {
	STUDIO_DRAFT_IDS,
	STUDIO_STORES,
	snapshotRowSchema,
	snapshotViolations,
	studioDraftRowSchema
} from './tables';
import { SNAPSHOT_SECTION_KEYS, type SnapshotRecord } from './types';

const T1 = '2026-10-07T12:00:00.000Z';
const T2 = '2026-10-08T12:00:00.000Z';
const T3 = '2026-10-09T12:00:00.000Z';
const ID1 = '00000000-0000-4000-8000-000000005501';
const ID2 = '00000000-0000-4000-8000-000000005502';
const ID3 = '00000000-0000-4000-8000-000000005503';

const extra: TranDb[] = [];
beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => {
	_resetDb();
	for (const db of extra.splice(0)) db.close();
	_resetBackupRegistry();
});

function snapshot(over: Partial<SnapshotRecord> = {}): SnapshotRecord {
	return {
		id: ID1,
		zip: '00501',
		placeName: 'Sampleton, ZZ',
		createdAt: T1,
		sample: true,
		source: 'sample',
		fetchedAt: T1,
		metrics: {
			zip: '00501',
			lastUpdated: '2026-10-01',
			medianRent: 1850,
			medianPrice: 320000,
			priceToRent: 14.4,
			rentChangePct: 3.2,
			rentChangeFrom: '2025-10',
			rentChangeTo: '2026-09',
			months: 12,
			saleDom: 31,
			rentalDom: 22,
			saleTotal: 140,
			saleNew: 18,
			rentalTotal: 95,
			rentalNew: 12,
			rentByBedroom: [
				{ beds: 1, median: 1500, listings: 30 },
				{ beds: 2, median: 1900, listings: 40 }
			]
		},
		series: {
			rentTrend: { zipCode: '00501', rentalData: { medianRent: 1850 } },
			priceToRent: { zipCode: '00501', saleData: { medianPrice: 320000 } }
		},
		listingsSample: {
			kind: 'rental',
			seenAt: T1,
			total: 12,
			byBedroom: [{ beds: 2, count: 7, min: 1700, max: 2000, median: 1850, medianDom: 18 }]
		},
		listingsFetchedAt: T1,
		narrative: {
			text: 'Median rent is $1,850.',
			artifactId: null,
			provider: null,
			model: null,
			sampleOutput: true
		},
		options: { eho: true, tranFooter: true, sections: [...SNAPSHOT_SECTION_KEYS] },
		agent: {
			disclosure: {
				fullName: 'Avery Sample',
				brokerage: 'Sample Realty',
				licenseType: 'Licensed Real Estate Salesperson',
				licenseNumber: '0000000',
				licenseState: 'NY',
				brokeragePhone: '(555) 555-0100'
			},
			brandPrimary: '#A4452A',
			brandAccent: '#F6E3D8',
			hasLogo: true
		},
		...over
	};
}

describe('TranDb version 7 (studio tables)', () => {
	it('adds studioDraft (keyed by tool) and snapshots (id, createdAt, zip) at version 7', async () => {
		const db = new TranDb(freshIdb());
		extra.push(db);
		await db.open();
		expect(db.verno).toBe(7);
		expect(STUDIO_STORES).toEqual({ studioDraft: 'tool', snapshots: 'id, createdAt, zip' });
		expect(db.table('studioDraft').schema.primKey.name).toBe('tool');
		expect(db.table('snapshots').schema.primKey.name).toBe('id');
		expect(
			db
				.table('snapshots')
				.schema.indexes.map((i) => i.name)
				.sort()
		).toEqual(['createdAt', 'zip']);
	});
});

describe('studio form drafts', () => {
	it('put/get round-trips per tool', async () => {
		expect(await getStudioDraft('listing')).toBeNull();
		await putStudioDraft('listing', { beds: 3, tone: 'warm' }, { now: new Date(T1) });
		await putStudioDraft('social', { brief: 'Open house' }, { now: new Date(T2) });
		expect(await getStudioDraft('listing')).toEqual({
			tool: 'listing',
			data: { beds: 3, tone: 'warm' },
			updatedAt: T1
		});
		expect(await getStudioDraft('social')).toEqual({
			tool: 'social',
			data: { brief: 'Open house' },
			updatedAt: T2
		});
		expect(await getStudioDraft('reel')).toBeNull();
	});

	it('stores a Syncable row with the tool fixed id; a rewrite keeps createdAt', async () => {
		await putStudioDraft('reel', { beats: ['a'] }, { now: new Date(T1) });
		await putStudioDraft('reel', { beats: ['a', 'b'] }, { now: new Date(T2) });
		const row = await getDb().studioDraft.get('reel');
		expect(row).toMatchObject({
			id: STUDIO_DRAFT_IDS.reel,
			ownerId: 'local',
			createdAt: T1,
			updatedAt: T2,
			schemaVersion: 1,
			tool: 'reel',
			data: { beats: ['a', 'b'] }
		});
		expect(studioDraftRowSchema.safeParse(row).success).toBe(true);
		expect(new Set(Object.values(STUDIO_DRAFT_IDS)).size).toBe(4);
	});

	it('clear removes one tool only', async () => {
		await putStudioDraft('listing', { a: 1 });
		await putStudioDraft('snapshot', { zip: '00501' });
		await clearStudioDraft('listing');
		expect(await getStudioDraft('listing')).toBeNull();
		expect((await getStudioDraft('snapshot'))?.data).toEqual({ zip: '00501' });
	});

	it('the backup schema rejects a draft row whose id is not its tool id', () => {
		const row = {
			id: STUDIO_DRAFT_IDS.listing,
			ownerId: 'local',
			createdAt: T1,
			updatedAt: T1,
			schemaVersion: 1,
			tool: 'social',
			data: {}
		};
		expect(studioDraftRowSchema.safeParse(row).success).toBe(false);
		expect(studioDraftRowSchema.safeParse({ ...row, tool: 'listing' }).success).toBe(true);
	});
});

describe('snapshots repository', () => {
	it('addSnapshot then getSnapshot(id) deep-equals the record', async () => {
		const rec = snapshot();
		await addSnapshot(rec);
		expect(await getSnapshot(ID1)).toEqual(rec);
		expect(await getSnapshot(ID2)).toBeNull();
	});

	it('listSnapshots returns newest createdAt first; deleteSnapshot removes; countSnapshots counts', async () => {
		await addSnapshot(snapshot({ id: ID1, createdAt: T2 }));
		await addSnapshot(snapshot({ id: ID2, createdAt: T3 }));
		await addSnapshot(snapshot({ id: ID3, createdAt: T1 }));
		expect((await listSnapshots()).map((s) => s.id)).toEqual([ID2, ID1, ID3]);
		expect(await countSnapshots()).toBe(3);
		await deleteSnapshot(ID1);
		expect(await getSnapshot(ID1)).toBeNull();
		expect((await listSnapshots()).map((s) => s.id)).toEqual([ID2, ID3]);
		expect(await countSnapshots()).toBe(2);
	});

	it('stores Syncable stamps around the record and the row passes the backup schema', async () => {
		await addSnapshot(snapshot());
		const row = await getDb().snapshots.get(ID1);
		expect(row).toMatchObject({ ownerId: 'local', updatedAt: T1, schemaVersion: 1 });
		expect(snapshotRowSchema.safeParse(row).success).toBe(true);
	});

	it('a snapshot is frozen: adding the same id again is refused', async () => {
		await addSnapshot(snapshot());
		await expect(addSnapshot(snapshot({ zip: '00502' }))).rejects.toThrow();
		expect((await getSnapshot(ID1))?.zip).toBe('00501');
	});

	it("refuses a non-uuid id (the 'sample' record is never stored)", async () => {
		await expect(addSnapshot(snapshot({ id: 'sample' }))).rejects.toThrow('snapshot-id-invalid');
		expect(await countSnapshots()).toBe(0);
	});
});

describe('snapshot privacy guard (aggregate-only)', () => {
	const refused = async (rec: unknown, path: string) => {
		const err = await addSnapshot(rec as SnapshotRecord).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(SnapshotPrivacyError);
		expect((err as SnapshotPrivacyError).violations.join(' ')).toContain(path);
		expect(await countSnapshots()).toBe(0);
	};

	it('refuses a listings summary key outside AGGREGATED_SAMPLE_KEYS', async () => {
		const base = snapshot();
		await refused(
			{ ...base, listingsSample: { ...base.listingsSample, listings: [] } },
			'listingsSample.listings'
		);
	});

	it('refuses a bedroom row key outside BEDROOM_AGGREGATE_KEYS', async () => {
		const base = snapshot();
		const row = { ...base.listingsSample!.byBedroom[0], id: 'listing-1' };
		await refused(
			{ ...base, listingsSample: { ...base.listingsSample, byBedroom: [row] } },
			'listingsSample.byBedroom.0.id'
		);
	});

	for (const key of [
		'formattedAddress',
		'addressLine1',
		'listingAgent',
		'listingOffice',
		'photos',
		'mlsNumber'
	]) {
		it(`refuses a record whose JSON contains the key ${key} (nested anywhere)`, async () => {
			const base = snapshot();
			await refused(
				{
					...base,
					series: {
						...base.series,
						rentTrend: { zipCode: '00501', nested: [{ [key]: 'x' }] }
					}
				},
				`${key}:forbidden`
			);
		});
	}

	it('refuses a logo blob or a logo key in the agent block', async () => {
		const base = snapshot();
		await refused(
			{ ...base, agent: { ...base.agent, logo: new Blob(['png']) } },
			'agent.logo:forbidden'
		);
		await refused(
			{ ...base, agent: { ...base.agent, logoBytes: new Uint8Array([1, 2]) } },
			'agent.logoBytes:binary'
		);
	});

	it('refuses an unknown top-level key (no raw response can ride along)', async () => {
		await refused({ ...snapshot(), rentcastResponse: { ok: true } }, 'rentcastResponse:unknown');
	});

	it('accepts the clean record and a null listings summary', () => {
		expect(snapshotViolations(snapshot())).toEqual([]);
		expect(snapshotViolations(snapshot({ listingsSample: null, narrative: null }))).toEqual([]);
	});

	it('the backup schema re-runs the guard on an imported row', () => {
		const row = {
			...snapshot(),
			ownerId: 'local',
			updatedAt: T1,
			schemaVersion: 1
		};
		expect(snapshotRowSchema.safeParse(row).success).toBe(true);
		expect(
			snapshotRowSchema.safeParse({
				...row,
				placeName: null,
				extraAddress: { formattedAddress: 'x' }
			}).success
		).toBe(false);
	});
});

describe('studio backup registration', () => {
	it("registers 'Studio forms' and 'Market Snapshots' with record schemas", () => {
		const byName = new Map(listBackupTables().map((t) => [t.name, t]));
		expect(byName.get('studioDraft')?.label).toBe('Studio forms');
		expect(byName.get('snapshots')?.label).toBe('Market Snapshots');
		expect(byName.get('studioDraft')?.schema).toBeDefined();
		expect(byName.get('snapshots')?.schema).toBeDefined();
	});

	it('an export contains both sections; previewing it elsewhere lists them by label; merge restores them', async () => {
		await putStudioDraft('listing', { beds: 3 }, { now: new Date(T1) });
		await addSnapshot(snapshot());
		const { text, counts } = await buildBackupText(getDb(), {
			now: new Date(T2),
			knownSecrets: []
		});
		expect(counts.studioDraft).toBe(1);
		expect(counts.snapshots).toBe(1);
		const parsed = JSON.parse(text) as { tables: Record<string, unknown[]> };
		expect(parsed.tables.studioDraft).toHaveLength(1);
		expect(parsed.tables.snapshots).toHaveLength(1);
		expect(text).not.toContain('formattedAddress');

		_resetDb();
		const target = getDb(freshIdb());
		const preview = await previewImport(target, {
			name: 'backup.json',
			size: text.length,
			text: async () => text
		});
		const rows = new Map(preview.merge.perTable.map((r) => [r.label, r]));
		expect(rows.get('Studio forms')?.add).toBe(1);
		expect(rows.get('Market Snapshots')?.add).toBe(1);
		await applyImport(target, preview, 'merge');
		expect(await getSnapshot(ID1)).toEqual(snapshot());
		expect((await getStudioDraft('listing'))?.data).toEqual({ beds: 3 });
	});

	it('an import with a snapshot row carrying a listing address is refused', async () => {
		await addSnapshot(snapshot());
		const { text } = await buildBackupText(getDb(), { now: new Date(T2), knownSecrets: [] });
		const tampered = JSON.parse(text) as { tables: Record<string, Record<string, unknown>[]> };
		tampered.tables.snapshots[0].narrative = { text: 'x', formattedAddress: '1 Sample St' };
		const body = JSON.stringify(tampered);
		_resetDb();
		const target = getDb(freshIdb());
		await expect(
			previewImport(target, { name: 'b.json', size: body.length, text: async () => body })
		).rejects.toThrow();
	});
});
