// Backup reminder math (03-UI-SPEC "Backup reminder rule"). Day counts are whole calendar days in
// the user's local time (date-fns differenceInCalendarDays), never elapsed milliseconds / 86400000,
// so "7 days ago" means seven midnights have passed.
import { differenceInCalendarDays } from 'date-fns';

/** Safari can evict script-written data after 7 days without interaction; remind at the same age. */
export const BACKUP_REMINDER_DAYS = 7;

export type ReminderInput = {
	now: Date;
	hasRecords: boolean;
	lastBackupAt?: string;
	firstRecordAt?: string;
	snoozedUntil?: string;
};

export type ReminderResult = { due: false } | { due: true; days: number; never: boolean };

export function backupReminderDue(i: ReminderInput, days = BACKUP_REMINDER_DAYS): ReminderResult {
	if (!i.hasRecords) return { due: false };
	if (i.snoozedUntil && new Date(i.snoozedUntil) > i.now) return { due: false };
	const since = i.lastBackupAt ?? i.firstRecordAt;
	if (!since) return { due: false };
	const n = differenceInCalendarDays(i.now, new Date(since));
	return n >= days ? { due: true, days: n, never: !i.lastBackupAt } : { due: false };
}

export type BackupAge = { kind: 'never' } | { kind: 'days'; days: number };

/** "Last backup N days ago" for the storage status panel. */
export function lastBackupAge(now: Date, lastBackupAt?: string): BackupAge {
	if (!lastBackupAt) return { kind: 'never' };
	return { kind: 'days', days: differenceInCalendarDays(now, new Date(lastBackupAt)) };
}
