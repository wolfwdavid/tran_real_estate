// The 0-call reactive read for views (DATA-02, CONTEXT "views read from cache-backed stores and
// only explicit user actions spend calls"). It subscribes a Dexie liveQuery over gateway.peek(),
// which reads the cache (live mode) or the in-memory fixtures (sample mode) and NEVER spends.
// When a click handler spends via runtime.requestSpend, the cache write re-runs the query and the
// view updates with no further call.
import { liveQuery } from 'dexie';
import type { DataRequest } from '@tran/core/request';
import type { PeekResult } from './gateway';
import type { DataRuntime } from './runtime.svelte';

export interface PeekStore<T> {
	/** undefined while loading, when nothing is cached, or when there is no request. */
	readonly current: PeekResult<T> | undefined;
	readonly loading: boolean;
}

/**
 * Call during component initialisation. `getRequest` is read inside an effect, so any reactive
 * state it reads (a location, a filter) re-peeks when it changes, as does a gateway rebuild
 * (mode switch). Returning null clears the store.
 */
export function createPeekStore<T>(
	runtime: DataRuntime,
	getRequest: () => DataRequest | null
): PeekStore<T> {
	let current = $state<PeekResult<T> | undefined>(undefined);
	let loading = $state(false);

	$effect(() => {
		const gateway = runtime.gateway;
		const req = getRequest();
		// Never show one request's (or one mode's) data under another.
		current = undefined;
		if (!gateway || !req) {
			loading = false;
			return;
		}
		loading = true;
		const sub = liveQuery(() => gateway.peek<T>(req)).subscribe({
			next: (value) => {
				current = value;
				loading = false;
			},
			error: () => {
				// Storage unavailable: show nothing rather than a stale value.
				current = undefined;
				loading = false;
			}
		});
		return () => sub.unsubscribe();
	});

	return {
		get current() {
			return current;
		},
		get loading() {
			return loading;
		}
	};
}
