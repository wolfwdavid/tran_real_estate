// RED placeholder: implemented in the GREEN step.
import type { DataRequest } from '$lib/data';
import type { RentalFilters, RenterLocation } from '@tran/core/renter';

export function searchRequest(
	_location: RenterLocation,
	_filters?: RentalFilters,
	_mode?: 'wide' | 'narrow'
): DataRequest {
	throw new Error('not implemented');
}
export function listingByIdRequest(_id: string): DataRequest {
	throw new Error('not implemented');
}
export function marketsRequest(_zip: string): DataRequest {
	throw new Error('not implemented');
}
export function rentEstimateRequest(_row: {
	formattedAddress: string;
	propertyType: string | null;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFootage: number | null;
}): DataRequest {
	throw new Error('not implemented');
}
