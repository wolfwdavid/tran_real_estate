/**
 * Check-on-open alerts scheduling decisions: which saved searches are due, which of them run now
 * within the RentCast budget cap, and when the user must confirm. Pure: `now`, `used` and `cap`
 * are passed in; the web scheduler only does the I/O around these functions.
 */

/** A saved search re-runs at most once per 24 hours. */
export const DUE_AFTER_MS = 86_400_000;
/** Another tab's claim blocks a re-run for 2 minutes (crash-safe: it expires on its own). */
export const CLAIM_TTL_MS = 120_000;
/** More than this many due searches asks the user before spending. */
export const CONFIRM_ABOVE = 3;

export interface DueCandidate {
	id: string;
	lastRunAt: number | null;
	claimedAt: number | null;
	/** Canonical request key: two searches with the same key share one call. */
	requestKey: string;
	/** A fresh cache entry exists, so running it costs no call. */
	cached: boolean;
}

export interface RunPlan<T> {
	run: T[];
	wait: T[];
	/** Uncached calls the run will spend. */
	calls: number;
	needsConfirm: boolean;
	/** Live mode with the cap already reached and searches left waiting. */
	blockedByCap: boolean;
}

export function isDue(s: Pick<DueCandidate, 'lastRunAt' | 'claimedAt'>, now: number): boolean {
	if (s.claimedAt !== null && now - s.claimedAt < CLAIM_TTL_MS) return false;
	return s.lastRunAt === null || now - s.lastRunAt >= DUE_AFTER_MS;
}

/** Due searches, oldest first: never-run first, then ascending `lastRunAt`, ties by id. */
export function dueSearches<T extends DueCandidate>(searches: readonly T[], now: number): T[] {
	return searches
		.filter((s) => isDue(s, now))
		.sort((a, b) => {
			const at = a.lastRunAt ?? -Infinity;
			const bt = b.lastRunAt ?? -Infinity;
			if (at !== bt) return at < bt ? -1 : 1;
			return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
		});
}

/**
 * Partition `due` (pass `dueSearches()` output, oldest first) into what runs now and what waits.
 * Live mode admits a search only while `used + calls + marginal <= cap`, so the plan never spends
 * past the cap; a cached search or a key already admitted costs 0.
 */
export function planRun<T extends DueCandidate>(
	due: readonly T[],
	opts: { used: number; cap: number; mode: 'live' | 'sample' }
): RunPlan<T> {
	if (opts.mode === 'sample') {
		return { run: [...due], wait: [], calls: 0, needsConfirm: false, blockedByCap: false };
	}

	const { used, cap } = opts;
	const run: T[] = [];
	const wait: T[] = [];
	const seen = new Set<string>();
	let calls = 0;

	for (const c of due) {
		const marginal = c.cached || seen.has(c.requestKey) ? 0 : 1;
		if (used + calls + marginal <= cap) {
			run.push(c);
			seen.add(c.requestKey);
			calls += marginal;
		} else {
			wait.push(c);
		}
	}

	return {
		run,
		wait,
		calls,
		needsConfirm: due.length > CONFIRM_ABOVE && run.length > 0,
		blockedByCap: wait.length > 0 && used >= cap
	};
}
