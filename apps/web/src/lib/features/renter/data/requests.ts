// Every RentCast request the renter portal makes is built here (06-RESEARCH: a renter task that
// starts writing a fetch, a cache or a request shape elsewhere is in the wrong layer). These are
// pure descriptions; only the gateway (through $lib/data) decides whether one costs a call.
import type { DataRequest } from '$lib/data';
import {
	DEFAULT_FILTERS,
	toServerParams,
	type RentalFilters,
	type RenterLocation
} from '@tran/core/renter';

/** Comparables asked for with a rent estimate (fair-rent check, RENT-03). */
export const RENT_ESTIMATE_COMPS = 15;

/**
 * The rentals search for one location. 'wide' (default) is location + Active + limit 500 and
 * ignores the filters, so its cache key is the same for every filter set; filters then apply
 * locally for free. 'narrow' pushes the filters server-side (offered only for a truncated result).
 */
export function searchRequest(
	location: RenterLocation,
	filters: RentalFilters = DEFAULT_FILTERS,
	mode: 'wide' | 'narrow' = 'wide'
): DataRequest {
	return { endpoint: 'rental-listings', params: toServerParams(location, filters, mode) };
}

/** One rental listing by its RentCast id (the id is percent-encoded into the path by core). */
export function listingByIdRequest(id: string): DataRequest {
	return { endpoint: 'rental-listing-by-id', params: { id } };
}

/**
 * ZIP market statistics. Identical to Phase 7's watched-ZIP request so one 30-day cache entry
 * serves both portals: canonical key `markets?dataType=All&historyRange=24&zipCode=<zip>`.
 */
export function marketsRequest(zip: string): DataRequest {
	return { endpoint: 'markets', params: { zipCode: zip, dataType: 'All', historyRange: 24 } };
}

/** The listing facts a rent estimate is keyed on (a structural subset of the mapped Listing). */
export interface RentEstimateSubject {
	formattedAddress: string;
	propertyType: string | null;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFootage: number | null;
}

/** Rent estimate (AVM) for a listing, with 15 comparables. Unknown (null) facts are omitted. */
export function rentEstimateRequest(row: RentEstimateSubject): DataRequest {
	const params: Record<string, string | number> = { address: row.formattedAddress };
	if (row.propertyType !== null) params.propertyType = row.propertyType;
	if (row.bedrooms !== null) params.bedrooms = row.bedrooms;
	if (row.bathrooms !== null) params.bathrooms = row.bathrooms;
	if (row.squareFootage !== null) params.squareFootage = row.squareFootage;
	params.compCount = RENT_ESTIMATE_COMPS;
	return { endpoint: 'rent-estimate', params };
}
