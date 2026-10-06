// The stored watched-ZIP row (INV-05) and its backup schema. Dependency-free apart from zod/mini so
// the backup registry can import it. Rows are Syncable (the backup envelope requires it) and keyed
// by watchedZipId(zip): the same ZIP has the same id in every browser, so a backup merge of two
// devices watching one ZIP updates a single row instead of colliding on the unique zip index.
import * as z from 'zod/mini';
import type { Syncable } from '@tran/core';

export interface WatchedZipRecord extends Syncable {
	zip: string;
	/** Epoch milliseconds when the ZIP was (re)watched; the list is ordered by it. */
	addedAt: number;
}

/** A deterministic RFC 4122 v4-shaped id for a 5-digit ZIP. */
export function watchedZipId(zip: string): string {
	return `00000000-0000-4000-8000-0000000${zip}`;
}

const isoDate = z.iso.datetime();

export const watchedZipRecordSchema = z.object({
	id: z.string().check(z.uuid()),
	ownerId: z.literal('local'),
	createdAt: isoDate,
	updatedAt: isoDate,
	deletedAt: z.optional(isoDate),
	schemaVersion: z.number().check(z.int(), z.positive()),
	zip: z.string().check(z.regex(/^\d{5}$/)),
	addedAt: z.number().check(z.int(), z.gte(0))
});
