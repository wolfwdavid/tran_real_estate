// Watched ZIPs (INV-05): up to MAX_WATCHED_ZIPS, no duplicates, valid 5-digit ZIPs only (rules in
// @tran/core/markets). watchZip re-reads the list INSIDE a read-write transaction before applying
// the rule, and IndexedDB serialises read-write transactions on a table, so two tabs racing to add
// a sixth ZIP cannot both succeed.
//
// Rows are Syncable and keyed by watchedZipId(zip). Unwatching tombstones the row (deletions
// survive backup merges); re-watching restores it. Unwatching never touches the market-stats
// cache: the cached RentCast response stays until its TTL, so re-watching is free.
import { newSyncable, tombstone } from '@tran/core';
import { addWatchedZip, validateZip } from '@tran/core/markets';
import { getDb, type TranDb } from '$lib/storage/db';
import { live } from '$lib/storage/live.svelte';
import { INVESTOR_RECORD_SCHEMA_VERSION } from '$lib/features/investor/deals/tables';
import { watchedZipId, watchedZipRecordSchema, type WatchedZipRecord } from './watched-zip-record';

export interface WatchedZip {
	zip: string;
	addedAt: number;
}

export type WatchResult =
	{ ok: true; zip: string } | { ok: false; error: 'invalid' | 'duplicate' | 'limit' };

export interface WatchedZipsRepo {
	/** Live watches, oldest first. */
	listWatchedZips(): Promise<WatchedZip[]>;
	watchZip(input: string): Promise<WatchResult>;
	/** Tombstones the watch; a ZIP that is not watched is a no-op. */
	unwatchZip(zip: string): Promise<void>;
}

const isLive = (r: WatchedZipRecord) => r.deletedAt === undefined;
const toWatchedZip = (r: WatchedZipRecord): WatchedZip => ({ zip: r.zip, addedAt: r.addedAt });

export function createWatchedZipsRepo(
	db: TranDb,
	clock: () => number = () => Date.now()
): WatchedZipsRepo {
	const table = () => db.watchedZips;
	const liveRows = async () =>
		(await table().filter(isLive).toArray()).sort((a, b) => a.addedAt - b.addedAt);

	return {
		async listWatchedZips() {
			return (await liveRows()).map(toWatchedZip);
		},

		watchZip(input) {
			return db.transaction('rw', table(), async (): Promise<WatchResult> => {
				const current = (await liveRows()).map((r) => r.zip);
				const r = addWatchedZip(current, input);
				if (!r.ok) return { ok: false, error: r.error };

				const now = clock();
				const id = watchedZipId(r.zip);
				const existing = await table().get(id);
				let rec: WatchedZipRecord;
				if (existing) {
					// Restore the tombstone: same id + createdAt, deletedAt REMOVED (never null).
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { deletedAt, ...kept } = existing;
					rec = { ...kept, addedAt: now, updatedAt: new Date(now).toISOString() };
				} else {
					rec = {
						...newSyncable({
							id,
							now: new Date(now),
							schemaVersion: INVESTOR_RECORD_SCHEMA_VERSION
						}),
						zip: r.zip,
						addedAt: now
					};
				}
				watchedZipRecordSchema.parse(rec);
				await table().put(rec);
				return { ok: true, zip: r.zip };
			});
		},

		async unwatchZip(zip) {
			const v = validateZip(zip);
			if (!v.ok) return;
			await db.transaction('rw', table(), async () => {
				const row = await table().get(watchedZipId(v.zip));
				if (row && isLive(row)) await table().put(tombstone(row, new Date(clock())));
			});
		}
	};
}

let instance: WatchedZipsRepo | undefined;

/** App singleton bound to the app database. Call from onMount / event handlers only. */
export function getWatchedZipsRepo(): WatchedZipsRepo {
	instance ??= createWatchedZipsRepo(getDb());
	return instance;
}

export const listWatchedZips = () => getWatchedZipsRepo().listWatchedZips();
export const watchZip = (input: string) => getWatchedZipsRepo().watchZip(input);
export const unwatchZip = (zip: string) => getWatchedZipsRepo().unwatchZip(zip);

/** Reactive list of watched ZIPs (undefined until the first query resolves). Read in templates. */
export function watchedZipsLive(): { readonly current: WatchedZip[] | undefined } {
	return live<WatchedZip[] | undefined>(() => listWatchedZips(), undefined);
}
