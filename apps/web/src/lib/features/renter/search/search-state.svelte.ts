// The renter search controller (RENT-01/RENT-02): fetch wide, filter local (06-RESEARCH Pattern 1)
// with URL state that never spends (Pattern 4, Pitfall 8).
//
// SPEND RULE: the gateway is asked for a billable call ONLY inside search(), narrow() and
// refresh(), which run from click/submit handlers. restoreFromUrl() and peekCurrent() use
// gateway.peek (cache only, 0 calls). Nothing in this file runs a $effect, and no $effect anywhere
// may call search()/narrow()/refresh(): the runtime's reactive guard would reject the spend.
//
// Filters and sort change `filtered`/`sorted` synchronously at 0 calls; the wide request's cache
// key never depends on them.
import {
	applyFilters,
	decodeSearchParams,
	DEFAULT_FILTERS,
	DEFAULT_SORT,
	DEFAULT_VIEW,
	encodeSearchParams,
	isTruncated,
	locationDisplay,
	normalizeRenterLocation,
	removeChip,
	sortRentals,
	SORT_OPTIONS,
	type LocationError,
	type RentalFilters,
	type RenterLocation,
	type ResultsView,
	type SortId
} from '@tran/core/renter';
import type { Listing } from '@tran/core/listings';
import {
	isGatewayError,
	type DataGateway,
	type DataRequest,
	type GatewayError,
	type GatewayResult,
	type Provenance
} from '$lib/data';
import { searchRequest } from '../data/requests';

/** Cards rendered per page ("Show 24 more"). */
export const PAGE_SIZE = 24;
/** Filter-change announcements wait this long after the last change (UI-SPEC). */
export const FILTER_ANNOUNCE_MS = 500;

const EMPTY_IDS: ReadonlySet<string> = Object.freeze(new Set<string>());

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RenterSearchDeps {
	/** The current gateway (null until the data runtime has started). Read-only use: peek/estimate. */
	gateway: () => DataGateway | null;
	/** The ONE spend path: the runtime's requestSpend (over-cap → CapConfirmDialog). */
	spend: (req: DataRequest, kind?: 'get' | 'refresh') => Promise<GatewayResult<Listing[]>>;
	now: () => Date;
	announce?: (message: string) => void;
	/**
	 * The announcer's sequence (announcementSequence). When given, the debounced filter summary is
	 * dropped if anything else was announced after it was scheduled, so it never overwrites a newer
	 * message such as a selected map pin.
	 */
	announcementSequence?: () => number;
}

export function createRenterSearch(deps: RenterSearchDeps) {
	const announce = deps.announce ?? (() => {});

	let locInput = $state('');
	/** The loc text the URL carries: set by restore and by a validated search, never per keystroke. */
	let committedLoc = $state('');
	let location = $state<RenterLocation | null>(null);
	let locationError = $state<LocationError | null>(null);
	let filters = $state<RentalFilters>(DEFAULT_FILTERS);
	let sort = $state<SortId>(DEFAULT_SORT);
	let view = $state<ResultsView>(DEFAULT_VIEW);
	let status = $state<SearchStatus>('idle');
	let rows = $state.raw<Listing[]>([]);
	let provenance = $state<Provenance | null>(null);
	let truncated = $state(false);
	let error = $state.raw<GatewayError | null>(null);
	let selectedListingId = $state<string | null>(null);
	let hoveredListingId = $state<string | null>(null);
	/** Ids new since the last visit (06-20 sets it); replaced whole, never mutated. */
	let newIds = $state.raw<ReadonlySet<string>>(EMPTY_IDS);
	let shownCount = $state(PAGE_SIZE);
	/** Bumps after every cache-changing action so cost labels re-estimate. */
	let version = $state(0);

	/** Latest load wins: an older peek or spend that settles late never overwrites newer state. */
	let seq = 0;
	let announceTimer: ReturnType<typeof setTimeout> | undefined;

	const rentError = $derived(
		filters.priceMin !== null && filters.priceMax !== null && filters.priceMin > filters.priceMax
	);
	const filtered = $derived(applyFilters(rows, filters, deps.now()));
	const sorted = $derived(sortRentals(filtered, sort));
	/** The wide request for the searched/restored location (its key ignores the filters). */
	const request = $derived(location ? searchRequest(location) : null);
	/** What clicking Search would request: the typed location, or null while it is not valid. */
	const typedRequest = $derived.by(() => {
		const r = normalizeRenterLocation(locInput);
		return r.ok ? searchRequest(r.location) : null;
	});
	const narrowRequest = $derived(location ? searchRequest(location, filters, 'narrow') : null);
	const locationText = $derived(location ? locationDisplay(location) : '');

	function applyResult(result: GatewayResult<Listing[]>): void {
		rows = result.data;
		provenance = result.provenance;
		truncated = result.truncated || isTruncated(result.data);
		error = null;
		status = 'ready';
	}

	function applyError(e: GatewayError): void {
		rows = [];
		provenance = e.provenance ?? null;
		truncated = false;
		error = e;
		status = 'error';
	}

	/** Cache only (0 calls): fills results for the current location, or leaves the form waiting. */
	async function peekCurrent(): Promise<void> {
		const mine = ++seq;
		const gateway = deps.gateway();
		const req = request;
		if (!gateway || !req) return;
		const peeked = await gateway.peek<Listing[]>(req);
		if (mine !== seq) return;
		if (peeked?.kind === 'data') applyResult(peeked.result);
		else if (peeked?.kind === 'error') applyError(peeked.error);
		else {
			rows = [];
			provenance = null;
			truncated = false;
			error = null;
			status = 'idle';
		}
		version++;
	}

	async function restoreFromUrl(params: URLSearchParams): Promise<void> {
		const state = decodeSearchParams(params);
		locInput = state.locInput;
		committedLoc = state.locInput;
		filters = state.filters;
		sort = state.sort;
		view = state.view;
		locationError = null;
		const r = normalizeRenterLocation(state.locInput);
		location = r.ok ? r.location : null;
		if (!location) {
			seq++;
			rows = [];
			provenance = null;
			truncated = false;
			error = null;
			status = 'idle';
			return;
		}
		await peekCurrent();
	}

	/** The click/submit spend path shared by search, narrow and refresh. */
	async function run(req: DataRequest, kind: 'get' | 'refresh'): Promise<void> {
		const mine = ++seq;
		const previous = status;
		status = 'loading';
		try {
			const result = await deps.spend(req, kind);
			if (mine !== seq) return;
			applyResult(result);
			shownCount = PAGE_SIZE;
			selectedListingId = null;
			announce(`${filtered.length} rentals found in ${locationText}.`);
		} catch (e) {
			if (mine !== seq) return;
			if (isGatewayError(e)) {
				// "Not now" on the over-cap prompt: nothing was spent, keep what was on screen.
				if (e.kind === 'BudgetCapReached' && e.detail === 'dismissed') status = previous;
				else applyError(e);
				return;
			}
			status = previous;
			throw e;
		} finally {
			version++;
		}
	}

	async function search(): Promise<void> {
		if (status === 'loading') return;
		const r = normalizeRenterLocation(locInput);
		if (!r.ok) {
			locationError = r.error;
			return;
		}
		locationError = null;
		if (rentError) return;
		location = r.location;
		committedLoc = locationDisplay(r.location);
		await run(searchRequest(r.location), 'get');
	}

	async function narrow(): Promise<void> {
		if (status === 'loading' || !location || rentError) return;
		await run(searchRequest(location, filters, 'narrow'), 'get');
	}

	/** "Refresh (1 call)": bypasses the TTL for the current wide request. */
	async function refresh(): Promise<void> {
		if (status === 'loading' || !request) return;
		await run(request, 'refresh');
	}

	function scheduleFilterAnnouncement(): void {
		clearTimeout(announceTimer);
		if (rows.length === 0) return;
		const scheduledAt = deps.announcementSequence?.();
		announceTimer = setTimeout(() => {
			if (scheduledAt !== undefined && deps.announcementSequence?.() !== scheduledAt) return;
			if (rows.length > 0) announce(`Showing ${filtered.length} of ${rows.length} rentals.`);
		}, FILTER_ANNOUNCE_MS);
	}

	function setFilters(next: RentalFilters): void {
		filters = { ...next, types: [...next.types] };
		shownCount = PAGE_SIZE;
		scheduleFilterAnnouncement();
	}

	return {
		get locInput() {
			return locInput;
		},
		set locInput(v: string) {
			locInput = v;
		},
		get location() {
			return location;
		},
		get locationText() {
			return locationText;
		},
		get locationError() {
			return locationError;
		},
		get filters() {
			return filters;
		},
		get sort() {
			return sort;
		},
		get view() {
			return view;
		},
		get status() {
			return status;
		},
		get rows() {
			return rows;
		},
		get provenance() {
			return provenance;
		},
		get truncated() {
			return truncated;
		},
		get error() {
			return error;
		},
		get rentError() {
			return rentError;
		},
		get filtered() {
			return filtered;
		},
		get sorted() {
			return sorted;
		},
		get request() {
			return request;
		},
		get typedRequest() {
			return typedRequest;
		},
		get narrowRequest() {
			return narrowRequest;
		},
		get selectedListingId() {
			return selectedListingId;
		},
		get hoveredListingId() {
			return hoveredListingId;
		},
		get newIds() {
			return newIds;
		},
		set newIds(v: ReadonlySet<string>) {
			newIds = v;
		},
		get shownCount() {
			return shownCount;
		},
		get version() {
			return version;
		},
		restoreFromUrl,
		peekCurrent,
		search,
		narrow,
		refresh,
		setFilters,
		removeFilter(key: string) {
			setFilters(removeChip(filters, key));
		},
		clearFilters() {
			setFilters(DEFAULT_FILTERS);
		},
		setSort(id: SortId) {
			sort = id;
			const option = SORT_OPTIONS.find((o) => o.id === id);
			if (option) announce(`Sorted by ${option.label}.`);
		},
		setView(v: ResultsView) {
			view = v;
		},
		toUrlParams(): URLSearchParams {
			return encodeSearchParams({ locInput: committedLoc, filters, sort, view });
		},
		select(id: string | null) {
			selectedListingId = id;
		},
		hover(id: string | null) {
			hoveredListingId = id;
		},
		showMore() {
			shownCount += PAGE_SIZE;
		},
		/** Stops the pending filter announcement (call on unmount). */
		dispose() {
			clearTimeout(announceTimer);
		}
	};
}

export type RenterSearch = ReturnType<typeof createRenterSearch>;
