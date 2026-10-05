// Local-only bookkeeping in the `meta` table. Meta is NEVER part of a backup: importing a file
// must not fake backup recency or the first-record date.
import type { ReminderInput } from '@tran/core';
import { listBackupTables } from './backup-registry';
import type { TranDb } from './db';

export const META = {
	lastBackupAt: 'lastBackupAt',
	snoozedUntil: 'backupReminderSnoozedUntil',
	firstRecordAt: 'firstRecordAt'
} as const;

export type MetaKey = (typeof META)[keyof typeof META];

export async function getMeta<T>(db: TranDb, key: MetaKey): Promise<T | undefined> {
	const row = await db.meta.get(key);
	return row?.value as T | undefined;
}

export async function setMeta(db: TranDb, key: MetaKey, value: unknown): Promise<void> {
	await db.meta.put({ key, value });
}

/** Everything backupReminderDue() needs. hasRecords = any live record in any registered table. */
export async function readReminderInput(db: TranDb, now: Date): Promise<ReminderInput> {
	const present = new Set(db.tables.map((t) => t.name));
	let hasRecords = false;
	for (const { name } of listBackupTables()) {
		if (!present.has(name)) continue;
		const live = await db
			.table<{ deletedAt?: string }>(name)
			.filter((r) => r.deletedAt === undefined)
			.first();
		if (live) {
			hasRecords = true;
			break;
		}
	}
	const [lastBackupAt, firstRecordAt, snoozedUntil] = await Promise.all([
		getMeta<string>(db, META.lastBackupAt),
		getMeta<string>(db, META.firstRecordAt),
		getMeta<string>(db, META.snoozedUntil)
	]);
	return {
		now,
		hasRecords,
		...(lastBackupAt !== undefined && { lastBackupAt }),
		...(firstRecordAt !== undefined && { firstRecordAt }),
		...(snoozedUntil !== undefined && { snoozedUntil })
	};
}
