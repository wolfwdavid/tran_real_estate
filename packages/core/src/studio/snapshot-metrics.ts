/**
 * Market Snapshot math (STU-04). Every number a Market Snapshot shows is computed here from the
 * Phase 4 RentCast market statistics; the AI market notes only narrate these figures.
 *
 * Honesty rules:
 * - A missing, zero, negative or non-finite input yields null (rendered as an em dash), never
 *   NaN, 0 or Infinity.
 * - Price-to-rent uses the Phase 7 formula (median price / (median rent x 12)) via
 *   `currentStats`, rounded to 1 decimal.
 * - Days on market is RentCast's MEDIAN days on market, rounded to whole days. The mean is never
 *   substituted, because the report labels the figure as a median.
 * - The active listings summary is aggregates only (Pitfall 8: a snapshot must never advertise
 *   another broker's listing). Rows are built from scratch with whitelisted keys; no listing
 *   object is ever spread or copied, so no address, photo, agent, office, MLS or id can leak.
 */

import type { Listing, MarketSide, MarketStats } from '../listings/types.js';
import { currentStats } from '../markets/series.js';

export interface BedroomRent {
	beds: number;
	median: number | null;
	listings: number | null;
}

export interface SnapshotMetrics {
	zip: string;
	lastUpdated: string | null;
	medianRent: number | null;
	medianPrice: number | null;
	/** Median price / (median rent x 12), 1 decimal. */
	priceToRent: number | null;
	/** Percent change of the monthly median rent over the history window, 1 decimal. */
	rentChangePct: number | null;
	/** 'YYYY-MM' of the first and last months the change is measured between. */
	rentChangeFrom: string | null;
	rentChangeTo: string | null;
	/** Months of rental history in the window. */
	months: number;
	saleDom: number | null;
	rentalDom: number | null;
	saleTotal: number | null;
	saleNew: number | null;
	rentalTotal: number | null;
	rentalNew: number | null;
	/** Ascending beds; beds >= 4 collapsed into one row with beds 4 ("4+ bedrooms"). */
	rentByBedroom: BedroomRent[];
}

export interface BedroomAggregate {
	beds: number;
	count: number;
	min: number;
	max: number;
	median: number;
	medianDom: number | null;
}

export interface AggregatedSample {
	kind: 'sale' | 'rental';
	seenAt: string;
	total: number;
	byBedroom: BedroomAggregate[];
}

/** The ONLY keys an AggregatedSample may carry, in order. */
export const AGGREGATED_SAMPLE_KEYS = ['kind', 'seenAt', 'total', 'byBedroom'] as const;
/** The ONLY keys a BedroomAggregate row may carry, in order. */
export const BEDROOM_AGGREGATE_KEYS = [
	'beds',
	'count',
	'min',
	'max',
	'median',
	'medianDom'
] as const;

const isPos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const round1 = (x: number): number => Math.round(x * 10) / 10;
const count = (v: unknown): number | null => (isCount(v) ? Math.round(v) : null);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 0 'Studio', 1 '1 bedroom', 2-3 '{n} bedrooms', >= 4 '4+ bedrooms'. */
export function bedroomLabel(beds: number): string {
	if (beds <= 0) return 'Studio';
	if (beds === 1) return '1 bedroom';
	if (beds >= 4) return '4+ bedrooms';
	return `${beds} bedrooms`;
}

/** Rent change over the window: first and last months with a usable median, ascending. */
function rentChange(rental: MarketSide | null): {
	pct: number | null;
	from: string | null;
	to: string | null;
	months: number;
} {
	const points = (rental?.history ?? [])
		.filter((h) => MONTH_RE.test(h.month))
		.slice()
		.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
	const months = new Set(points.map((p) => p.month)).size;
	const usable = points.filter((p): p is typeof p & { median: number } => isPos(p.median));
	const first = usable[0];
	const last = usable[usable.length - 1];
	if (usable.length < 2 || first.month === last.month) {
		return { pct: null, from: null, to: null, months };
	}
	const pct = round1(((last.median - first.median) / first.median) * 100);
	return {
		pct: Number.isFinite(pct) ? pct + 0 : null,
		from: first.month,
		to: last.month,
		months
	};
}

/**
 * The 4+ row. Listings are summed; the median is the listing-weighted median of the collapsed
 * rows: rows sorted by median, the value of the row that holds the middle listing. When any count
 * is unknown the 4-bedroom row is used alone (else the smallest bedroom count present).
 */
function collapseFourPlus(rows: readonly BedroomRent[]): BedroomRent | null {
	if (rows.length === 0) return null;
	const known = rows.every((r) => r.listings !== null);
	if (known) {
		const listings = rows.reduce((s, r) => s + (r.listings as number), 0);
		const priced = rows
			.filter((r): r is BedroomRent & { median: number } => r.median !== null)
			.sort((a, b) => a.median - b.median);
		const pricedTotal = priced.reduce((s, r) => s + (r.listings as number), 0);
		let median: number | null = null;
		if (pricedTotal > 0) {
			const mid = pricedTotal / 2;
			let seen = 0;
			for (const r of priced) {
				seen += r.listings as number;
				if (seen >= mid) {
					median = r.median;
					break;
				}
			}
		} else if (priced.length > 0) {
			median = priced[0].median;
		}
		return { beds: 4, median, listings };
	}
	const base = rows.find((r) => r.beds === 4) ?? [...rows].sort((a, b) => a.beds - b.beds)[0];
	return { beds: 4, median: base.median, listings: base.listings };
}

function rentByBedroom(rental: MarketSide | null): BedroomRent[] {
	const rows: BedroomRent[] = [];
	for (const b of rental?.byBedrooms ?? []) {
		if (typeof b.bedrooms !== 'number' || !Number.isInteger(b.bedrooms) || b.bedrooms < 0) continue;
		rows.push({
			beds: b.bedrooms,
			median: isPos(b.median) ? Math.round(b.median) : null,
			listings: count(b.totalListings)
		});
	}
	const small = rows.filter((r) => r.beds < 4).sort((a, b) => a.beds - b.beds);
	const four = collapseFourPlus(rows.filter((r) => r.beds >= 4));
	return four ? [...small, four] : small;
}

/** Every Market Snapshot figure, computed in core and frozen into the snapshot record. */
export function buildSnapshotMetrics(m: MarketStats): SnapshotMetrics {
	const rental = m.rental ?? null;
	const sale = m.sale ?? null;
	const current = currentStats({
		zipCode: m.zipCode,
		rentalData: rental ? { medianRent: rental.median } : null,
		saleData: sale ? { medianPrice: sale.median } : null
	});
	const change = rentChange(rental);
	return {
		zip: m.zipCode,
		lastUpdated: rental?.lastUpdatedDate ?? sale?.lastUpdatedDate ?? null,
		medianRent: current.medianRent,
		medianPrice: current.medianPrice,
		priceToRent: current.priceToRent === null ? null : round1(current.priceToRent),
		rentChangePct: change.pct,
		rentChangeFrom: change.from,
		rentChangeTo: change.to,
		months: change.months,
		saleDom: count(sale?.medianDaysOnMarket),
		rentalDom: count(rental?.medianDaysOnMarket),
		saleTotal: count(sale?.totalListings),
		saleNew: count(sale?.newListings),
		rentalTotal: count(rental?.totalListings),
		rentalNew: count(rental?.newListings),
		rentByBedroom: rentByBedroom(rental)
	};
}

/** Median of a non-empty ascending list, rounded to a whole number. */
function medianOf(sorted: readonly number[]): number {
	const mid = Math.floor(sorted.length / 2);
	const v = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	return Math.round(v);
}

/**
 * The aggregate-only active listings summary: counts, whole-dollar price ranges, medians and
 * median days on market by bedroom count (beds >= 4 grouped as 4). Listings of the other kind or
 * without a usable price are skipped. Listings with unknown bedrooms count toward `total` only.
 */
export function aggregateListings(
	listings: readonly Listing[],
	kind: 'sale' | 'rental',
	seenAt: string
): AggregatedSample {
	const prices = new Map<number, number[]>();
	const doms = new Map<number, number[]>();
	let total = 0;
	for (const l of listings) {
		if (l.kind !== kind || !isPos(l.price)) continue;
		total++;
		const beds = l.bedrooms;
		if (typeof beds !== 'number' || !Number.isFinite(beds) || beds < 0) continue;
		const key = Math.min(Math.floor(beds), 4);
		const p = prices.get(key) ?? [];
		p.push(l.price);
		prices.set(key, p);
		const d = doms.get(key) ?? [];
		if (isCount(l.daysOnMarket)) d.push(l.daysOnMarket);
		doms.set(key, d);
	}
	const byBedroom: BedroomAggregate[] = [...prices.keys()]
		.sort((a, b) => a - b)
		.map((beds) => {
			const p = [...(prices.get(beds) as number[])].sort((a, b) => a - b);
			const d = [...(doms.get(beds) ?? [])].sort((a, b) => a - b);
			return {
				beds,
				count: p.length,
				min: Math.round(p[0]),
				max: Math.round(p[p.length - 1]),
				median: medianOf(p),
				medianDom: d.length > 0 ? medianOf(d) : null
			};
		});
	return { kind, seenAt, total, byBedroom };
}
