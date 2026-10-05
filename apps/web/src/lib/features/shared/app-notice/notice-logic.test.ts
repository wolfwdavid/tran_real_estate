import { describe, expect, it } from 'vitest';
import { backupCopy, isSettingsPath, selectNotice, SNOOZE_MS } from './notice-logic';

const locked = { hasLock: true, locked: true };
const unlocked = { hasLock: true, locked: false };
const noLock = { hasLock: false, locked: false };
const due = { due: true as const, days: 9, never: false };
const notDue = { due: false as const };

describe('selectNotice', () => {
	it('puts locked keys before an overdue backup', () => {
		expect(selectNotice({ isSettings: false, vault: locked, reminder: due })).toBe('locked');
	});

	it('suppresses the locked notice on Settings', () => {
		expect(selectNotice({ isSettings: true, vault: locked, reminder: due })).toBe('backup');
		expect(selectNotice({ isSettings: true, vault: locked, reminder: notDue })).toBeNull();
	});

	it('shows the backup notice when due and keys are not locked', () => {
		expect(selectNotice({ isSettings: false, vault: noLock, reminder: due })).toBe('backup');
		expect(selectNotice({ isSettings: false, vault: unlocked, reminder: due })).toBe('backup');
	});

	it('shows nothing when not due and not locked', () => {
		expect(selectNotice({ isSettings: false, vault: noLock, reminder: notDue })).toBeNull();
		expect(selectNotice({ isSettings: false, vault: unlocked, reminder: notDue })).toBeNull();
	});

	it('shows the locked notice alone when nothing is due', () => {
		expect(selectNotice({ isSettings: false, vault: locked, reminder: notDue })).toBe('locked');
		expect(selectNotice({ isSettings: false, vault: locked, reminder: null })).toBe('locked');
	});

	it('tolerates a missing vault or reminder (storage blocked / not loaded)', () => {
		expect(selectNotice({ isSettings: false, vault: null, reminder: due })).toBe('backup');
		expect(selectNotice({ isSettings: false, vault: null, reminder: null })).toBeNull();
		expect(selectNotice({ isSettings: false, vault: noLock, reminder: null })).toBeNull();
	});
});

describe('isSettingsPath', () => {
	it('matches the Settings route under either base', () => {
		expect(isSettingsPath('/settings/', '')).toBe(true);
		expect(isSettingsPath('/settings', '')).toBe(true);
		expect(isSettingsPath('/tran_real_estate/settings/', '/tran_real_estate')).toBe(true);
	});

	it('rejects other routes', () => {
		expect(isSettingsPath('/renter/', '')).toBe(false);
		expect(isSettingsPath('/', '')).toBe(false);
		expect(isSettingsPath('/tran_real_estate/renter/', '/tran_real_estate')).toBe(false);
		expect(isSettingsPath('/settings-old/', '')).toBe(false);
		expect(isSettingsPath('/settings/', '/tran_real_estate')).toBe(false);
	});
});

describe('backupCopy', () => {
	it('names the day count after a previous backup', () => {
		expect(backupCopy({ days: 9, never: false })).toBe(
			'Your last backup was 9 days ago. Browsers can clear saved data, so download a fresh copy.'
		);
	});

	it('uses the never-backed-up copy', () => {
		expect(backupCopy({ days: 12, never: true })).toBe(
			"You haven't backed up yet. Browsers can clear saved data, so download a copy."
		);
	});
});

describe('SNOOZE_MS', () => {
	it('is 24 hours', () => {
		expect(SNOOZE_MS).toBe(86_400_000);
	});
});
