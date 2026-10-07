/**
 * Market Snapshot figure strings, AI prompt facts and the allowed-number set (STU-04).
 *
 * One formatter source: every string here comes from `@tran/core/format` (the Phase 7 display
 * formatters), so the report, the prompt facts and the number check all see identical figures.
 * A figure the model copies verbatim from the facts therefore always passes the numeric
 * post-check, and a number the model derives itself (a difference, an average) does not.
 */

import {
	MINUS,
	NOT_AVAILABLE,
	longDate,
	monthYear,
	pct,
	ratio,
	usd,
	usdRange
} from '../format/index.js';
import { bedroomLabel, type AggregatedSample, type SnapshotMetrics } from './snapshot-metrics.js';

export interface SnapshotFigureValues {
	medianRent: string;
	medianPrice: string;
	priceToRent: string;
	rentChange: string;
	saleDom: string;
	rentalDom: string;
	saleTotal: string;
	saleNew: string;
	rentalTotal: string;
	rentalNew: string;
}

export interface FactLine {
	label: string;
	value: string;
}

/** Whole dollars -> "$1,850" via the shared cents formatter. */
const dollars = (v: number): string => usd(Math.round(v * 100));

/** A whole count with thousands grouping: 1234 -> "1,234". Counts are never negative here. */
function whole(v: number): string {
	return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const or = <T>(v: T | null, f: (x: T) => string): string => (v === null ? NOT_AVAILABLE : f(v));

/** 2.8 -> "+2.8%", -1.4 -> U+2212 then "1.4%" (true minus), 0 -> "0.0%" (unsigned when it rounds to 0). */
export function formatSignedPct(v: number): string {
	const text = pct(v, 1);
	return v > 0 && /[1-9]/.test(text) && !text.startsWith(MINUS) ? `+${text}` : text;
}

/** The Key figures strings, shared by the builder preview and the print report. */
export function snapshotFigureValues(m: SnapshotMetrics): SnapshotFigureValues {
	return {
		medianRent: or(m.medianRent, dollars),
		medianPrice: or(m.medianPrice, dollars),
		priceToRent: or(m.priceToRent, (x) => ratio(x, 1)),
		rentChange: or(m.rentChangePct, formatSignedPct),
		saleDom: or(m.saleDom, whole),
		rentalDom: or(m.rentalDom, whole),
		saleTotal: or(m.saleTotal, whole),
		saleNew: or(m.saleNew, whole),
		rentalTotal: or(m.rentalTotal, whole),
		rentalNew: or(m.rentalNew, whole)
	};
}

const plural = (n: number, one: string, many: string): string =>
	`${whole(n)} ${n === 1 ? one : many}`;

/** The as-of date as a UTC Date, or null when it does not parse. */
function asOfDate(asOf: string): Date | null {
	const d = new Date(asOf);
	return Number.isFinite(d.getTime()) ? d : null;
}

/** Lower-cased bedroom label for mid-sentence use: "studio", "2 bedrooms", "4+ bedrooms". */
const bedsPhrase = (beds: number): string => bedroomLabel(beds).toLowerCase();

/**
 * Every fact the report states, as label/value pairs in report formatting. Missing figures are
 * omitted (the prompt never sees a dash or a fake zero).
 */
export function snapshotFactLines(
	m: SnapshotMetrics,
	sample: AggregatedSample | null,
	asOf: string
): FactLine[] {
	const v = snapshotFigureValues(m);
	const lines: FactLine[] = [{ label: 'ZIP', value: m.zip }];
	const add = (label: string, value: string): void => {
		if (value !== NOT_AVAILABLE) lines.push({ label, value });
	};
	add('Median rent', v.medianRent);
	add('Median list price', v.medianPrice);
	add('Price-to-rent ratio', v.priceToRent);
	if (m.rentChangeFrom !== null && m.rentChangeTo !== null) {
		add(
			`Rent change from ${monthYear(m.rentChangeFrom)} to ${monthYear(m.rentChangeTo)}`,
			v.rentChange
		);
	}
	add('Median days on market, homes for sale', v.saleDom);
	add('Median days on market, rentals', v.rentalDom);
	add('Active homes for sale', v.saleTotal);
	add('New homes for sale last month', v.saleNew);
	add('Active rentals', v.rentalTotal);
	add('New rentals last month', v.rentalNew);
	for (const b of m.rentByBedroom) {
		if (b.median === null) continue;
		const count = b.listings === null ? '' : ` (${plural(b.listings, 'listing', 'listings')})`;
		lines.push({
			label: `Median rent, ${bedsPhrase(b.beds)}`,
			value: `${dollars(b.median)}${count}`
		});
	}
	if (sample) {
		const sale = sample.kind === 'sale';
		lines.push({
			label: 'Active listings summary',
			value: sale
				? plural(sample.total, 'home for sale', 'homes for sale')
				: plural(sample.total, 'rental', 'rentals')
		});
		for (const r of sample.byBedroom) {
			const range = r.min === r.max ? dollars(r.min) : usdRange(r.min * 100, r.max * 100);
			const dom = r.medianDom === null ? '' : `, median days on market ${whole(r.medianDom)}`;
			lines.push({
				label: `${sale ? 'Homes for sale' : 'Rentals'}, ${bedsPhrase(r.beds)}`,
				value: `${plural(r.count, 'listing', 'listings')}, ${range}, median ${dollars(r.median)}${dom}`
			});
		}
	}
	const d = asOfDate(asOf);
	if (d) lines.push({ label: 'Data as of', value: longDate(d) });
	return lines;
}

/** The `snapshot.v1` facts block: one `label: value` line per fact. */
export function factsForPrompt(
	m: SnapshotMetrics,
	sample: AggregatedSample | null,
	asOf: string
): string {
	return snapshotFactLines(m, sample, asOf)
		.map((l) => `${l.label}: ${l.value}`)
		.join('\n');
}

/** 'YYYY-MM' -> [year, month]. */
function monthParts(ym: string | null): number[] {
	const match = ym === null ? null : /^(\d{4})-(\d{2})/.exec(ym);
	return match ? [Number(match[1]), Number(match[2])] : [];
}

/**
 * The allowed set for the AI market notes: every displayed figure, the ZIP as a number, bedroom
 * counts 0 to 5, the history length, the month/year parts of the rent-change window and of the
 * as-of date, and every listings-summary number. De-duplicated and sorted ascending.
 */
export function snapshotAllowedNumbers(
	m: SnapshotMetrics,
	sample: AggregatedSample | null,
	asOf: string
): number[] {
	const out: (number | null)[] = [
		m.medianRent,
		m.medianPrice,
		m.priceToRent,
		m.rentChangePct,
		m.rentChangePct === null ? null : Math.abs(m.rentChangePct),
		m.saleDom,
		m.rentalDom,
		m.saleTotal,
		m.saleNew,
		m.rentalTotal,
		m.rentalNew,
		m.months,
		Number(m.zip),
		0,
		1,
		2,
		3,
		4,
		5,
		...monthParts(m.rentChangeFrom),
		...monthParts(m.rentChangeTo)
	];
	for (const b of m.rentByBedroom) out.push(b.beds, b.median, b.listings);
	if (sample) {
		out.push(sample.total);
		for (const r of sample.byBedroom)
			out.push(r.beds, r.count, r.min, r.max, r.median, r.medianDom);
	}
	const d = asOfDate(asOf);
	if (d) out.push(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
	const finite = out.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
	return [...new Set(finite.map((n) => n + 0))].sort((a, b) => a - b);
}
