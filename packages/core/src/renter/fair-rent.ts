/**
 * Fair-rent comparison math for the renter portal (RENT-06).
 *
 * Tier 1 compares an asking rent with the ZIP median for the listing's bedroom
 * count (RentCast market stats, `dataByBedrooms`). Tier 2 compares it with a
 * rent estimate range and its comparables (`/avm/rent/long-term`).
 *
 * Pure and neutral: this module only ever reports "above", "below" or "same".
 * All user-facing wording lives in the UI, and it is a comparison, never a
 * valuation.
 */

import type { BedroomBucket, CompLike } from './types.js';

/** UI-SPEC: a difference under 2% of the median reads "about the same as". */
export const SAME_THRESHOLD = 0.02;
/** UI-SPEC: a bedroom bucket with fewer than 10 listings gets the small-sample sentence. */
export const SMALL_SAMPLE = 10;
/** CONTEXT: an estimate backed by fewer than 3 comparables is low confidence. */
export const LOW_CONFIDENCE_COMPS = 3;
/** UI-SPEC ComparablesTable: show at most the 10 nearest comparables. */
export const MAX_COMPS_SHOWN = 10;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Shared renter shapes live in types.ts; re-exported so the fair-rent subpath keeps them.
export type { BedroomBucket, CompLike };

/**
 * Picks the market-stats bucket for a listing's bedroom count.
 * Exact match first. If the count is above every bucket, the highest bucket is
 * used and flagged `exact: false` so the UI can label it. A missing bucket
 * anywhere else returns `null` rather than guessing a neighbour.
 */
export function pickBedroomBucket<T extends BedroomBucket>(
	buckets: readonly T[] | null | undefined,
	bedrooms: number | null
): { bucket: T; exact: boolean } | null {
	if (!buckets || buckets.length === 0 || !isNum(bedrooms)) return null;
	const exact = buckets.find((b) => b.bedrooms === bedrooms);
	if (exact) return { bucket: exact, exact: true };
	let highest: T | null = null;
	for (const b of buckets) {
		if (isNum(b.bedrooms) && (highest === null || b.bedrooms > highest.bedrooms)) highest = b;
	}
	if (highest !== null && bedrooms > highest.bedrooms) return { bucket: highest, exact: false };
	return null;
}

export type MedianDirection = 'above' | 'below' | 'same';

/** Direction and whole-number percent of the asking rent relative to a median. */
export function compareToMedian(
	asking: number,
	median: number | null | undefined
): { direction: MedianDirection; percent: number } | null {
	if (!isNum(asking) || !isNum(median) || median <= 0) return null;
	const d = (asking - median) / median;
	const percent = Math.round(Math.abs(d) * 100);
	if (Math.abs(d) < SAME_THRESHOLD) return { direction: 'same', percent };
	return { direction: d > 0 ? 'above' : 'below', percent };
}

/** `'small'` when the bucket has fewer than SMALL_SAMPLE listings or the count is unknown. */
export function sampleCaveat(totalListings: number | null | undefined): 'small' | null {
	if (!isNum(totalListings)) return 'small';
	return totalListings < SMALL_SAMPLE ? 'small' : null;
}

export type RangePosition = 'within' | 'above' | 'below';

/** Where the asking rent sits against an estimate range (edges inclusive). */
export function compareToRange(
	asking: number,
	low: number,
	high: number
): { position: RangePosition; delta: number } {
	if (asking > high) return { position: 'above', delta: asking - high };
	if (asking < low) return { position: 'below', delta: low - asking };
	return { position: 'within', delta: 0 };
}

export function estimateConfidence(compCount: number): 'low' | 'ok' {
	return isNum(compCount) && compCount >= LOW_CONFIDENCE_COMPS ? 'ok' : 'low';
}

const normAddress = (a: string | null | undefined): string =>
	(a ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Comparables ready to show: the subject listing removed (RESEARCH Pitfall 11),
 * sorted nearest first (unknown distance last), capped at MAX_COMPS_SHOWN.
 */
export function displayComparables<T extends CompLike>(
	comps: readonly T[] | null | undefined,
	subject: { id?: string | null; formattedAddress?: string | null }
): { rows: T[]; subjectIncluded: boolean } {
	if (!comps || comps.length === 0) return { rows: [], subjectIncluded: false };
	const subjectId = subject.id ?? '';
	const subjectAddr = normAddress(subject.formattedAddress);
	let subjectIncluded = false;
	const kept: T[] = [];
	for (const c of comps) {
		const sameId = subjectId !== '' && c.id === subjectId;
		const sameAddr = subjectAddr !== '' && normAddress(c.formattedAddress) === subjectAddr;
		if (sameId || sameAddr) subjectIncluded = true;
		else kept.push(c);
	}
	const dist = (c: T) => (isNum(c.distance) ? c.distance : Number.POSITIVE_INFINITY);
	kept.sort((a, b) => dist(a) - dist(b) || 0);
	return { rows: kept.slice(0, MAX_COMPS_SHOWN), subjectIncluded };
}

/**
 * Linear scale for the decorative RentRangeBar:
 * `[min(low, asking) * 0.95, max(high, asking) * 1.05]`, positions clamped to [0, 1].
 */
export function rangeBarScale(
	low: number,
	high: number,
	asking: number
): { min: number; max: number; pos: (v: number) => number } {
	const min = Math.min(low, asking) * 0.95;
	const max = Math.max(high, asking) * 1.05;
	const span = max - min;
	const pos = (v: number): number => {
		if (!(span > 0)) return 0;
		const t = (v - min) / span;
		return t <= 0 ? 0 : t >= 1 ? 1 : t;
	};
	return { min, max, pos };
}
