// Listings request builders (DATA-04: identical intent → identical cheap request).
// A search carries only location + status=Active + limit + offset; filters are applied locally by
// `filterListings`. Only the explicit "Narrow on RentCast (1 call)" path adds RentCast filter
// params, using its `min:max` range syntax (`*` = open end) and multi-value arrays (sent as
// pipe-joined values by the client).
//
// These request shapes are declared locally (not imported from ../request) so this module stays
// independent of the gateway's request module; they are structurally assignable to its DataRequest.
import type { NormalizedLocation } from '../location/normalize.js';
import { hasActiveFilters, type ListingFilters } from './filter.js';

export type ListingsEndpoint = 'rental-listings' | 'sale-listings';

export type RequestParamValue = string | number | readonly (string | number)[];

export interface ListingsRequest {
	readonly endpoint: ListingsEndpoint;
	readonly params: Readonly<Record<string, RequestParamValue>>;
}

export interface ListingByIdRequest {
	readonly endpoint: 'rental-listing-by-id';
	readonly params: { readonly id: string };
}

/** RentCast's maximum page size; one search = one call = up to this many rows. */
export const LISTINGS_LIMIT = 500;

function range(min: number | undefined, max: number | undefined): string | null {
	if (min === undefined && max === undefined) return null;
	return `${min ?? '*'}:${max ?? '*'}`;
}

/** Translate local filters into RentCast query params for the explicit narrow path. */
export function toRentCastFilterParams(
	filters: ListingFilters
): Record<string, string | readonly string[]> {
	const out: Record<string, string | readonly string[]> = {};
	const price = range(filters.minPrice, filters.maxPrice);
	if (price) out.price = price;
	const bedrooms = range(filters.minBedrooms, filters.maxBedrooms);
	if (bedrooms) out.bedrooms = bedrooms;
	const bathrooms = range(filters.minBathrooms, undefined);
	if (bathrooms) out.bathrooms = bathrooms;
	if (filters.propertyTypes?.length) out.propertyType = [...filters.propertyTypes].sort();
	const daysOld = range(undefined, filters.listedWithinDays);
	if (daysOld) out.daysOld = daysOld;
	return out;
}

/**
 * Fetch-wide search request for a normalized location. Pass `narrow` only for the explicit
 * "Narrow on RentCast (1 call)" action after a truncated result.
 */
export function buildListingsRequest(
	location: NormalizedLocation,
	endpoint: ListingsEndpoint,
	narrow?: ListingFilters
): ListingsRequest {
	const where: Record<string, string> =
		location.kind === 'zip'
			? { zipCode: location.zipCode }
			: { city: location.city, state: location.state };
	return {
		endpoint,
		params: {
			...where,
			status: 'Active',
			limit: LISTINGS_LIMIT,
			offset: 0,
			...(narrow ? toRentCastFilterParams(narrow) : {})
		}
	};
}

export function buildListingByIdRequest(id: string): ListingByIdRequest {
	const trimmed = id.trim();
	if (trimmed === '') throw new RangeError('Listing id must be a non-empty string');
	return { endpoint: 'rental-listing-by-id', params: { id: trimmed } };
}

/**
 * RentCast does not expose X-Total-Count to the browser (04-RESEARCH Pitfall 7), so a page that
 * comes back exactly full is treated as truncated.
 */
export const isTruncated = (rowCount: number, limit: number = LISTINGS_LIMIT): boolean =>
	rowCount === limit;

/** Offer "Narrow on RentCast (1 call)" only when the result was cut off and filters exist. */
export function shouldOfferNarrow(truncated: boolean, filters: ListingFilters): boolean {
	return truncated && hasActiveFilters(filters);
}
