import { isBilled } from './policy';

/** A pending ledger row older than this is conservatively counted as billed. */
export const PENDING_STALE_MS = 120_000;

export type LedgerStatus = 'pending' | number;

/** Ledger intent of a key-test probe: billed like any call, but never a search. */
export const KEY_TEST_INTENT = 'key-test';

export interface LedgerEntryLike {
	at: number;
	status: LedgerStatus;
	/** Why the call was made. A key test with no results is not a search, so it is not in `noResults`. */
	intent?: string;
}

export interface UsageSummary {
	billed: number;
	noResults: number;
	failed: number;
	pending: number;
	countedTowardCap: number;
}

/**
 * Summarize ledger rows for the cap and meter. `billed` is always derived from
 * the status via isBilled(), never from a stored flag. A 404/400 key test is
 * neither billed nor a search, so it is left out of every count.
 */
export function summarize(entries: readonly LedgerEntryLike[], now: number): UsageSummary {
	let billed = 0;
	let noResults = 0;
	let failed = 0;
	let pending = 0;
	for (const entry of entries) {
		if (entry.status === 'pending') {
			if (now - entry.at >= PENDING_STALE_MS) billed += 1;
			else pending += 1;
		} else if (isBilled(entry.status)) {
			billed += 1;
		} else if (entry.status === 404 || entry.status === 400) {
			if (entry.intent !== KEY_TEST_INTENT) noResults += 1;
		} else {
			failed += 1;
		}
	}
	return { billed, noResults, failed, pending, countedTowardCap: billed + pending };
}
