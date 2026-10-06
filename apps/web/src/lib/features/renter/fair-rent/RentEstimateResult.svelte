<script lang="ts">
	// 06-UI-SPEC "FairRentCheck" Tier 2 result: RentCast's rent estimate for this home, its likely
	// range, where the asking rent sits against that range, the decorative range bar, the
	// low-confidence badge (fewer than 3 comparables) and the comparables, nearest first.
	// Presentational only (no gateway), so it is server-renderable and unit-tested. All math is
	// @tran/core's; the wording reports an estimate and a range, never a judgment of the price.
	import type { Listing, RentEstimate } from '@tran/core/listings';
	import {
		compareToRange,
		displayComparables,
		estimateConfidence
	} from '@tran/core/renter/fair-rent';
	import { formatRent } from '@tran/core/renter/format';
	import ComparablesTable from './ComparablesTable.svelte';
	import ConfidenceBadge from './ConfidenceBadge.svelte';
	import RentRangeBar from './RentRangeBar.svelte';

	interface Props {
		row: Pick<Listing, 'id' | 'formattedAddress' | 'price'>;
		estimate: RentEstimate;
		sample?: boolean;
	}

	let { row, estimate, sample = false }: Props = $props();

	const money = (n: number) => formatRent(n) ?? '';
	const comps = $derived(
		displayComparables(estimate.comparables, {
			id: row.id,
			formattedAddress: row.formattedAddress
		}).rows
	);
	const low = $derived(estimate.low);
	const high = $derived(estimate.high);
	const range = $derived(
		low !== null && high !== null ? compareToRange(row.price, low, high) : null
	);
	const lowConfidence = $derived(estimateConfidence(comps.length) === 'low');
</script>

<div class="grid gap-4" data-rent-estimate>
	<div class="grid gap-1">
		<p class="text-base leading-[1.6] font-semibold text-foreground tabular-nums">
			Estimate: {money(estimate.estimate)} a month
		</p>
		{#if low !== null && high !== null}
			<p class="text-base leading-[1.6] text-foreground tabular-nums">
				Likely range: {money(low)} to {money(high)}
			</p>
		{/if}
	</div>

	{#if range && low !== null && high !== null}
		<p class="text-base leading-[1.6] text-foreground tabular-nums" data-range-sentence>
			{#if range.position === 'within'}
				The asking rent of <span class="font-semibold">{money(row.price)}</span> is within the estimated
				range.
			{:else}
				The asking rent of <span class="font-semibold">{money(row.price)}</span> is
				<span class="font-semibold">{money(range.delta)}</span>
				{range.position} the estimated range.
			{/if}
		</p>
		<RentRangeBar {low} {high} estimate={estimate.estimate} asking={row.price} />
	{/if}

	{#if lowConfidence}
		<ConfidenceBadge count={comps.length} />
	{/if}

	<ComparablesTable rows={comps} {sample} />

	<p class="text-label text-muted-foreground">
		Estimates can be wrong. Use them as one input when you talk to the listing contact.
	</p>
</div>
