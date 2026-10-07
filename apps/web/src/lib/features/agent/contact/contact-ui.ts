// Pure copy helpers for the contact detail page (08-23; UI-SPEC "Contact detail" and the
// live-region table). No Svelte, no storage: the components render these strings next to the
// 08-12 repo calls. Kept ASCII: the middle dot is built from its code point.
import { SOURCE_LABELS, type Contact } from '@tran/core/agent/types';
import type { LogType } from '$lib/storage/agent/contacts-repo';
import { formatMonDayYear } from '../dates';

const MIDDOT = String.fromCharCode(0xb7);

/** The Log contact form's Type options, in UI-SPEC order. */
export const LOG_TYPES: readonly { value: LogType; label: string }[] = Object.freeze([
	{ value: 'call', label: 'Call' },
	{ value: 'email', label: 'Email' },
	{ value: 'meeting', label: 'Meeting' },
	{ value: 'other', label: 'Other' },
	{ value: 'note', label: 'Note' }
]);

/** "Logged {type} for {Name}." */
export function logAnnouncement(type: LogType, name: string): string {
	return `Logged ${type} for ${name}.`;
}

export interface DeleteDialogCopy {
	title: string;
	body: string;
	confirmLabel: string;
	cancelLabel: string;
}

/** The Delete contact confirmation (UI-SPEC "Destructive confirmation: Delete contact"). */
export function deleteDialogCopy(name: string, taskCount: number): DeleteDialogCopy {
	const tasks = taskCount === 1 ? '1 task' : `${taskCount} tasks`;
	return {
		title: `Delete ${name}?`,
		body: `This removes ${name}, their ${tasks}, and their activity from this browser. It can't be undone. If you might need them later, cancel and download a backup in Settings first.`,
		confirmLabel: 'Delete contact',
		cancelLabel: 'Keep contact'
	};
}

/** "Added {Mon D, YYYY} - {source}" (the header meta line). */
export function addedMeta(contact: Pick<Contact, 'createdAt' | 'source'>): string {
	return `Added ${formatMonDayYear(contact.createdAt)} ${MIDDOT} ${SOURCE_LABELS[contact.source]}`;
}

/** The announcement after the opt-out checkbox is saved. */
export function optOutAnnouncement(name: string, optedOut: boolean): string {
	return optedOut
		? `${name} won't get follow-up drafts.`
		: `Follow-up drafts turned back on for ${name}.`;
}
