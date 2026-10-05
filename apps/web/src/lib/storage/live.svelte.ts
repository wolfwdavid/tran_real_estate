// Reactive view of a Dexie liveQuery for Svelte 5 components. Thin on purpose: the Node Vitest
// project cannot run $effect, so reactivity is proven by E2E (the Settings "Last backup" line
// updates after an export without a reload, asserted in 03-13).
//
// The query closure must read its reactive inputs synchronously and be re-created when they
// change (e.g. `const rows = $derived(live(() => repo.list(filter), []))`), because liveQuery runs
// the query outside Svelte's dependency tracking.
import { liveQuery } from 'dexie';
import { createSubscriber } from 'svelte/reactivity';

/** Subscribes only while `current`/`error` is read inside an effect or template. */
export function live<T>(query: () => Promise<T>, initial: T) {
	let value = initial;
	let error: unknown;
	const subscribe = createSubscriber((update) => {
		const sub = liveQuery(query).subscribe({
			next: (v) => {
				value = v;
				update();
			},
			error: (e) => {
				error = e;
				update();
			}
		});
		return () => sub.unsubscribe();
	});
	return {
		get current() {
			subscribe();
			return value;
		},
		get error() {
			subscribe();
			return error;
		}
	};
}
