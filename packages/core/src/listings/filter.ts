// Local listing filters (04-RESEARCH Pattern 1 "fetch wide, filter local"). A search fetches up to
// LISTINGS_LIMIT active rows once; price/beds/baths/type/listed-within changes re-run this pure
// function and cost 0 calls. `now` is injected so results are deterministic and testable.
import type { Listing, PropertyType } from './types.js';

export interface ListingFilters {
	minPrice?: number;
	maxPrice?: number;
	minBedrooms?: number;
	maxBedrooms?: number;
	minBathrooms?: number;
	propertyTypes?: readonly PropertyType[];
	listedWithinDays?: number;
}

export type FilterableListing = Pick<
	Listing,
	'price' | 'bedrooms' | 'bathrooms' | 'propertyType' | 'listedDate'
>;

const DAY_MS = 86_400_000;

/** True when at least one filter would constrain the result. */
export function hasActiveFilters(filters: ListingFilters): boolean {
	return (
		filters.minPrice !== undefined ||
		filters.maxPrice !== undefined ||
		filters.minBedrooms !== undefined ||
		filters.maxBedrooms !== undefined ||
		filters.minBathrooms !== undefined ||
		filters.listedWithinDays !== undefined ||
		(filters.propertyTypes?.length ?? 0) > 0
	);
}

function inRange(value: number | null, min?: number, max?: number): boolean {
	if (min === undefined && max === undefined) return true;
	if (value === null) return false;
	return (min === undefined || value >= min) && (max === undefined || value <= max);
}

/**
 * Filter rows locally. Bounds are inclusive; a row with a null value for a constrained field is
 * excluded. Returns a new array in input order; the input is never mutated.
 */
export function filterListings<T extends FilterableListing>(
	rows: readonly T[],
	filters: ListingFilters,
	now: number
): T[] {
	const types = filters.propertyTypes?.length ? new Set(filters.propertyTypes) : null;
	const listedAfter =
		filters.listedWithinDays === undefined ? null : now - filters.listedWithinDays * DAY_MS;

	return rows.filter((r) => {
		if (!inRange(r.price, filters.minPrice, filters.maxPrice)) return false;
		if (!inRange(r.bedrooms, filters.minBedrooms, filters.maxBedrooms)) return false;
		if (!inRange(r.bathrooms, filters.minBathrooms)) return false;
		if (types && !types.has(r.propertyType)) return false;
		if (listedAfter !== null) {
			if (r.listedDate === null) return false;
			const listed = Date.parse(r.listedDate);
			if (Number.isNaN(listed) || listed < listedAfter) return false;
		}
		return true;
	});
}
