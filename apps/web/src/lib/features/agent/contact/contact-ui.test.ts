// Contact detail copy helpers (08-23): the log-contact labels, the announcements and the delete
// confirmation copy, pinned to the UI-SPEC strings. No Svelte, no storage.
import { describe, expect, it } from 'vitest';
import {
	LOG_TYPES,
	addedMeta,
	deleteDialogCopy,
	logAnnouncement,
	optOutAnnouncement
} from './contact-ui';

const MIDDOT = String.fromCharCode(0xb7);

describe('LOG_TYPES', () => {
	it('lists the five log types in UI-SPEC order with their labels', () => {
		expect(LOG_TYPES).toEqual([
			{ value: 'call', label: 'Call' },
			{ value: 'email', label: 'Email' },
			{ value: 'meeting', label: 'Meeting' },
			{ value: 'other', label: 'Other' },
			{ value: 'note', label: 'Note' }
		]);
	});
});

describe('logAnnouncement', () => {
	it('names the type and the contact', () => {
		expect(logAnnouncement('call', 'Jordan Example')).toBe('Logged call for Jordan Example.');
		expect(logAnnouncement('meeting', 'Riley Sample')).toBe('Logged meeting for Riley Sample.');
		expect(logAnnouncement('note', 'Riley Sample')).toBe('Logged note for Riley Sample.');
	});
});

describe('deleteDialogCopy', () => {
	it('builds the confirmation with the task count', () => {
		expect(deleteDialogCopy('Jordan Example', 2)).toEqual({
			title: 'Delete Jordan Example?',
			body: "This removes Jordan Example, their 2 tasks, and their activity from this browser. It can't be undone. If you might need them later, cancel and download a backup in Settings first.",
			confirmLabel: 'Delete contact',
			cancelLabel: 'Keep contact'
		});
	});

	it('singularizes one task', () => {
		expect(deleteDialogCopy('Jordan Example', 1).body).toContain('their 1 task, and');
		expect(deleteDialogCopy('Jordan Example', 1).body).not.toContain('1 tasks');
	});

	it('keeps the plural for zero tasks', () => {
		expect(deleteDialogCopy('Jordan Example', 0).body).toContain('their 0 tasks, and');
	});
});

describe('addedMeta', () => {
	it('formats the created date and the source label', () => {
		expect(addedMeta({ createdAt: '2026-10-04T15:30:00.000Z', source: 'inquiry' })).toBe(
			`Added Oct 4, 2026 ${MIDDOT} Inquiry page`
		);
		expect(addedMeta({ createdAt: '2026-01-02T12:00:00.000Z', source: 'csv' })).toBe(
			`Added Jan 2, 2026 ${MIDDOT} CSV import`
		);
	});
});

describe('optOutAnnouncement', () => {
	it('announces the opt-out being set or cleared', () => {
		expect(optOutAnnouncement('Jordan Example', true)).toBe(
			"Jordan Example won't get follow-up drafts."
		);
		expect(optOutAnnouncement('Jordan Example', false)).toBe(
			'Follow-up drafts turned back on for Jordan Example.'
		);
	});
});
