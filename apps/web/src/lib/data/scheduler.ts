// Check-on-open alerts scheduler (DATA-03; RESEARCH Pattern 7, Pitfalls 3 and 12).
//
// Every decision is pure and lives in @tran/core/alerts (dueSearches, planRun, buildSnapshot,
// diffSnapshots); this module only does the I/O around them:
//   list → cost each due search → planRun within the cap → confirm when more than 3 are due →
//   for each planned search, in order and one at a time: claim (rw transaction) →
//   gateway.get(req, { intent: 'scheduler' }) → snapshot + diff → complete (one transaction).
//
// The scheduler never refreshes, never asks for an over-cap grant, and never opens the cap dialog:
// a BudgetCapReached mid-run (another tab spent the last call) stops the loop and the rest wait.
// The claim makes two tabs opening at once run each search once (scheduler.test.ts "two tabs").
// Call it from an event handler or onMount, never inside $effect (lint rule from 04-07).
import {
	buildSnapshot,
	diffSnapshots,
	dueSearches,
	planRun,
	type DueCandidate,
	type ObservedItem
} from '@tran/core/alerts';
import type { Listing } from '@tran/core/listings';
import { canonicalKey, isGatewayError, type DataRequest } from '@tran/core/request';
import type { DataGateway } from './gateway';
import type { SavedSearchRepo } from './saved-search-repo';
import type { SavedSearchRow } from './tables';

/** Runs `fn` while holding the cross-tab alerts lock; null when another tab holds it. */
export interface LockPort {
	run<T>(fn: () => Promise<T>): Promise<T | null>;
}

export const noLock: LockPort = { run: (fn) => fn() };

/** navigator.locks 'tran-alerts' with ifAvailable (a busy lock skips the pass), else noLock. */
export function browserLock(): LockPort {
	const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
	if (!locks || typeof locks.request !== 'function') return noLock;
	return {
		run: <T>(fn: () => Promise<T>) =>
			locks.request('tran-alerts', { ifAvailable: true }, (lock) =>
				lock ? fn() : null
			) as Promise<T | null>
	};
}

export interface SchedulerResult {
	/** Searches that ran and stored a new snapshot, in run order. */
	ran: string[];
	/** Due searches left for a later pass: over the cap, declined, or stopped by the cap mid-run. */
	waiting: string[];
	/** Searches whose call failed (network, key, rate limit); released and due again next pass. */
	failed: string[];
	skipped: null | 'cap' | 'declined' | 'busy';
	/** Listings new since the previous snapshot, summed over the searches that ran. */
	newListings: number;
	/** How many searches were due when the pass started. */
	due: number;
}

export interface ConfirmInput {
	due: SavedSearchRow[];
	run: SavedSearchRow[];
	/** Uncached calls the run will spend. */
	calls: number;
	used: number;
	cap: number;
}

export interface SchedulerDeps {
	gateway: DataGateway;
	repo: SavedSearchRepo;
	clock: () => number;
	/** Asked only when more than 3 searches are due and at least one can run. */
	confirm: (input: ConfirmInput) => Promise<boolean>;
	lock?: LockPort;
	/** Called before each planned search runs: i is 1-based, k is how many are planned. */
	onProgress?: (i: number, k: number) => void;
}

const SCHEDULED: ReadonlySet<string> = new Set(['rental-listings', 'sale-listings']);

interface Candidate extends DueCandidate {
	row: SavedSearchRow;
	req: DataRequest;
}

const idsOf = (cs: readonly Candidate[]) => cs.map((c) => c.id);

const observedOf = (listings: readonly Listing[]): ObservedItem[] =>
	listings.map((l) => ({ id: l.id, price: l.price, status: l.status, removedDate: l.removedDate }));

export async function runDueSearches(deps: SchedulerDeps): Promise<SchedulerResult> {
	const result = await (deps.lock ?? noLock).run(() => pass(deps));
	return result ?? { ran: [], waiting: [], failed: [], skipped: 'busy', newListings: 0, due: 0 };
}

async function pass({
	gateway,
	repo,
	clock,
	confirm,
	onProgress
}: SchedulerDeps): Promise<SchedulerResult> {
	const out: SchedulerResult = {
		ran: [],
		waiting: [],
		failed: [],
		skipped: null,
		newListings: 0,
		due: 0
	};

	const candidates: Candidate[] = [];
	for (const row of await repo.list()) {
		if (!SCHEDULED.has(row.endpoint)) continue;
		const req = { endpoint: row.endpoint, params: row.params } as DataRequest;
		candidates.push({
			id: row.id,
			lastRunAt: row.lastRunAt,
			claimedAt: row.claimedAt,
			requestKey: canonicalKey(req),
			cached: (await gateway.estimateCost(req)).calls === 0,
			row,
			req
		});
	}

	const due = dueSearches(candidates, clock());
	out.due = due.length;
	if (due.length === 0) return out;

	const usage = await gateway.usage();
	const plan = planRun(due, {
		used: usage.countedTowardCap,
		cap: usage.cap,
		mode: gateway.source === 'sample' ? 'sample' : 'live'
	});
	if (plan.blockedByCap) out.skipped = 'cap';
	if (plan.run.length === 0) {
		out.waiting = idsOf(plan.wait);
		return out;
	}

	if (
		plan.needsConfirm &&
		!(await confirm({
			due: due.map((c) => c.row),
			run: plan.run.map((c) => c.row),
			calls: plan.calls,
			used: usage.countedTowardCap,
			cap: usage.cap
		}))
	) {
		return { ...out, skipped: 'declined', waiting: idsOf(due) };
	}

	for (const [i, s] of plan.run.entries()) {
		// Another tab ran or is running this search: skip it, never run it twice.
		if (!(await repo.claim(s.id))) continue;
		onProgress?.(i + 1, plan.run.length);

		let observed: ObservedItem[];
		let truncated: boolean;
		try {
			const res = await gateway.get<Listing[]>(s.req, { intent: 'scheduler' });
			observed = observedOf(res.data);
			truncated = res.truncated;
		} catch (e) {
			if (isGatewayError(e) && e.kind === 'NoResults') {
				observed = [];
				truncated = false;
			} else {
				await repo.release(s.id);
				if (isGatewayError(e) && e.kind === 'BudgetCapReached') {
					out.skipped = 'cap';
					out.waiting = [...idsOf(plan.run.slice(i)), ...idsOf(plan.wait)];
					return out;
				}
				if (!isGatewayError(e)) throw e;
				out.failed.push(s.id);
				continue;
			}
		}

		const prev = (await repo.snapshot(s.id)) ?? null;
		const next = buildSnapshot(prev, observed, { takenAt: clock(), truncated });
		out.newListings += diffSnapshots(prev, next).new.length;
		await repo.complete(s.id, next);
		out.ran.push(s.id);
	}

	out.waiting = idsOf(plan.wait);
	return out;
}
