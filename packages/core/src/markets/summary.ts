/**
 * Text alternatives for the market charts (07-UI-SPEC "Markets and ZIP dashboard" copy).
 * Each summary sentence names its chart so a screen reader user gets the same facts as the line.
 * Wording is descriptive only: it reports figures and months, never advice.
 */

import { monthYear, ratio, usd } from '../format/index.js';
import type { PriceToRent, RentTrend } from './types.js';

/** UI-SPEC: a median based on fewer than this many listings is marked "few listings". */
export const FEW_LISTINGS = 5;

const SAMPLE_SUFFIX = ' (sample data)';

/** First and last non-null point with their month keys, or null when there are none. */
function ends(
	months: readonly string[],
	points: readonly (number | null)[]
): { first: number; firstMonth: string; last: number; lastMonth: string } | null {
	let a = -1;
	let b = -1;
	for (let i = 0; i < points.length; i++) {
		if (points[i] === null) continue;
		if (a === -1) a = i;
		b = i;
	}
	if (a === -1) return null;
	return {
		first: points[a] as number,
		firstMonth: months[a],
		last: points[b] as number,
		lastMonth: months[b]
	};
}

const dollars = (v: number): string => usd(Math.round(v) * 100);

/** "Monthly medians, Oct 2024 to Sep 2026"; empty when there are no months. */
export function timeRangeLine(months: string[]): string {
	if (months.length === 0) return '';
	return `Monthly medians, ${monthYear(months[0])} to ${monthYear(months[months.length - 1])}`;
}

/** "Median rent in ZIP {zip}. {Series}: ${first} in {Mon YYYY}, ${last} in {Mon YYYY}. …" */
export function rentTrendSummary(zip: string, t: RentTrend, opts?: { sample?: boolean }): string {
	const parts = [`Median rent in ZIP ${zip}.`];
	for (const s of t.series) {
		const e = ends(t.months, s.points);
		if (!e) continue;
		parts.push(
			`${s.label}: ${dollars(e.first)} in ${monthYear(e.firstMonth)}, ${dollars(e.last)} in ${monthYear(e.lastMonth)}.`
		);
	}
	return parts.join(' ') + (opts?.sample ? SAMPLE_SUFFIX : '');
}

/** "Price-to-rent ratio in ZIP {zip}: {first} in {Mon YYYY}, {last} in {Mon YYYY}." */
export function priceToRentSummary(
	zip: string,
	p: PriceToRent,
	opts?: { sample?: boolean }
): string {
	const e = ends(p.months, p.points);
	const text = e
		? `Price-to-rent ratio in ZIP ${zip}: ${ratio(e.first, 1)} in ${monthYear(e.firstMonth)}, ${ratio(e.last, 1)} in ${monthYear(e.lastMonth)}.`
		: `Price-to-rent ratio in ZIP ${zip}.`;
	return text + (opts?.sample ? SAMPLE_SUFFIX : '');
}

/** " (few listings: 3)" when the count is known and below FEW_LISTINGS, else "". */
export function fewListingsSuffix(count: number | null): string {
	return typeof count === 'number' && Number.isFinite(count) && count < FEW_LISTINGS
		? ` (few listings: ${count})`
		: '';
}
