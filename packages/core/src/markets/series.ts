/**
 * Market-statistics series math for the watched-ZIP dashboards (INV-05) and buy-box quick metrics.
 *
 * Honesty rules (07-CONTEXT, 07-UI-SPEC ChartFigure):
 * - Months are a continuous 'YYYY-MM' range; a month with no data is a `null` gap, never 0 and
 *   never interpolated.
 * - A series with no data over the whole range is omitted.
 * - Price-to-rent = median (asking) sale price / (median rent * 12); null when either is missing.
 *
 * Plain integer month arithmetic only: no Date objects, so no timezone drift.
 */

import { SERIES_KEYS, SERIES_LABELS } from './types.js';
import type {
	BedroomStat,
	MarketStatsInput,
	PriceToRent,
	RentSeries,
	RentTrend,
	SeriesKey
} from './types.js';

const YM_RE = /^(\d{4})-(\d{2})$/;

/** A usable money value: finite and positive. Zero or negative medians are treated as missing. */
const isPos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 'YYYY-MM' -> months since year 0, or null when malformed. */
function toIndex(key: string): number | null {
	const m = YM_RE.exec(key);
	if (!m) return null;
	const month = Number(m[2]);
	if (month < 1 || month > 12) return null;
	return Number(m[1]) * 12 + (month - 1);
}

function fromIndex(i: number): string {
	const y = Math.floor(i / 12);
	const m = (i % 12) + 1;
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** Continuous inclusive month range from the smallest to the largest valid key. */
export function monthRange(keys: string[]): string[] {
	let lo = Infinity;
	let hi = -Infinity;
	for (const k of keys) {
		const i = toIndex(k);
		if (i === null) continue;
		if (i < lo) lo = i;
		if (i > hi) hi = i;
	}
	const out: string[] = [];
	for (let i = lo; i <= hi; i++) out.push(fromIndex(i));
	return out;
}

/**
 * The 4+ bucket for one month. RentCast reports 4, 5, 6… separately; when every entry at 4 or
 * more has a listing count, the bucket is the listings-weighted mean of their medians (rounded to
 * whole dollars) with the summed count. This is a documented approximation: a mean of medians is
 * not the median of the pooled listings. If any count is missing, the 4-bedroom entry is used
 * alone.
 */
function fourPlus(rows: readonly BedroomStat[]): { rent: number; count: number | null } | null {
	const big = rows.filter((r) => r.bedrooms >= 4 && isPos(r.medianRent));
	if (big.length === 0) return null;
	if (big.every((r) => isCount(r.totalListings))) {
		let listings = 0;
		let weighted = 0;
		for (const r of big) {
			listings += r.totalListings as number;
			weighted += (r.medianRent as number) * (r.totalListings as number);
		}
		if (listings > 0) return { rent: Math.round(weighted / listings), count: listings };
	}
	const four = big.find((r) => r.bedrooms === 4);
	return four ? { rent: four.medianRent as number, count: four.totalListings ?? null } : null;
}

/** Median rent and listings for one series key in one month's bedroom rows. */
function bucketFor(
	rows: readonly BedroomStat[] | undefined,
	key: SeriesKey
): { rent: number; count: number | null } | null {
	if (!rows || rows.length === 0) return null;
	if (key === '4plus') return fourPlus(rows);
	const beds = key === 'studio' ? 0 : Number(key);
	const row = rows.find((r) => r.bedrooms === beds && isPos(r.medianRent));
	return row ? { rent: row.medianRent as number, count: row.totalListings ?? null } : null;
}

const keyForBeds = (beds: number): SeriesKey | null => {
	if (!Number.isInteger(beds) || beds < 0) return null;
	if (beds === 0) return 'studio';
	if (beds >= 4) return '4plus';
	return String(beds) as SeriesKey;
};

/** Rent by bedroom count per month, gaps as null, empty series omitted. */
export function rentTrendSeries(stats: MarketStatsInput): RentTrend {
	const history = stats.rentalData?.history ?? {};
	const months = monthRange(Object.keys(history));
	const series: RentSeries[] = [];
	for (const key of SERIES_KEYS) {
		const points: (number | null)[] = [];
		const counts: (number | null)[] = [];
		let any = false;
		for (const m of months) {
			const b = bucketFor(history[m]?.dataByBedrooms, key);
			points.push(b ? b.rent : null);
			counts.push(b ? b.count : null);
			if (b) any = true;
		}
		if (any) series.push({ key, label: SERIES_LABELS[key], points, counts });
	}
	return { months, series };
}

/** Price ÷ annual rent, or null when either side is missing or not positive. */
function ratioOf(price: unknown, rent: unknown): number | null {
	return isPos(price) && isPos(rent) ? price / (rent * 12) : null;
}

/** Monthly price-to-rent over the union of rental and sale months. */
export function priceToRentSeries(stats: MarketStatsInput): PriceToRent {
	const rent = stats.rentalData?.history ?? {};
	const sale = stats.saleData?.history ?? {};
	const months = monthRange([...Object.keys(rent), ...Object.keys(sale)]);
	const points = months.map((m) => ratioOf(sale[m]?.medianPrice, rent[m]?.medianRent));
	return { months, points };
}

/** True iff some series has at least 2 non-null points (enough to draw a line). */
export function hasEnoughData(points: (number | null)[][]): boolean {
	return points.some((s) => s.filter((p) => p !== null).length >= 2);
}

/** The latest top-level figures for stat summaries; never NaN. */
export function currentStats(stats: MarketStatsInput): {
	medianRent: number | null;
	medianPrice: number | null;
	priceToRent: number | null;
	listings: number | null;
	lastUpdated: string | null;
} {
	const r = stats.rentalData ?? null;
	const s = stats.saleData ?? null;
	const medianRent = isPos(r?.medianRent) ? r.medianRent : null;
	const medianPrice = isPos(s?.medianPrice) ? s.medianPrice : null;
	return {
		medianRent,
		medianPrice,
		priceToRent: ratioOf(medianPrice, medianRent),
		listings: isCount(r?.totalListings) ? r.totalListings : null,
		lastUpdated: r?.lastUpdatedDate ?? s?.lastUpdatedDate ?? null
	};
}

/**
 * ZIP median rent for quick metrics. Order: the latest month with a median for this bedroom count
 * (beds >= 4 use the 4+ rule), then the latest month's overall median, then the top-level median.
 * Null when no rent exists anywhere.
 */
export function zipMedianRentForBeds(
	stats: MarketStatsInput,
	beds: number | null
): {
	rentDollars: number;
	basis: 'bedrooms' | 'all';
	month: string | null;
	listings: number | null;
} | null {
	const rental = stats.rentalData;
	if (!rental) return null;
	const history = rental.history ?? {};
	const latestFirst = monthRange(Object.keys(history))
		.filter((m) => history[m] !== undefined)
		.reverse();

	const key = beds === null ? null : keyForBeds(beds);
	if (key !== null) {
		for (const m of latestFirst) {
			const b = bucketFor(history[m].dataByBedrooms, key);
			if (b) return { rentDollars: b.rent, basis: 'bedrooms', month: m, listings: b.count };
		}
	}
	for (const m of latestFirst) {
		const row = history[m];
		if (isPos(row.medianRent)) {
			return {
				rentDollars: row.medianRent,
				basis: 'all',
				month: m,
				listings: row.totalListings ?? null
			};
		}
	}
	if (isPos(rental.medianRent)) {
		return {
			rentDollars: rental.medianRent,
			basis: 'all',
			month: null,
			listings: rental.totalListings ?? null
		};
	}
	return null;
}
