// Renter search: fetch wide, filter local (06-RESEARCH Pattern 1). One server request per
// location; every renter filter is applied by the pure `matchRental` below at 0 API calls.
// The optional narrow request (offered only for a possibly truncated 500-row response) pushes
// the filters server-side in RentCast's `min:max` / multi-value form.
import {
	DEFAULT_FILTERS,
	SEARCH_LIMIT,
	type RentalFilters,
	type RentalRowLike,
	type RenterLocation
} from './types.js';
import { utcDayDiff } from './dates.js';

export { utcDayDiff };

export type ServerParams = Record<string, string | number | readonly string[]>;

/** Upper bounds used so narrow ranges are always closed (06-RESEARCH Open Question 8). */
const PRICE_CEILING = 100000;

export function toServerParams(
	location: RenterLocation,
	filters: RentalFilters = DEFAULT_FILTERS,
	mode: 'wide' | 'narrow' = 'wide'
): ServerParams {
	// Fetch wide: every user filter is local and free; the request key must not change with filters.
	const params: ServerParams =
		location.kind === 'zip'
			? { zipCode: location.zipCode, status: 'Active', limit: SEARCH_LIMIT }
			: { city: location.city, state: location.state, status: 'Active', limit: SEARCH_LIMIT };
	if (mode === 'wide') return params;

	if (filters.priceMin !== null || filters.priceMax !== null) {
		params.price = `${filters.priceMin ?? 0}:${filters.priceMax ?? PRICE_CEILING}`;
	}
	if (filters.beds !== 'any') {
		params.bedrooms = filters.beds === '4+' ? '4:20' : `${filters.beds}:${filters.beds}`;
	}
	if (filters.types.length > 0) params.propertyType = [...filters.types].sort();
	if (filters.listedWithin !== 'any') params.daysOld = `1:${filters.listedWithin}`;
	return params;
}

export function matchRental(row: RentalRowLike, f: RentalFilters, now: Date): boolean {
	if (row.status !== 'Active' || (row.removedDate ?? null) !== null) return false;
	if (row.propertyType === 'Land') return false;

	if (f.priceMin !== null || f.priceMax !== null) {
		if (row.price === null) return false;
		if (f.priceMin !== null && row.price < f.priceMin) return false;
		if (f.priceMax !== null && row.price > f.priceMax) return false;
	}

	if (f.beds !== 'any') {
		if (row.bedrooms === null) return false;
		if (f.beds === '4+' ? row.bedrooms < 4 : row.bedrooms !== f.beds) return false;
	}

	if (f.types.length > 0) {
		if (row.propertyType === null) return false;
		if (!(f.types as readonly string[]).includes(row.propertyType)) return false;
	}

	if (f.listedWithin !== 'any') {
		if (row.listedDate === null) return false;
		const days = utcDayDiff(now, row.listedDate);
		if (!(days <= f.listedWithin)) return false; // NaN (unparseable) is excluded too
	}
	return true;
}

/** Matching rows in input order. Pure and idempotent; the input is never mutated. */
export function applyFilters<T extends RentalRowLike>(
	rows: readonly T[],
	f: RentalFilters,
	now: Date
): T[] {
	return rows.filter((r) => matchRental(r, f, now));
}

/** A response at the row cap may have been cut off; offer the narrow request. */
export function isTruncated(rows: readonly unknown[]): boolean {
	return rows.length >= SEARCH_LIMIT;
}

/** True when any filter differs from DEFAULT_FILTERS. */
export function hasLocalFilters(f: RentalFilters): boolean {
	return (
		f.priceMin !== DEFAULT_FILTERS.priceMin ||
		f.priceMax !== DEFAULT_FILTERS.priceMax ||
		f.beds !== DEFAULT_FILTERS.beds ||
		f.types.length > 0 ||
		f.listedWithin !== DEFAULT_FILTERS.listedWithin
	);
}
