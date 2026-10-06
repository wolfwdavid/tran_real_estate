// Reactive agent CRM views for Svelte 5 components: thin wrappers over Phase 3's live() (no
// liveQuery plumbing here). Each view starts with an `undefined` sentinel so callers can tell
// "still loading" (loaded === false) from "loaded and empty".
//
// Reactivity cannot be exercised in the Node Vitest project ($effect never runs there); it is
// proven in the browser project / E2E. When an input changes (a contact id), recreate the view:
// `const contact = $derived(useContact(id))`. Plan 08-14 adds useTasks() in its own module.
import type { Activity, AgentProfile, Contact } from '@tran/core/agent/types';
import { live } from '$lib/storage/live.svelte';
import { getContact, listActivities, listContacts } from './contacts-repo';
import { getProfile } from './profile-repo';

export interface LiveView<T> {
	readonly current: T;
	readonly error: unknown;
	readonly loaded: boolean;
}

function view<T, F>(query: () => Promise<T>, fallback: F): LiveView<T | F> {
	const l = live<T | undefined>(query, undefined);
	return {
		get current() {
			const v = l.current;
			return v === undefined ? fallback : v;
		},
		get error() {
			return l.error;
		},
		get loaded() {
			return l.current !== undefined;
		}
	};
}

/** All live contacts (samples included), newest first. */
export const useContacts = (): LiveView<Contact[]> => view(() => listContacts(), [] as Contact[]);

/** One live contact; null when missing, deleted, or still loading (see `loaded`). */
export const useContact = (id: string): LiveView<Contact | null> =>
	view(() => getContact(id), null);

/** A contact's live activities, newest first. */
export const useActivities = (contactId: string): LiveView<Activity[]> =>
	view(() => listActivities(contactId), [] as Activity[]);

/** The saved agent profile, or null before one is saved. */
export const useProfile = (): LiveView<AgentProfile | null> => view(() => getProfile(), null);
