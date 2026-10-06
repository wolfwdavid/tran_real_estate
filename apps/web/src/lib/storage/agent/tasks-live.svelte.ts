// Reactive task views for Svelte 5 components, on Phase 3's live() (same `{ current, error,
// loaded }` shape as live.svelte.ts). Recreate a view when its input changes:
// `const tasks = $derived(useTasksFor(id))`.
import type { Task } from '@tran/core/agent/types';
import { live } from '$lib/storage/live.svelte';
import type { LiveView } from './live.svelte';
import { listDoneSince, listOpenTasks, listTasksFor } from './tasks-repo';

function view(query: () => Promise<Task[]>): LiveView<Task[]> {
	const l = live<Task[] | undefined>(query, undefined);
	return {
		get current() {
			return l.current ?? [];
		},
		get error() {
			return l.error;
		},
		get loaded() {
			return l.current !== undefined;
		}
	};
}

/** All live open tasks, soonest due first (the Today queue). */
export const useOpenTasks = (): LiveView<Task[]> => view(() => listOpenTasks());

/** One contact's live tasks, open and done. */
export const useTasksFor = (contactId: string): LiveView<Task[]> =>
	view(() => listTasksFor(contactId));

/** Tasks completed since isoStart (local midnight as ISO). */
export const useDoneToday = (isoStart: string): LiveView<Task[]> =>
	view(() => listDoneSince(isoStart));
