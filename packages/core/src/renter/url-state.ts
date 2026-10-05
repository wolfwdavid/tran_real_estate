// Renter search state <-> URL query params (`loc`, `min`, `max`, `beds`, `type`, `days`, `sort`,
// `view`), so Back, reload and shared links restore a search on the prerendered `/renter/` route.
//
// Decoding is side-effect free: a URL never spends a call (RESEARCH Pitfall 8). It only parses;
// the caller peeks the cache and waits for a click before any billable request. Every param is
// validated on its own, and anything unrecognised falls back to its default instead of throwing.
import { DEFAULT_SORT, isSortId, type SortId } from './sort.js';
import {
	DEFAULT_FILTERS,
	LISTED_WITHIN,
	RENTER_PROPERTY_TYPES,
	type BedsFilter,
	type ListedWithin,
	type RentalFilters,
	type RenterPropertyType
} from './types.js';

export type ResultsView = 'list' | 'map';

export interface SearchUrlState {
	/** The location box exactly as typed; normalization happens when the user searches. */
	locInput: string;
	filters: RentalFilters;
	sort: SortId;
	view: ResultsView;
}

export const DEFAULT_VIEW: ResultsView = 'list';

/** `beds=` values. Words instead of `0` / `4+` keep the query readable and `+`-safe. */
const BEDS_TO_PARAM: Record<Exclude<BedsFilter, 'any'>, string> = {
	0: 'studio',
	1: '1',
	2: '2',
	3: '3',
	'4+': '4plus'
};
const PARAM_TO_BEDS = new Map<string, BedsFilter>(
	Object.entries(BEDS_TO_PARAM).map(([beds, param]) => [
		param,
		beds === '4+' ? '4+' : (Number(beds) as 0 | 1 | 2 | 3)
	])
);

const TYPE_SEPARATOR = '|';
const UINT = /^\d+$/;

function encodeBeds(beds: BedsFilter): string | null {
	return beds === 'any' ? null : BEDS_TO_PARAM[beds];
}

export function encodeSearchParams(s: SearchUrlState): URLSearchParams {
	const p = new URLSearchParams();
	if (s.locInput.trim() !== '') p.set('loc', s.locInput);
	const f = s.filters;
	if (f.priceMin !== null) p.set('min', String(f.priceMin));
	if (f.priceMax !== null) p.set('max', String(f.priceMax));
	const beds = encodeBeds(f.beds);
	if (beds !== null) p.set('beds', beds);
	if (f.types.length > 0) p.set('type', [...new Set(f.types)].sort().join(TYPE_SEPARATOR));
	if (f.listedWithin !== 'any') p.set('days', String(f.listedWithin));
	if (s.sort !== DEFAULT_SORT) p.set('sort', s.sort);
	if (s.view !== DEFAULT_VIEW) p.set('view', s.view);
	return p;
}

function decodeUint(v: string | null): number | null {
	if (v === null || !UINT.test(v)) return null;
	const n = Number(v);
	return Number.isSafeInteger(n) ? n : null;
}

function decodeTypes(v: string | null): readonly RenterPropertyType[] {
	if (v === null) return DEFAULT_FILTERS.types;
	const wanted = new Set(v.split(TYPE_SEPARATOR));
	// Canonical UI order, unknown values (e.g. 'Land') dropped, duplicates collapsed.
	return RENTER_PROPERTY_TYPES.filter((t) => wanted.has(t));
}

function decodeDays(v: string | null): ListedWithin {
	const n = decodeUint(v);
	return (LISTED_WITHIN as readonly number[]).includes(n ?? -1)
		? (n as ListedWithin)
		: DEFAULT_FILTERS.listedWithin;
}

export function decodeSearchParams(p: URLSearchParams): SearchUrlState {
	const beds = p.get('beds');
	const sort = p.get('sort');
	const view = p.get('view');
	return {
		locInput: p.get('loc') ?? '',
		filters: {
			priceMin: decodeUint(p.get('min')),
			priceMax: decodeUint(p.get('max')),
			beds: (beds !== null ? PARAM_TO_BEDS.get(beds) : undefined) ?? DEFAULT_FILTERS.beds,
			types: decodeTypes(p.get('type')),
			listedWithin: decodeDays(p.get('days'))
		},
		sort: isSortId(sort) ? sort : DEFAULT_SORT,
		view: view === 'map' || view === 'list' ? view : DEFAULT_VIEW
	};
}
