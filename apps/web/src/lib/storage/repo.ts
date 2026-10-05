// Syncable repositories over TranDb tables. Every write stamps id/owner/timestamps/schemaVersion;
// delete is a tombstone (deletedAt) so deletions survive backup merges.
//
// Persistence rule: the UI that triggers a user's first meaningful save must call
// requestPersistence() synchronously at the top of its click handler. The repo cannot do it: it
// runs after awaits, and Firefox only honours persist() with user activation.
import { newSyncable, tombstone, touch, type Syncable } from '@tran/core';
import type { TranDb } from './db';
import { META } from './meta';

export interface RepoOptions {
	schemaVersion: number;
	now?: () => Date;
	uuid?: () => string;
}

export type RepoInput<T extends Syncable> = Omit<T, keyof Syncable> & Partial<Syncable>;

export interface Repo<T extends Syncable> {
	get(id: string): Promise<T | undefined>;
	list(o?: { includeDeleted?: boolean }): Promise<T[]>;
	put(input: RepoInput<T>): Promise<T>;
	remove(id: string): Promise<void>;
}

export function createRepo<T extends Syncable>(db: TranDb, table: string, o: RepoOptions): Repo<T> {
	const now = o.now ?? (() => new Date());
	const uuid = o.uuid ?? (() => crypto.randomUUID());
	const tbl = () => db.table<T, string>(table);

	return {
		get: (id) => tbl().get(id),

		async list(opts) {
			const all = await tbl().toArray();
			return opts?.includeDeleted ? all : all.filter((r) => r.deletedAt === undefined);
		},

		put(input) {
			return db.transaction('rw', [tbl(), db.meta], async () => {
				const at = now();
				const existing = input.id ? await tbl().get(input.id) : undefined;
				const record = existing
					? touch(
							{
								...existing,
								...input,
								createdAt: existing.createdAt,
								ownerId: existing.ownerId
							} as T,
							at
						)
					: ({
							...input,
							...newSyncable({ id: input.id ?? uuid(), now: at, schemaVersion: o.schemaVersion })
						} as T);
				await tbl().put(record);
				if (!(await db.meta.get(META.firstRecordAt))) {
					await db.meta.put({ key: META.firstRecordAt, value: at.toISOString() });
				}
				return record;
			});
		},

		async remove(id) {
			await db.transaction('rw', tbl(), async () => {
				const existing = await tbl().get(id);
				if (existing) await tbl().put(tombstone(existing, now()));
			});
		}
	};
}
