// RED placeholder; implemented in the GREEN commit.
import type { PriceToRent, RentTrend } from './types.js';

export function timeRangeLine(_months: string[]): string {
	throw new Error('not implemented');
}
export function rentTrendSummary(
	_zip: string,
	_t: RentTrend,
	_opts?: { sample?: boolean }
): string {
	throw new Error('not implemented');
}
export function priceToRentSummary(
	_zip: string,
	_p: PriceToRent,
	_opts?: { sample?: boolean }
): string {
	throw new Error('not implemented');
}
export function fewListingsSuffix(_count: number | null): string {
	throw new Error('not implemented');
}
