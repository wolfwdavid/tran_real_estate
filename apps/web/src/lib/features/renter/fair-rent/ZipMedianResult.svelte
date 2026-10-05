<script lang="ts">
	// 06-UI-SPEC "FairRentCheck" Tier 1 result: the asking rent against the ZIP median for the
	// listing's bedroom count, plus the sample-size caveat. Presentational only (no gateway), so the
	// sentence is server-renderable and unit-tested. The comparison math is @tran/core's; this file
	// only words it, and the wording is a neutral comparison ("above", "below", "about the same as").
	import type { Listing, MarketSide } from '@tran/core/listings';
	import {
		compareToMedian,
		pickBedroomBucket,
		sampleCaveat,
		type BedroomBucket
	} from '@tran/core/renter/fair-rent';
	import { formatMonthYear, formatRent } from '@tran/core/renter/format';

	interface Props {
		row: Pick<Listing, 'price' | 'bedrooms'>;
		rental: MarketSide;
		zip: string;
	}

	let { row, rental, zip }: Props = $props();

	const buckets = $derived<BedroomBucket[]>(
		rental.byBedrooms.flatMap((b) =>
			b.bedrooms === null
				? []
				: [{ bedrooms: b.bedrooms, medianRent: b.median, totalListings: b.totalListings }]
		)
	);
	const pick = $derived(pickBedroomBucket(buckets, row.bedrooms));
	const comparison = $derived(pick ? compareToMedian(row.price, pick.bucket.medianRent) : null);

	const asking = $derived(formatRent(row.price) ?? '');
	const median = $derived(formatRent(pick?.bucket.medianRent) ?? '');
	/** The bucket actually used: the listing's own count, or the top bucket when it is above them all. */
	const group = $derived(
		pick?.bucket.bedrooms === 0 ? 'studios' : `${pick?.bucket.bedrooms}-bedroom rentals`
	);

	const listings = $derived(pick?.bucket.totalListings ?? null);
	const asOf = $derived(formatMonthYear(rental.lastUpdatedDate));
	const small = $derived(sampleCaveat(listings) === 'small');

	const allMedian = $derived(formatRent(rental.median));
	const bedroomLabel = $derived(
		row.bedrooms === 0 ? 'studio' : row.bedrooms === null ? null : `${row.bedrooms}-bedroom`
	);
</script>

{#if comparison}
	<div class="grid gap-2">
		<p data-fair-rent-sentence class="text-base leading-[1.6] text-foreground tabular-nums">
			{#if comparison.direction === 'same'}
				<span class="font-semibold">{asking}</span> is about the same as the median rent of
				<span class="font-semibold">{median}</span> for {group} in {zip}.
			{:else}
				<span class="font-semibold">{asking}</span> is
				<span class="font-semibold">{comparison.percent}% {comparison.direction}</span> the median
				rent of <span class="font-semibold">{median}</span> for {group} in {zip}.
			{/if}
		</p>
		<p class="text-label text-muted-foreground tabular-nums">
			{#if listings !== null}
				Based on {listings}
				{listings === 1 ? 'rental listing' : 'rental listings'} in RentCast's data for {zip}{#if asOf},
					as of {asOf}{/if}.
			{/if}
			{#if small}
				That's a small sample, so treat this as a rough guide.
			{/if}
		</p>
	</div>
{:else}
	<div class="grid gap-2">
		{#if bedroomLabel}
			<p data-fair-rent-sentence class="text-base leading-[1.6] text-foreground">
				RentCast has no {bedroomLabel} rent data for {zip}.
			</p>
		{/if}
		{#if allMedian}
			<p
				data-fair-rent-sentence={bedroomLabel ? undefined : ''}
				class="text-base leading-[1.6] text-foreground tabular-nums"
			>
				The median for all rentals in {zip} is <span class="font-semibold">{allMedian}</span>.
			</p>
		{/if}
	</div>
{/if}
