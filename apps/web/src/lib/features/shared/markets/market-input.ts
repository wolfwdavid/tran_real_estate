// Phase 4 domain MarketStats -> the core chart input (MarketStatsInput) the Phase 7 ZipTrendChart /
// PriceToRentChart take. Dependency-free (types plus pure mapping, no $lib/data import), so a
// frozen Market Snapshot record and the built-in sample report can build chart series without
// loading the data layer. markets-port.ts re-exports it.
import type { MarketStatsInput } from '@tran/core/markets';
import type { MarketBreakdown, MarketSide, MarketStats } from '@tran/core/listings';

const bedroomStats = (rows: readonly MarketBreakdown[] | undefined, side: 'rent' | 'price') =>
	(rows ?? [])
		.filter((b): b is MarketBreakdown & { bedrooms: number } => b.bedrooms !== null)
		.map((b) =>
			side === 'rent'
				? { bedrooms: b.bedrooms, medianRent: b.median, totalListings: b.totalListings }
				: { bedrooms: b.bedrooms, medianPrice: b.median, totalListings: b.totalListings }
		);

function rentalInput(s: MarketSide | null): MarketStatsInput['rentalData'] {
	if (!s) return null;
	return {
		medianRent: s.median,
		totalListings: s.totalListings,
		lastUpdatedDate: s.lastUpdatedDate ?? null,
		dataByBedrooms: bedroomStats(s.byBedrooms, 'rent'),
		history: Object.fromEntries(
			s.history.map((h) => [
				h.month,
				{
					medianRent: h.median,
					totalListings: h.totalListings,
					dataByBedrooms: bedroomStats(h.byBedrooms, 'rent')
				}
			])
		)
	};
}

function saleInput(s: MarketSide | null): MarketStatsInput['saleData'] {
	if (!s) return null;
	return {
		medianPrice: s.median,
		totalListings: s.totalListings,
		lastUpdatedDate: s.lastUpdatedDate ?? null,
		history: Object.fromEntries(
			s.history.map((h) => [h.month, { medianPrice: h.median, totalListings: h.totalListings }])
		)
	};
}

/** Phase 4 domain MarketStats -> the core series input (dollars stay dollars). */
export function toMarketStatsInput(m: MarketStats): MarketStatsInput {
	return { zipCode: m.zipCode, rentalData: rentalInput(m.rental), saleData: saleInput(m.sale) };
}
