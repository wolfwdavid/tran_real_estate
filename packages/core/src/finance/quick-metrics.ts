// Buy-box quick metrics (INV-04). Zero data calls by construction: the only rent source is the
// ZIP market stats the caller already holds (cached), read through zipMedianRentForBeds. Ratios are
// null, never NaN, when the price or rent cannot support them.
//
// Estimated NOI = rent − expense set-aside (default BUY_BOX_EXPENSE_BPS = 40% of rent). The
// set-aside stands for the whole operating-expense load, so a listing's HOA is not added on top.

import { monthYear, pctTrim, usd } from '../format/index.js';
import { zipMedianRentForBeds } from '../markets/series.js';
import type { MarketStatsInput } from '../markets/types.js';
import { BUY_BOX_EXPENSE_BPS } from './defaults.js';
import { mulBps } from './money.js';

export interface QuickMetricsListing {
	priceCents: number;
	bedrooms: number | null;
}

export interface QuickMetrics {
	/** Whole-dollar ZIP median rent, in cents. */
	rentCents: number;
	rentToPricePct: number | null;
	grm: number | null;
	estCapRatePct: number | null;
	basis: 'bedrooms' | 'all';
	/** 'YYYY-MM' of the median used, when known. */
	month: string | null;
	listings: number | null;
	expenseBps: number;
}

export function quickMetrics(
	listing: QuickMetricsListing,
	stats: MarketStatsInput | null,
	expenseBps: number = BUY_BOX_EXPENSE_BPS
): QuickMetrics | null {
	if (!stats) return null;
	const median = zipMedianRentForBeds(stats, listing.bedrooms);
	if (!median || !Number.isFinite(median.rentDollars) || median.rentDollars <= 0) return null;

	const rentCents = Math.round(median.rentDollars) * 100;
	const price = listing.priceCents;
	const priced = Number.isFinite(price) && price > 0;
	const annualRent = rentCents * 12;
	const noiAnnual = (rentCents - mulBps(rentCents, expenseBps)) * 12;

	return {
		rentCents,
		rentToPricePct: priced ? (rentCents * 100) / price : null,
		grm: priced && annualRent > 0 ? price / annualRent : null,
		estCapRatePct: priced ? (noiAnnual * 100) / price : null,
		basis: median.basis,
		month: median.month,
		listings: median.listings,
		expenseBps
	};
}

export interface BuyBoxTargets {
	minCapRatePct: number | null;
	minRentToPricePct: number | null;
}

/**
 * True when every set target is reached (or none is set). Null when a target is set but the value
 * it needs is unavailable, so the UI can say "not enough data" instead of a false "no".
 */
export function meetsTargets(q: QuickMetrics | null, t: BuyBoxTargets): boolean | null {
	const checks: [number, number | null][] = [];
	if (t.minCapRatePct !== null) checks.push([t.minCapRatePct, q?.estCapRatePct ?? null]);
	if (t.minRentToPricePct !== null) checks.push([t.minRentToPricePct, q?.rentToPricePct ?? null]);
	if (checks.length === 0) return true;
	if (checks.some(([, v]) => v === null)) return null;
	return checks.every(([min, v]) => (v as number) >= min);
}

function homesFor(basis: QuickMetrics['basis'], beds: number | null): string {
	if (basis === 'all' || beds === null) return 'all homes';
	if (beds === 0) return 'studios';
	if (beds >= 4) return 'homes with 4 or more bedrooms';
	return `${beds}-bedroom homes`;
}

/** The provenance sentence shown under a buy-box match's quick metrics. */
export function quickBasisLine(q: QuickMetrics, beds: number | null): string {
	const asOf = q.month ? ` as of ${monthYear(q.month)}` : '';
	const count =
		q.listings === null ? '' : ` (${q.listings} ${q.listings === 1 ? 'listing' : 'listings'})`;
	return (
		`Quick metrics use the ZIP's median rent for ${homesFor(q.basis, beds)}, ` +
		`${usd(q.rentCents)} a month${asOf}${count}, and set aside ${pctTrim(q.expenseBps)} of rent ` +
		'for expenses. Deep analyze looks up estimates for this exact home.'
	);
}
