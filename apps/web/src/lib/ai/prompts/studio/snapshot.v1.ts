/**
 * Market Snapshot notes (STU-04), prompt `studio/snapshot.v1` v1 (fixture text from `sample`).
 *
 * Facts in, narration out. The model receives ONLY `factsForPrompt(metrics, sample, asOf)`: one
 * `label: value` line per figure, formatted by the same Phase 7 formatter the report uses. It must
 * copy every number exactly, so the snapshot number check (allowed set `snapshotAllowedNumbers`)
 * passes a verbatim figure and blocks anything the model derives itself.
 *
 * `sample` is the keyless Fixture text: up to three short paragraphs built only from the report
 * figures that are present (a sentence whose figure is missing is skipped), so it passes the
 * checks that gate the real notes (09-RESEARCH Pitfall 4).
 */
import { monthYear } from '@tran/core/format';
import {
	factsForPrompt,
	snapshotFigureValues,
	type AggregatedSample,
	type SnapshotMetrics
} from '@tran/core/studio';
import type { PromptDef } from '../types.js';

export const STUDIO_SNAPSHOT_PROMPT_ID = 'studio/snapshot.v1';
export const STUDIO_SNAPSHOT_FEATURE = 'studio-snapshot';

export interface SnapshotNotesInputs {
	metrics: SnapshotMetrics;
	sample: AggregatedSample | null;
	/** ISO date the data is as of. */
	asOf: string;
}

export const STUDIO_SNAPSHOT_SYSTEM = [
	'Write short market notes for a real estate agent about one ZIP code, using ONLY the facts in <facts>.',
	'Every number you write must be copied from <facts> exactly as written.',
	'Do not calculate, round, compare, or estimate any new number.',
	'Write 2-3 short paragraphs: what the numbers show for buyers, for sellers, for renters.',
	"No predictions, no advice, no 'good time to buy/sell'.",
	'Never describe the people who live in the area, schools, safety, crime, religion, or demographics.',
	'Write numbers as digits.',
	'Output plain text only. No headings, no markdown, no emoji.'
].join('\n');

/** The user message: the report figures as a <facts> block. */
export function renderSnapshotUser(i: SnapshotNotesInputs): string {
	return `<facts>\n${factsForPrompt(i.metrics, i.sample, i.asOf)}\n</facts>`;
}

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const plural = (value: string, n: number, one: string, many: string): string =>
	`${value} ${n === 1 ? one : many}`;

/** "a", "a and b", "a, b and c". */
function list(items: readonly string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function renters(m: SnapshotMetrics): string {
	const v = snapshotFigureValues(m);
	const out: string[] = [];
	const change =
		m.rentChangePct !== null && m.rentChangeFrom !== null && m.rentChangeTo !== null
			? `changed ${v.rentChange} from ${monthYear(m.rentChangeFrom)} to ${monthYear(m.rentChangeTo)}`
			: null;
	if (m.medianRent !== null) {
		out.push(
			`For renters: median rent in ZIP ${m.zip} is ${v.medianRent}${change ? `, and it ${change}` : ''}.`
		);
	} else if (change) {
		out.push(`For renters: median rent in ZIP ${m.zip} ${change}.`);
	}
	const tail: string[] = [];
	if (m.rentalTotal !== null)
		tail.push(plural(v.rentalTotal, m.rentalTotal, 'active rental', 'active rentals'));
	if (m.rentalNew !== null) tail.push(`${v.rentalNew} new last month`);
	if (m.rentalDom !== null) {
		const dom = `Rentals had a median of ${plural(v.rentalDom, m.rentalDom, 'day', 'days')} on market`;
		out.push(tail.length > 0 ? `${dom}, with ${list(tail)}.` : `${dom}.`);
	} else if (tail.length > 0) {
		out.push(`There were ${list(tail)}.`);
	}
	const first = out[0];
	if (first !== undefined && !first.startsWith('For renters')) {
		out[0] = `For renters: ${first[0]!.toLowerCase()}${first.slice(1)}`;
	}
	return out.join(' ');
}

function buyers(m: SnapshotMetrics): string {
	const v = snapshotFigureValues(m);
	const parts: string[] = [];
	if (m.medianPrice !== null) parts.push(`the median list price is ${v.medianPrice}`);
	if (m.priceToRent !== null) parts.push(`the price-to-rent ratio is ${v.priceToRent}`);
	return parts.length > 0 ? `For buyers: ${list(parts)}.` : '';
}

function sellers(m: SnapshotMetrics, sample: AggregatedSample | null): string {
	const v = snapshotFigureValues(m);
	const out: string[] = [];
	const tail: string[] = [];
	if (m.saleTotal !== null)
		tail.push(plural(v.saleTotal, m.saleTotal, 'active listing', 'active listings'));
	if (m.saleNew !== null) tail.push(`${v.saleNew} new last month`);
	if (m.saleDom !== null) {
		const dom = `homes for sale had a median of ${plural(v.saleDom, m.saleDom, 'day', 'days')} on market`;
		out.push(tail.length > 0 ? `For sellers: ${dom}, with ${list(tail)}.` : `For sellers: ${dom}.`);
	} else if (tail.length > 0) {
		out.push(`For sellers: there were ${list(tail)}.`);
	}
	if (sample && sample.total > 0) {
		const what =
			sample.kind === 'sale'
				? plural(COUNT.format(sample.total), sample.total, 'home for sale', 'homes for sale')
				: plural(COUNT.format(sample.total), sample.total, 'rental', 'rentals');
		const line = `The active listings summary in this report covers ${what}.`;
		out.push(out.length > 0 ? line : `For sellers: ${line}`);
	}
	return out.join(' ');
}

/** Deterministic keyless notes built only from the report figures that are present. */
export function sampleSnapshotNotes(i: SnapshotNotesInputs): string {
	return [renters(i.metrics), buyers(i.metrics), sellers(i.metrics, i.sample)]
		.filter((p) => p !== '')
		.join('\n\n');
}

export const studioSnapshotV1: PromptDef<SnapshotNotesInputs> = {
	id: STUDIO_SNAPSHOT_PROMPT_ID,
	version: 1,
	feature: STUDIO_SNAPSHOT_FEATURE,
	housingCopy: true,
	containsClientData: false,
	maxTokens: 2048,
	build: (i) => ({ system: STUDIO_SNAPSHOT_SYSTEM, user: renderSnapshotUser(i), known: [] }),
	sample: (i) => sampleSnapshotNotes(i)
};
