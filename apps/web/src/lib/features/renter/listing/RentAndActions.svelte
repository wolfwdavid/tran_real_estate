<script lang="ts">
	// 06-UI-SPEC "RentAndActions" (aside): the rent as Heading 24 + " a month" in one text run, the
	// detail shortlist toggle, and "Days on market: {n}" when RentCast reported it.
	import type { Listing } from '@tran/core/listings';
	import { formatRent } from '@tran/core/renter/format';
	import type { Provenance } from '$lib/data';
	import ShortlistToggle from '../shortlist/ShortlistToggle.svelte';

	interface Props {
		row: Listing;
		provenance: Provenance;
		streetLine: string;
	}

	let { row, provenance, streetLine }: Props = $props();

	// A constant, because Svelte trims the leading space of literal element text.
	const A_MONTH = ' a month';
</script>

<div class="grid gap-4">
	<p class="tabular-nums">
		<span class="font-display text-heading font-semibold text-foreground"
			>{formatRent(row.price)}</span
		><span class="text-base leading-[1.6] text-muted-foreground">{A_MONTH}</span>
	</p>
	<ShortlistToggle {row} {provenance} variant="detail" {streetLine} />
	{#if row.daysOnMarket !== null}
		<p class="text-base leading-[1.6] text-foreground tabular-nums">
			Days on market: {row.daysOnMarket}
		</p>
	{/if}
</div>
