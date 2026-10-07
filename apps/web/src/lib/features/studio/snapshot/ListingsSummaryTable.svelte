<script lang="ts" module>
	import { formatCount } from '@tran/core/budget';
	import { longDate, NOT_AVAILABLE, usd, usdRange } from '@tran/core/format';
	import { bedroomLabel, type AggregatedSample } from '@tran/core/studio';

	/** The five columns, in order. Nothing that identifies a single listing is ever a column. */
	export const LISTINGS_SUMMARY_COLUMNS = [
		'Bedrooms',
		'Listings',
		'Price range',
		'Median',
		'Median days on market'
	] as const;

	const dollars = (v: number): string => usd(Math.round(v * 100));

	/** "Active {homes for sale | rentals} in ZIP {zip} that RentCast saw on {date}: {n} listings. ..." */
	export function listingsSummaryCaption(sample: AggregatedSample, zip: string): string {
		const what = sample.kind === 'sale' ? 'homes for sale' : 'rentals';
		const seen = new Date(sample.seenAt);
		const on = Number.isFinite(seen.getTime()) ? longDate(seen) : NOT_AVAILABLE;
		const n = `${formatCount(sample.total)} ${sample.total === 1 ? 'listing' : 'listings'}`;
		return `Active ${what} in ZIP ${zip} that RentCast saw on ${on}: ${n}. Counts and ranges only. Individual listings aren't shown.`;
	}

	/** One row per bedroom bucket, built only from the aggregate's whitelisted numbers. */
	export function listingsSummaryRows(
		sample: AggregatedSample
	): { label: string; cells: string[] }[] {
		return sample.byBedroom.map((r) => ({
			label: bedroomLabel(r.beds),
			cells: [
				formatCount(r.count),
				r.min === r.max ? dollars(r.min) : usdRange(r.min * 100, r.max * 100),
				dollars(r.median),
				r.medianDom === null ? NOT_AVAILABLE : formatCount(r.medianDom)
			]
		}));
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "ListingsSummaryTable", shared by the builder (step 2) and the print report (09-18).
	// Aggregates only (Pitfall 8): it receives an AggregatedSample, whose keys are whitelisted by
	// 09-05 and guarded again by the 09-11 snapshot privacy check, and it renders counts, ranges and
	// medians by bedroom count. It has no link and no image, so a report never advertises another
	// agent's listing.
	let { sample, zip }: { sample: AggregatedSample; zip: string } = $props();

	const caption = $derived(listingsSummaryCaption(sample, zip));
	const rows = $derived(listingsSummaryRows(sample));
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	role="region"
	tabindex="0"
	aria-label={caption}
	data-listings-summary
	class="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
	<table class="w-full border-collapse text-base leading-[1.6] text-foreground">
		<caption class="pb-2 text-left text-label text-muted-foreground">{caption}</caption>
		<thead class="bg-surface">
			<tr>
				{#each LISTINGS_SUMMARY_COLUMNS as col, i (col)}
					<th
						scope="col"
						class="border-b border-border px-3 py-2 font-semibold whitespace-nowrap {i === 0
							? 'text-left'
							: 'text-right'}">{col}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.label)}
				<tr class="border-b border-border last:border-b-0">
					<th scope="row" class="px-3 py-2 text-left font-normal whitespace-nowrap">{row.label}</th>
					{#each row.cells as cell, i (i)}
						<td class="px-3 py-2 text-right whitespace-nowrap tabular-nums">{cell}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
