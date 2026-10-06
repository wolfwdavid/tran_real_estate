// Renter saved searches (RENT-04) on top of Phase 4's alerts model.
//
// Phase 4 owns the saved search (name, endpoint, the WIDE server params, lastRunAt/lastSeenAt,
// claims), its snapshot and the check-on-open scheduler that re-runs each due search at most once
// per 24 hours. This module stores the renter's location/filters/sort in the companion meta row
// (same id), computes the FILTERED new count (core filteredNewIds: new AND still matching the saved
// filters) and marks a search seen when its results are opened.
//
// It never spends. Rows come from gateway.peek (cache only, 0 calls); only Phase 4's scheduler
// fetches. Call it from onMount or event handlers (it touches IndexedDB).
import {
	savedSearchRepo,
	type DataGateway,
	type Provenance,
	type SavedSearchInput,
	type SavedSearchRepo
} from '$lib/data';
import type { Listing } from '@tran/core/listings';
import { buildSnapshot, isDue } from '@tran/core/alerts';
import {
	canSaveAnother,
	DEFAULT_VIEW,
	encodeSearchParams,
	filteredNewIds,
	locationDisplay,
	savedSearchSummary,
	type RentalFilters,
	type RenterLocation,
	type RenterSearchMeta,
	type RenterSortId,
	type SearchUrlState
} from '@tran/core/renter';
import { searchRequest } from '../data/requests';
import { getSearchMetaRepo, type SearchMetaRepo } from '../storage/search-meta-repo';

/** Longest saved-search name (UI-SPEC Name field, maxlength 60). */
export const NAME_MAX = 60;

type Phase4Row = Awaited<ReturnType<SavedSearchRepo['list']>>[number];
type GatewayLike = Pick<DataGateway, 'peek'>;

export interface RenterSavedSearchDeps {
	phase4: SavedSearchRepo;
	meta: SearchMetaRepo;
	/** The runtime's current gateway (peek only); null before the runtime starts. */
	gateway: () => GatewayLike | null;
	clock: () => number;
}

export interface SaveInput {
	name: string;
	location: RenterLocation;
	filters: RentalFilters;
	sort: RenterSortId;
	/** The current results: the baseline snapshot, so only later listings count as new. */
	rows: readonly Listing[];
	provenance: Pick<Provenance, 'fetchedAt'> | null;
	truncated: boolean;
}

export type SaveResult = { id: string; name: string } | { error: 'limit' | 'empty' };
export type RenameResult = { name: string } | { error: 'empty' };

/** One renter saved search as the Saved searches section shows it. */
export interface RenterSavedSearch {
	id: string;
	name: string;
	location: RenterLocation;
	filters: RentalFilters;
	sort: RenterSortId;
	/** "74201 · Up to $2,000 · 2 bd" */
	summary: string;
	newCount: number;
	/** When Phase 4's scheduler (or the save) last checked it; null = never. */
	checkedAt: number | null;
	/** Due for a check (no check in the last 24 hours). With the cap reached it is waiting. */
	due: boolean;
	/** The /renter/ query string that restores it (the caller adds `saved={id}`). */
	query: string;
}

/** Trim and cap a user-typed name; null when nothing is left. */
export function cleanName(name: string): string | null {
	const n = name.trim().slice(0, NAME_MAX).trimEnd();
	return n === '' ? null : n;
}

/** The wide server params Phase 4's scheduler re-runs (undefined values dropped, arrays copied). */
function storedParams(location: RenterLocation): SavedSearchInput['params'] {
	const out: SavedSearchInput['params'] = {};
	for (const [k, v] of Object.entries(searchRequest(location).params)) {
		if (v === undefined || v === null) continue;
		out[k] = typeof v === 'object' ? [...(v as readonly (string | number)[])] : v;
	}
	return out;
}

const sameFilters = (a: RentalFilters, b: RentalFilters) =>
	a.priceMin === b.priceMin &&
	a.priceMax === b.priceMax &&
	a.beds === b.beds &&
	a.listedWithin === b.listedWithin &&
	[...a.types].sort().join('|') === [...b.types].sort().join('|');

const sameLocation = (a: RenterLocation, b: RenterLocation) =>
	locationDisplay(a).toLowerCase() === locationDisplay(b).toLowerCase();

export function createRenterSavedSearches(deps: RenterSavedSearchDeps) {
	const { phase4, meta, clock } = deps;

	async function renterRows(): Promise<Phase4Row[]> {
		return (await phase4.list()).filter((r) => r.portal === 'renter');
	}

	async function metaById(): Promise<Partial<Record<string, RenterSearchMeta>>> {
		return Object.fromEntries((await meta.liveAll()).map((m) => [m.id, m]));
	}

	/** Cached rows for the search's location (peek: 0 calls); empty when nothing is cached. */
	async function cachedRows(location: RenterLocation): Promise<Map<string, Listing>> {
		const gateway = deps.gateway();
		const peeked = gateway ? await gateway.peek<Listing[]>(searchRequest(location)) : undefined;
		const data = peeked?.kind === 'data' ? peeked.result.data : [];
		return new Map(data.map((l) => [l.id, l]));
	}

	async function newIdsFor(row: Phase4Row, m: RenterSearchMeta): Promise<Set<string>> {
		const snap = await phase4.snapshot(row.id);
		if (!snap) return new Set();
		return filteredNewIds(
			snap.items,
			row.lastSeenAt,
			await cachedRows(m.location),
			m.filters,
			new Date(clock())
		);
	}

	function toItem(row: Phase4Row, m: RenterSearchMeta, newCount: number): RenterSavedSearch {
		const locationText = locationDisplay(m.location);
		return {
			id: row.id,
			name: row.name,
			location: m.location,
			filters: m.filters,
			sort: m.sort,
			summary: savedSearchSummary(locationText, m.filters),
			newCount,
			checkedAt: row.lastRunAt,
			due: isDue(row, clock()),
			query: encodeSearchParams({
				locInput: locationText,
				filters: m.filters,
				sort: m.sort,
				view: DEFAULT_VIEW
			}).toString()
		};
	}

	/** Live renter searches with their meta, newest-news first, then by name. */
	async function listRenter(): Promise<RenterSavedSearch[]> {
		const metas = await metaById();
		const out: RenterSavedSearch[] = [];
		for (const row of await renterRows()) {
			const m = metas[row.id];
			if (!m) continue;
			out.push(toItem(row, m, (await newIdsFor(row, m)).size));
		}
		return out.sort(
			(a, b) =>
				b.newCount - a.newCount ||
				a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
				a.id.localeCompare(b.id)
		);
	}

	async function find(id: string) {
		const row = (await renterRows()).find((r) => r.id === id);
		const m = row ? (await metaById())[id] : undefined;
		return row && m ? { row, m } : undefined;
	}

	return {
		listRenter,

		/** True while fewer than MAX_SAVED_SEARCHES renter searches exist. */
		async canSave(): Promise<boolean> {
			return canSaveAnother((await renterRows()).length);
		},

		/**
		 * Saves the current search. The Phase 4 row starts as just checked (lastRunAt = when these
		 * results were fetched, lastSeenAt = now) with a baseline snapshot of `rows`, so the scheduler
		 * re-runs it 24 hours after the data was fetched and only later listings count as new.
		 */
		async save(input: SaveInput): Promise<SaveResult> {
			const name = cleanName(input.name);
			if (name === null) return { error: 'empty' };
			if (!canSaveAnother((await renterRows()).length)) return { error: 'limit' };
			const now = clock();
			const created = await phase4.create({
				portal: 'renter',
				name,
				endpoint: 'rental-listings',
				params: storedParams(input.location)
			});
			try {
				const takenAt = input.provenance?.fetchedAt ?? now;
				const observed = input.rows.map((l) => ({
					id: l.id,
					price: l.price,
					status: l.status,
					removedDate: l.removedDate
				}));
				await phase4.complete(
					created.id,
					buildSnapshot(null, observed, { takenAt, truncated: input.truncated })
				);
				await meta.put(created.id, {
					location: input.location,
					filters: input.filters,
					sort: input.sort
				});
			} catch (e) {
				// The two stores live in different databases: undo the half-written search.
				await phase4.remove(created.id);
				await meta.remove(created.id);
				throw e;
			}
			return { id: created.id, name };
		},

		async rename(id: string, next: string): Promise<RenameResult> {
			const name = cleanName(next);
			if (name === null) return { error: 'empty' };
			await phase4.rename(id, name);
			return { name };
		},

		/** Tombstones the search, its snapshot's owner row and the meta. The shortlist is untouched. */
		async remove(id: string): Promise<void> {
			await phase4.remove(id);
			await meta.remove(id);
		},

		async newCount(id: string): Promise<number> {
			const found = await find(id);
			return found ? (await newIdsFor(found.row, found.m)).size : 0;
		},

		/**
		 * View results: the saved state to restore (0 calls) and the ids to badge "New", read BEFORE
		 * the search is marked seen, so the next visit starts from this snapshot.
		 */
		async openForResults(
			id: string
		): Promise<{ state: SearchUrlState; newIds: ReadonlySet<string> } | null> {
			const found = await find(id);
			if (!found) return null;
			const newIds = await newIdsFor(found.row, found.m);
			await phase4.markSeen(id);
			return {
				state: {
					locInput: locationDisplay(found.m.location),
					filters: found.m.filters,
					sort: found.m.sort,
					view: DEFAULT_VIEW
				},
				newIds
			};
		},

		/** The saved search with this location and filters, if any ("Saved search" state). */
		async findMatching(
			location: RenterLocation,
			filters: RentalFilters
		): Promise<RenterSavedSearch | undefined> {
			return (await listRenter()).find(
				(s) => sameLocation(s.location, location) && sameFilters(s.filters, filters)
			);
		}
	};
}

export type RenterSavedSearches = ReturnType<typeof createRenterSavedSearches>;

/** The app instance on the app databases. Call from onMount / event handlers only. */
export function getRenterSavedSearches(gateway: () => GatewayLike | null): RenterSavedSearches {
	return createRenterSavedSearches({
		phase4: savedSearchRepo(),
		meta: getSearchMetaRepo(),
		gateway,
		clock: () => Date.now()
	});
}
