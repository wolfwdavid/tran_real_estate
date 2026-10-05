// Check-on-open alerts through the public port (DATA-03; CONTEXT "Alerts scheduler runs from the
// root (app) layout on mount, gated on key presence and budget").
//
// checkSavedSearchesOnOpen runs the due saved searches once, through the runtime's CURRENT gateway:
// in sample mode that gateway reads fixtures (0 calls, never asks); in live mode it spends inside
// the cap only, asks first when more than 3 are due and never prompts past the cap (the scheduler
// never uses an over-cap grant). It does nothing until the runtime has a mode and a gateway.
//
// Call it from onMount or an event handler, never from $effect (04-07 lint rule).
import { getDataDb, type DataDb } from './platform';
import type { DataRuntime } from './runtime.svelte';
import { createSavedSearchRepo, type SavedSearchRepo } from './saved-search-repo';
import {
	browserLock,
	runDueSearches,
	type ConfirmInput,
	type LockPort,
	type SchedulerResult
} from './scheduler';

export interface AlertsDeps {
	db: DataDb;
	clock: () => number;
	/** Cross-tab lock; defaults to navigator.locks 'tran-alerts'. */
	lock: LockPort;
	/** Progress for the DueSearchesDialog label ("Checking {i} of {k}…"). */
	onProgress?: (i: number, k: number) => void;
}

/** Fills in the app database and wall clock, touching the app database only when needed. */
function resolveDeps(deps: Partial<Pick<AlertsDeps, 'db' | 'clock'>>) {
	return {
		db: deps.db ?? getDataDb(),
		// Mirrors the runtime's production clock; tests inject their own.
		clock: deps.clock ?? (() => Date.now())
	};
}

/**
 * Runs due saved searches once for this app open. Resolves undefined when the runtime is not
 * started yet (mode null) or has no gateway; otherwise the scheduler result.
 */
export async function checkSavedSearchesOnOpen(
	runtime: DataRuntime,
	confirm: (input: ConfirmInput) => Promise<boolean>,
	deps: Partial<AlertsDeps> = {}
): Promise<SchedulerResult | undefined> {
	const gateway = runtime.gateway;
	if (runtime.mode === null || gateway === null) return undefined;
	const { db, clock } = resolveDeps(deps);
	return runDueSearches({
		gateway,
		repo: createSavedSearchRepo(db, clock),
		clock,
		confirm,
		lock: deps.lock ?? browserLock(),
		onProgress: deps.onProgress
	});
}

/** The saved-search repository for portals (create, list, markSeen, remove, ...). */
export function savedSearchRepo(
	deps: Partial<Pick<AlertsDeps, 'db' | 'clock'>> = {}
): SavedSearchRepo {
	const { db, clock } = resolveDeps(deps);
	return createSavedSearchRepo(db, clock);
}
