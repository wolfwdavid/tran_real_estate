// Normalized listing-domain rows. Live RentCast payloads and synthetic sample fixtures are both
// mapped into these types, so every portal renders one shape (DATA-01). Enum-like RentCast fields
// that arrive with an unknown value are normalized to 'Other' by the mappers (04-RESEARCH Pattern 9).

/** RentCast's case-sensitive `propertyType` values. */
export const PROPERTY_TYPES = [
	'Single Family',
	'Condo',
	'Townhouse',
	'Manufactured',
	'Multi-Family',
	'Apartment',
	'Land'
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number] | 'Other';

export interface ListingContact {
	name: string | null;
	phone: string | null;
	email: string | null;
	website: string | null;
}

export interface PriceEvent {
	date: string;
	event: string;
	price: number | null;
	/**
	 * When RentCast recorded this listing period as removed (YYYY-MM-DD or ISO), else null.
	 * Optional so hand-built rows still type-check; the mapper always sets it.
	 */
	removedDate?: string | null;
}

export interface Listing {
	id: string;
	kind: 'rental' | 'sale';
	formattedAddress: string;
	addressLine1: string | null;
	/** Unit or suite line. Optional so hand-built rows stay valid; the mapper always sets it. */
	addressLine2?: string | null;
	city: string | null;
	state: string | null;
	zipCode: string;
	latitude: number | null;
	longitude: number | null;
	propertyType: PropertyType;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFootage: number | null;
	yearBuilt: number | null;
	/** Monthly HOA fee in whole dollars. Optional so hand-built rows stay valid; the mapper sets it. */
	hoaFee?: number | null;
	price: number;
	status: 'Active' | 'Inactive' | 'Other';
	listingType: string | null;
	listedDate: string | null;
	removedDate: string | null;
	lastSeenDate: string | null;
	daysOnMarket: number | null;
	mlsName: string | null;
	mlsNumber: string | null;
	agent: ListingContact | null;
	office: ListingContact | null;
	history: PriceEvent[];
}

export interface Comparable {
	id: string;
	formattedAddress: string;
	price: number;
	distance: number | null;
	daysOld: number | null;
	correlation: number | null;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFootage: number | null;
	propertyType: PropertyType;
}

export interface RentEstimate {
	kind: 'rent';
	estimate: number;
	low: number | null;
	high: number | null;
	subjectAddress: string | null;
	comparables: Comparable[];
}

/** Sale-price estimate (RentCast's "value" AVM). */
export interface PriceEstimate {
	kind: 'price';
	estimate: number;
	low: number | null;
	high: number | null;
	subjectAddress: string | null;
	comparables: Comparable[];
}

export interface MarketBreakdown {
	bedrooms: number | null;
	propertyType: string | null;
	average: number | null;
	median: number | null;
	min: number | null;
	max: number | null;
	totalListings: number | null;
}

export interface MarketHistoryPoint {
	month: string;
	average: number | null;
	median: number | null;
	totalListings: number | null;
}

export interface MarketSide {
	average: number | null;
	median: number | null;
	min: number | null;
	max: number | null;
	averagePerSquareFoot: number | null;
	averageDaysOnMarket: number | null;
	newListings: number | null;
	totalListings: number | null;
	byBedrooms: MarketBreakdown[];
	byPropertyType: MarketBreakdown[];
	history: MarketHistoryPoint[];
	/** When RentCast last updated these stats (ISO). Optional so hand-built values stay valid. */
	lastUpdatedDate?: string | null;
}

export interface MarketStats {
	zipCode: string;
	sale: MarketSide | null;
	rental: MarketSide | null;
}
