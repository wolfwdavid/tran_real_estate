// Renter search domain types (RENT-01). One wide request per location, every filter applied
// locally. Every later renter module imports these shapes.
import type { Listing } from '../listings/types.js';

/** RentCast's per-request row cap; a response this long may be truncated. */
export const SEARCH_LIMIT = 500;

/** Property types a renter can pick, in UI order (06-UI-SPEC). 'Land' is never offered. */
export const RENTER_PROPERTY_TYPES = [
	'Apartment',
	'Single Family',
	'Condo',
	'Townhouse',
	'Multi-Family',
	'Manufactured'
] as const;
export type RenterPropertyType = (typeof RENTER_PROPERTY_TYPES)[number];

/** 0 = studio; 1/2/3 match exactly; '4+' means four or more. */
export type BedsFilter = 'any' | 0 | 1 | 2 | 3 | '4+';

export const LISTED_WITHIN = [7, 14, 30, 60] as const;
export type ListedWithin = 'any' | (typeof LISTED_WITHIN)[number];

export type RenterLocation =
	{ kind: 'zip'; zipCode: string } | { kind: 'city'; city: string; state: string };

export interface RentalFilters {
	priceMin: number | null;
	priceMax: number | null;
	beds: BedsFilter;
	types: readonly RenterPropertyType[];
	listedWithin: ListedWithin;
}

export const DEFAULT_FILTERS: RentalFilters = Object.freeze({
	priceMin: null,
	priceMax: null,
	beds: 'any',
	types: Object.freeze([]) as readonly RenterPropertyType[],
	listedWithin: 'any'
});

export interface RentalQuery {
	location: RenterLocation;
	filters: RentalFilters;
}

/**
 * Structural subset of Phase 4's mapped listing row (`Listing` in `@tran/core/listings`). Field
 * names equal Phase 4's domain row exactly; the assertion below fails to compile if they drift.
 */
export interface RentalRowLike {
	id: string;
	price: number | null;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFootage: number | null;
	propertyType: string | null;
	listedDate: string | null;
	lastSeenDate: string | null;
	daysOnMarket: number | null;
	status: string | null;
	removedDate?: string | null;
}

export type LocationError = 'empty' | 'city-without-state' | 'bad-zip' | 'unrecognized';

// Compile-time guard: a Phase 4 Listing must be usable wherever a RentalRowLike is expected.
type Assert<T extends true> = T;
export type _ListingIsRentalRow = Assert<Listing extends RentalRowLike ? true : false>;
