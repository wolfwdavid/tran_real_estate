import { describe, expect, test } from 'vitest';

import { BACKUP_REMINDER_DAYS, backupReminderDue, lastBackupAge } from './reminder.js';

// Local-time constructor everywhere: calendar-day math is then independent of the host timezone.
const NOW = new Date(2026, 9, 10, 12, 0);
const daysBefore = (n: number, hour = 12, minute = 0) =>
	new Date(2026, 9, 10 - n, hour, minute).toISOString();

describe('BACKUP_REMINDER_DAYS', () => {
	test('is 7', () => {
		expect(BACKUP_REMINDER_DAYS).toBe(7);
	});
});

describe('backupReminderDue', () => {
	test('is never due when there are no records', () => {
		expect(
			backupReminderDue({ now: NOW, hasRecords: false, lastBackupAt: daysBefore(30) })
		).toEqual({ due: false });
	});

	test('is due at exactly 7 calendar days since the last backup', () => {
		expect(backupReminderDue({ now: NOW, hasRecords: true, lastBackupAt: daysBefore(7) })).toEqual({
			due: true,
			days: 7,
			never: false
		});
	});

	test('counts calendar days, not elapsed hours (7 days ago late evening still counts as 7)', () => {
		expect(
			backupReminderDue({ now: NOW, hasRecords: true, lastBackupAt: daysBefore(7, 23, 59) })
		).toEqual({ due: true, days: 7, never: false });
	});

	test('is not due at 6 calendar days', () => {
		expect(backupReminderDue({ now: NOW, hasRecords: true, lastBackupAt: daysBefore(6) })).toEqual({
			due: false
		});
	});

	test('falls back to the first record when there was never a backup', () => {
		expect(backupReminderDue({ now: NOW, hasRecords: true, firstRecordAt: daysBefore(8) })).toEqual(
			{
				due: true,
				days: 8,
				never: true
			}
		);
	});

	test('a later backup wins over the first record date', () => {
		expect(
			backupReminderDue({
				now: NOW,
				hasRecords: true,
				firstRecordAt: daysBefore(30),
				lastBackupAt: daysBefore(2)
			})
		).toEqual({ due: false });
	});

	test('is not due while snoozed', () => {
		const snoozedUntil = new Date(2026, 9, 11, 9, 0).toISOString();
		expect(
			backupReminderDue({ now: NOW, hasRecords: true, lastBackupAt: daysBefore(9), snoozedUntil })
		).toEqual({ due: false });
	});

	test('an expired snooze is ignored', () => {
		const snoozedUntil = new Date(2026, 9, 10, 11, 0).toISOString();
		expect(
			backupReminderDue({ now: NOW, hasRecords: true, lastBackupAt: daysBefore(9), snoozedUntil })
		).toEqual({ due: true, days: 9, never: false });
	});

	test('is not due when there is neither a backup nor a first-record date', () => {
		expect(backupReminderDue({ now: NOW, hasRecords: true })).toEqual({ due: false });
	});

	test('accepts a custom threshold', () => {
		expect(
			backupReminderDue({ now: NOW, hasRecords: true, lastBackupAt: daysBefore(3) }, 3)
		).toEqual({
			due: true,
			days: 3,
			never: false
		});
	});
});

describe('lastBackupAge', () => {
	test('reports never when there was no backup', () => {
		expect(lastBackupAge(NOW, undefined)).toEqual({ kind: 'never' });
	});

	test('reports 0 days for a backup earlier the same local day', () => {
		expect(lastBackupAge(NOW, new Date(2026, 9, 10, 0, 1).toISOString())).toEqual({
			kind: 'days',
			days: 0
		});
	});

	test('reports 1 day across midnight even when only a minute has passed', () => {
		const justAfterMidnight = new Date(2026, 9, 10, 0, 0);
		const justBefore = new Date(2026, 9, 9, 23, 59).toISOString();
		expect(lastBackupAge(justAfterMidnight, justBefore)).toEqual({ kind: 'days', days: 1 });
	});
});
