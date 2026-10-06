// Buy-box matches (INV-04): local filtering of the cached for-sale listings by the buy box's
// criteria, newest listed first, plus "new since last visit" flags.
import type { SaleListing } from '../data/investor-port';
import type { BuyBoxCriteria } from './buyBoxRepo';

const inRange = (v: number, min: number | null, max: number | null) =>
	(min === null || v >= min) && (max === null || v <= max);

/**
 * Price within [min, max] (null = open bound), bedrooms at least minBeds (Any keeps unknown
 * bedrooms; a minimum excludes them), type in the list ([] = any). Sorted by listedAt descending,
 * unknown dates last, then by id for a stable order.
 */
export function filterListings(listings: readonly SaleListing[], c: BuyBoxCriteria): SaleListing[] {
	const types = new Set<string>(c.propertyTypes);
	return listings
		.filter(
			(l) =>
				inRange(l.priceCents, c.minPriceCents, c.maxPriceCents) &&
				(c.minBeds === 0 || (l.bedrooms !== null && l.bedrooms >= c.minBeds)) &&
				(types.size === 0 || (l.propertyType !== null && types.has(l.propertyType)))
		)
		.sort(
			(a, b) =>
				(b.listedAt ?? -Infinity) - (a.listedAt ?? -Infinity) ||
				(a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
		);
}
