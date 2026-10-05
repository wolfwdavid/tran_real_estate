// The shared record shape for everything the app stores locally (saved searches, CRM contacts,
// drafts, ...). Every persisted record is Syncable so a future account-sync phase can merge by
// id + updatedAt without a migration.
//
// Timestamps are ISO-8601 UTC strings produced by Date#toISOString(). Those compare correctly as
// plain strings, and the backup diff/merge relies on that ordering.
// Ids are passed in by the caller (apps/web generates a random v4 UUID): this package has no
// platform globals, so it cannot mint ids itself.
import * as z from 'zod/mini';

export const OWNER_LOCAL = 'local' as const;

export interface Syncable {
	id: string;
	ownerId: typeof OWNER_LOCAL;
	createdAt: string;
	updatedAt: string;
	/** Tombstone: set instead of hard-deleting so deletions survive backup merges. */
	deletedAt?: string;
	schemaVersion: number;
}

export const SyncableSchema = z.looseObject({
	id: z.string().check(z.uuid()),
	ownerId: z.literal(OWNER_LOCAL),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	deletedAt: z.optional(z.iso.datetime()),
	schemaVersion: z.number().check(z.int(), z.positive())
});

export function newSyncable(i: { id: string; now: Date; schemaVersion: number }): Syncable {
	const stamp = i.now.toISOString();
	return {
		id: i.id,
		ownerId: OWNER_LOCAL,
		createdAt: stamp,
		updatedAt: stamp,
		schemaVersion: i.schemaVersion
	};
}

/** Returns a copy with updatedAt set to `now`; the input is not mutated. */
export function touch<T extends Syncable>(rec: T, now: Date): T {
	return { ...rec, updatedAt: now.toISOString() };
}

/** Returns a soft-deleted copy (deletedAt = updatedAt = `now`); the input is not mutated. */
export function tombstone<T extends Syncable>(rec: T, now: Date): T {
	const stamp = now.toISOString();
	return { ...rec, deletedAt: stamp, updatedAt: stamp };
}
