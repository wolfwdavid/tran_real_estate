<script lang="ts" module>
	import { monthYear, NOT_AVAILABLE } from '@tran/core/format';
	import { snapshotFigureValues, type SnapshotMetrics } from '@tran/core/studio';

	export interface KeyFigureItem {
		term: string;
		value: string;
		line: string;
	}

	/** The definition line every missing figure shows instead of its explanation. */
	export const MISSING_LINE = "Not in RentCast's data for this ZIP";

	/**
	 * The six Key figures in report order. Every value is a snapshotFigureValues string, the same
	 * strings factsForPrompt hands the AI, so a figure on screen, in print and in the notes match.
	 */
	export function keyFigureItems(m: SnapshotMetrics): KeyFigureItem[] {
		const v = snapshotFigureValues(m);
		const known = (s: string) => s !== NOT_AVAILABLE;
		const item = (term: string, value: string, line: string, ok = known(value)) => ({
			term,
			value,
			line: ok ? line : MISSING_LINE
		});
		const changeKnown = known(v.rentChange) && m.rentChangeFrom !== null && m.rentChangeTo !== null;
		return [
			item('Median rent', v.medianRent, 'Middle asking rent across rental listings.'),
			item('Median list price', v.medianPrice, 'Middle asking price across homes for sale.'),
			item(
				'Price-to-rent ratio',
				v.priceToRent,
				'Median list price divided by a year of median rent.'
			),
			{
				term: 'Rent change',
				value: changeKnown ? v.rentChange : NOT_AVAILABLE,
				line: changeKnown
					? `Change in median rent from ${monthYear(m.rentChangeFrom ?? '')} to ${monthYear(m.rentChangeTo ?? '')}.`
					: MISSING_LINE
			},
			// The value is the for-sale figure; the line keeps the rentals figure when only it is known.
			item(
				'Median days on market',
				v.saleDom,
				`Homes for sale: ${v.saleDom}. Rentals: ${v.rentalDom}.`,
				known(v.saleDom) || known(v.rentalDom)
			),
			item(
				'Homes for sale',
				v.saleTotal,
				known(v.saleNew) ? `Active listings, with ${v.saleNew} new last month.` : 'Active listings.'
			)
		];
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "SnapshotKeyFigures": a <dl> grid used by the builder preview and the print report
	// (09-18). Screen: 1 column, 2 from 640px, 3 from 1024px. Print: 2 columns and .print-keep.
	// Term Label 14/400 muted, value Figure 24/600 tabular, definition line Label 14/400 muted.
	let { metrics, print = false }: { metrics: SnapshotMetrics; print?: boolean } = $props();

	const items = $derived(keyFigureItems(metrics));
</script>

<dl
	data-snapshot-key-figures
	class="grid gap-4 {print
		? 'print-keep grid-cols-2'
		: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}"
>
	{#each items as f (f.term)}
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-label text-muted-foreground">{f.term}</dt>
			<dd class="flex flex-col gap-1">
				<span class="text-[1.5rem] leading-[1.2] font-semibold text-foreground tabular-nums"
					>{f.value}</span
				>
				<span class="text-label text-muted-foreground tabular-nums">{f.line}</span>
			</dd>
		</div>
	{/each}
</dl>
