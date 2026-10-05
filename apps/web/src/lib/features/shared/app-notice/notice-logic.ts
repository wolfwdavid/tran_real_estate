// App notice selection (03-UI-SPEC "App notice slot"). Pure: no Svelte, no storage imports, so the
// marketing entry never pulls this module's callers' storage code in through it.
import type { ReminderResult } from '@tran/core';

export type NoticeKind = 'locked' | 'backup';

/** "Remind me tomorrow" hides the backup notice for 24 hours. There is no permanent dismiss. */
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface NoticeInput {
	/** Settings already shows the lock state in Key security, so the locked notice is suppressed there. */
	isSettings: boolean;
	/** Null when the vault has not loaded or storage is blocked. */
	vault: { hasLock: boolean; locked: boolean } | null;
	/** Null when the reminder could not be computed (storage blocked / not loaded). */
	reminder: ReminderResult | null;
}

/** At most one notice: locked keys first, then an overdue backup. */
export function selectNotice(i: NoticeInput): NoticeKind | null {
	if (!i.isSettings && i.vault?.hasLock && i.vault.locked) return 'locked';
	if (i.reminder?.due) return 'backup';
	return null;
}

/** True for the Settings route under the given base ('' at root, '/tran_real_estate' on Pages). */
export function isSettingsPath(pathname: string, base: string): boolean {
	if (base && !pathname.startsWith(`${base}/`)) return false;
	const rest = pathname.slice(base.length);
	return rest === '/settings' || rest === '/settings/';
}

/** Body copy for the backup notice. */
export function backupCopy(r: { days: number; never: boolean }): string {
	if (r.never)
		return "You haven't backed up yet. Browsers can clear saved data, so download a copy.";
	return `Your last backup was ${r.days} days ago. Browsers can clear saved data, so download a fresh copy.`;
}
