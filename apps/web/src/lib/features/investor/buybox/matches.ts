// Buy-box matches (INV-04): local filtering of the cached for-sale listings by the buy box's
// criteria, newest listed first, "new since last visit" flags, and quick metrics grouped by the
// user's targets.
//
// ZERO calls by construction (RESEARCH Pitfall 8: "A city buy-box spans many zips, so auto-fetching
// would burn the budget"). Listings come from the investor port's peekSaleListings and rents from
// the markets port's peek of ZIP stats that are ALREADY cached. ZIPs without cached stats are
// returned in zipsNeedingStats for an explicit "Load ZIP rents" action (07-18); this module never
// fetches them. Matches below the targets are grouped separately, never dropped.
import {
	meetsTargets,
	quickMetrics,
	type BuyBoxTargets,
	type QuickMetrics
} from '@tran/core/finance';
import type { MarketStatsInput } from '@tran/core/markets';
import type { MarketsPort } from '$lib/features/shared/markets/markets-port';
import type { InvestorDataPort, SaleListing } from '../data/investor-port';
import type { BuyBoxCriteria, BuyBoxInput, BuyBoxView } from './buyBoxRepo';

export interface MatchRow {
	listing: SaleListing;
	isNew: boolean;
	/** null when the listing's ZIP has no cached stats (or no usable rent). */
	quick: QuickMetrics | null;
	/** meetsTargets: null = not enough data (kept with the matches, never "below"). */
	meets: boolean | null;
}

export interface MatchGroups {
	meeting: MatchRow[];
	below: MatchRow[];
	/** Distinct ZIPs, in first-seen order, whose stats are not cached. */
	zipsNeedingStats: string[];
}

export interface LoadedMatches extends MatchGroups {
	/** The cached result was a full 500-row window: there may be more listings. */
	truncated: boolean;
	/** False when the box was never checked and nothing is cached for its location. */
	checked: boolean;
}

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

const hasTargets = (t: BuyBoxTargets) => t.minCapRatePct !== null || t.minRentToPricePct !== null;

/**
 * Filters, flags and scores the listings. A ZIP whose map entry is missing or null has no cached
 * stats: its rows get quick/meets null and the ZIP is listed once in zipsNeedingStats.
 */
export function buildMatches(
	box: BuyBoxInput,
	listings: readonly SaleListing[],
	newIds: ReadonlySet<string>,
	statsByZip: ReadonlyMap<string, MarketStatsInput | null>
): MatchGroups {
	const out: MatchGroups = { meeting: [], below: [], zipsNeedingStats: [] };
	const needing = new Set<string>();
	const targeted = hasTargets(box.targets);
	for (const listing of filterListings(listings, box.criteria)) {
		const stats = statsByZip.get(listing.zip) ?? null;
		if (stats === null && !needing.has(listing.zip)) {
			needing.add(listing.zip);
			out.zipsNeedingStats.push(listing.zip);
		}
		const quick = stats
			? quickMetrics(
					{ priceCents: listing.priceCents, bedrooms: listing.bedrooms },
					stats,
					box.expenseBps
				)
			: null;
		const meets = stats ? meetsTargets(quick, box.targets) : null;
		const row: MatchRow = { listing, isNew: newIds.has(listing.id), quick, meets };
		(targeted && meets === false ? out.below : out.meeting).push(row);
	}
	return out;
}

export interface LoadMatchesDeps {
	investor: Pick<InvestorDataPort, 'peekSaleListings'>;
	markets: Pick<MarketsPort, 'peek'>;
	/** The box's new-since-last-visit ids (buyBoxRepo.newMatchIds), read before markSeen. */
	newIds?: ReadonlySet<string>;
}

/** Peek only (0 calls): the cached listings for the box's location and cached stats per ZIP. */
export async function loadMatches(box: BuyBoxView, deps: LoadMatchesDeps): Promise<LoadedMatches> {
	const cached = await deps.investor.peekSaleListings(box.criteria.location);
	const listings = cached?.listings ?? [];
	const zips = [...new Set(filterListings(listings, box.criteria).map((l) => l.zip))];
	const statsByZip = new Map<string, MarketStatsInput | null>();
	for (const zip of zips) {
		// A cached error (e.g. no data for this ZIP) reads as "not loaded"; peek never spends.
		const r = await deps.markets.peek(zip).catch(() => undefined);
		statsByZip.set(zip, r?.stats ?? null);
	}
	return {
		...buildMatches(box, listings, deps.newIds ?? new Set(), statsByZip),
		truncated: cached?.truncated ?? false,
		checked: box.lastRunAt !== null || cached !== undefined
	};
}
