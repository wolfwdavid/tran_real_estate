/**
 * Structural input and output shapes for the watched-ZIP market dashboards (INV-05).
 *
 * The input mirrors RentCast's market-statistics payload (values in DOLLARS, history records
 * keyed 'YYYY-MM'). It is structural on purpose: the web markets port maps the Phase 4 domain
 * object into it, so this module never depends on Phase 4's exact type names.
 */

export interface BedroomStat {
	bedrooms: number;
	medianRent?: number | null;
	medianPrice?: number | null;
	totalListings?: number | null;
}

export interface RentalMonth {
	medianRent?: number | null;
	totalListings?: number | null;
	dataByBedrooms?: BedroomStat[];
}

export interface SaleMonth {
	medianPrice?: number | null;
	totalListings?: number | null;
}

export interface MarketStatsInput {
	zipCode: string;
	rentalData?: {
		medianRent?: number | null;
		totalListings?: number | null;
		lastUpdatedDate?: string | null;
		dataByBedrooms?: BedroomStat[];
		history?: Record<string, RentalMonth>;
	} | null;
	saleData?: {
		medianPrice?: number | null;
		totalListings?: number | null;
		lastUpdatedDate?: string | null;
		history?: Record<string, SaleMonth>;
	} | null;
}

export type SeriesKey = 'studio' | '1' | '2' | '3' | '4plus';

/** Series in drawing order. */
export const SERIES_KEYS: readonly SeriesKey[] = ['studio', '1', '2', '3', '4plus'];

export const SERIES_LABELS: Record<SeriesKey, string> = {
	studio: 'Studio',
	'1': '1 bedroom',
	'2': '2 bedrooms',
	'3': '3 bedrooms',
	'4plus': '4+ bedrooms'
};

/** One bedroom-count series; `points` and `counts` are aligned to `RentTrend.months`. */
export interface RentSeries {
	key: SeriesKey;
	label: string;
	/** Median rent in whole dollars, or null for a missing month (a gap, never zero). */
	points: (number | null)[];
	/** totalListings behind each point, or null when unknown. */
	counts: (number | null)[];
}

export interface RentTrend {
	/** Continuous 'YYYY-MM' months, ascending, no gaps. */
	months: string[];
	/** Only series with at least one data point over the whole range. */
	series: RentSeries[];
}

export interface PriceToRent {
	months: string[];
	points: (number | null)[];
}
