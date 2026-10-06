// RED placeholder; implemented in the GREEN commit.
import type { MarketStatsInput, PriceToRent, RentTrend } from './types.js';

export function monthRange(_keys: string[]): string[] {
	throw new Error('not implemented');
}
export function rentTrendSeries(_stats: MarketStatsInput): RentTrend {
	throw new Error('not implemented');
}
export function priceToRentSeries(_stats: MarketStatsInput): PriceToRent {
	throw new Error('not implemented');
}
export function hasEnoughData(_points: (number | null)[][]): boolean {
	throw new Error('not implemented');
}
export function currentStats(_stats: MarketStatsInput): {
	medianRent: number | null;
	medianPrice: number | null;
	priceToRent: number | null;
	listings: number | null;
	lastUpdated: string | null;
} {
	throw new Error('not implemented');
}
export function zipMedianRentForBeds(
	_stats: MarketStatsInput,
	_beds: number | null
): {
	rentDollars: number;
	basis: 'bedrooms' | 'all';
	month: string | null;
	listings: number | null;
} | null {
	throw new Error('not implemented');
}
