// Saved deals (INV-02). A deal stores analyzer inputs + field sources only; outputs are recomputed.
// Every write validates with dealRecordSchema, so nothing invalid reaches storage or a backup.
// Delete is a tombstone (deletedAt) and also tombstones the deal's memo drafts through the 07-04
// artifact repo contract (deleteBySubjectId) inside the SAME Dexie transaction: the artifact
// repo's inner rw transaction on aiArtifacts joins the outer one (its table set is a subset), so
// the deal and its drafts are removed atomically, and a failure rolls the deal back too.
//
// Callers pass plain data: `$state.snapshot(form)` before calling, never a Svelte proxy (IndexedDB
// structured-clones the value and cannot clone a proxy). Call from onMount / event handlers only.
// Persistence: the click handler that saves the first deal calls requestPersistence() itself.
import { newSyncable, tombstone } from '@tran/core';
import { ANALYZER_VERSION } from '@tran/core/finance';
import { createArtifactRepo, type ArtifactRepo } from '$lib/ai/storage/artifacts';
import { getDb, type TranDb } from '$lib/storage/db';
import { live } from '$lib/storage/live.svelte';
import { META } from '$lib/storage/meta';
import { dealRecordSchema, type DealData, type DealRecord } from './schema';
import { dealsTable, INVESTOR_RECORD_SCHEMA_VERSION } from './tables';

export interface DeleteDealDeps {
	artifacts?: Pick<ArtifactRepo, 'deleteBySubjectId'>;
	now?: () => Date;
}

export interface DealsRepo {
	createDeal(data: DealData): Promise<DealRecord>;
	/** Rejects with Error('deal-not-found') when the deal is missing or deleted. */
	updateDeal(id: string, data: DealData): Promise<DealRecord>;
	/** null when missing or tombstoned. */
	getDeal(id: string): Promise<DealRecord | null>;
	/** Live deals, most recently updated first. */
	listDeals(): Promise<DealRecord[]>;
	/** Tombstones the deal and its memo drafts atomically. A missing or deleted deal is a no-op. */
	deleteDeal(id: string, deps?: DeleteDealDeps): Promise<void>;
}

export interface DealsRepoOptions {
	now?: () => Date;
	uuid?: () => string;
}

const isLive = (d: DealRecord) => d.deletedAt === undefined;

/** Only the DealData fields, as a fresh plain object (drops any computed or stray keys). */
function pickData(d: DealData): DealData {
	return {
		name: d.name,
		address: d.address,
		propertyType: d.propertyType,
		bedrooms: d.bedrooms,
		bathrooms: d.bathrooms,
		squareFeet: d.squareFeet,
		inputs: d.inputs,
		sources: d.sources
	};
}

export function createDealsRepo(db: TranDb, o: DealsRepoOptions = {}): DealsRepo {
	const now = o.now ?? (() => new Date());
	const uuid = o.uuid ?? (() => crypto.randomUUID());
	const table = () => dealsTable(db);

	const save = async (rec: DealRecord): Promise<DealRecord> => {
		dealRecordSchema.parse(rec);
		await table().put(rec);
		return rec;
	};

	return {
		createDeal(data) {
			return db.transaction('rw', [table(), db.meta], async () => {
				const at = now();
				const rec: DealRecord = {
					...newSyncable({ id: uuid(), now: at, schemaVersion: INVESTOR_RECORD_SCHEMA_VERSION }),
					...pickData(data),
					analyzerVersion: ANALYZER_VERSION
				};
				await save(rec);
				if (!(await db.meta.get(META.firstRecordAt))) {
					await db.meta.put({ key: META.firstRecordAt, value: at.toISOString() });
				}
				return rec;
			});
		},

		updateDeal(id, data) {
			return db.transaction('rw', table(), async () => {
				const existing = await table().get(id);
				if (!existing || !isLive(existing)) throw new Error('deal-not-found');
				const rec: DealRecord = {
					id: existing.id,
					ownerId: existing.ownerId,
					createdAt: existing.createdAt,
					updatedAt: now().toISOString(),
					schemaVersion: existing.schemaVersion,
					...pickData(data),
					analyzerVersion: ANALYZER_VERSION
				};
				return save(rec);
			});
		},

		async getDeal(id) {
			const rec = await table().get(id);
			return rec && isLive(rec) ? rec : null;
		},

		async listDeals() {
			const rows = await table().filter(isLive).toArray();
			return rows.sort((a, b) =>
				a.updatedAt === b.updatedAt ? 0 : a.updatedAt < b.updatedAt ? 1 : -1
			);
		},

		async deleteDeal(id, deps = {}) {
			const at = (deps.now ?? now)();
			const artifacts = deps.artifacts ?? createArtifactRepo(db);
			await db.transaction('rw', [table(), db.aiArtifacts], async () => {
				const existing = await table().get(id);
				if (!existing || !isLive(existing)) return;
				await table().put(tombstone(existing, at));
				await artifacts.deleteBySubjectId(id, at);
			});
		}
	};
}

let instance: DealsRepo | undefined;

/** App singleton bound to the app database. Call from onMount / event handlers only. */
export function getDealsRepo(): DealsRepo {
	instance ??= createDealsRepo(getDb());
	return instance;
}

export const createDeal = (data: DealData) => getDealsRepo().createDeal(data);
export const updateDeal = (id: string, data: DealData) => getDealsRepo().updateDeal(id, data);
export const getDeal = (id: string) => getDealsRepo().getDeal(id);
export const listDeals = () => getDealsRepo().listDeals();

export async function deleteDeal(id: string, deps?: DeleteDealDeps): Promise<void> {
	return getDealsRepo().deleteDeal(id, deps);
}

/** Reactive list of live deals (undefined until the first query resolves). Read in templates. */
export function dealsLive(): { readonly current: DealRecord[] | undefined } {
	return live<DealRecord[] | undefined>(() => listDeals(), undefined);
}
