<script lang="ts">
	// 06-UI-SPEC "ListingHeader": 96px property mark, the street line as the page's single h1, the
	// place line, then the chips row (Sample chip, or the live ProvenanceRow with Refresh (1 call),
	// and the honest recency chip). The root carries data-provenance for the sample-chip check.
	import type { Listing } from '@tran/core/listings';
	import type { Provenance } from '$lib/data';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import ListingStatusChip from '$lib/features/shared/listings/ListingStatusChip.svelte';
	import PropertyTypeMark from '$lib/features/shared/listings/PropertyTypeMark.svelte';
	import { placeLine, streetLine } from './address';

	interface Props {
		row: Listing;
		provenance: Provenance;
		now: Date;
		onRefresh?: () => Promise<void>;
		/** Move focus to the h1 on mount (the detail replaced the not-found view after a lookup). */
		focusHeading?: boolean;
	}

	let { row, provenance, now, onRefresh, focusHeading = false }: Props = $props();

	let headingEl = $state<HTMLElement | null>(null);
	$effect(() => {
		if (focusHeading) headingEl?.focus();
	});
</script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-start" data-provenance={provenance.source}>
	<PropertyTypeMark type={row.propertyType} size="detail" />
	<div class="grid min-w-0 gap-2">
		<h1
			bind:this={headingEl}
			tabindex="-1"
			class="font-display text-display font-semibold text-balance [overflow-wrap:anywhere] focus:outline-none"
		>
			{streetLine(row)}
		</h1>
		<p class="text-base leading-[1.6] [overflow-wrap:anywhere] text-muted-foreground">
			{placeLine(row)}
		</p>
		<div class="mt-2 flex flex-wrap items-center gap-2">
			{#if provenance.source === 'sample'}
				<ProvenanceChip {provenance} />
			{:else}
				<ProvenanceRow {provenance} {onRefresh} />
			{/if}
			<ListingStatusChip {row} {now} context="detail" />
		</div>
	</div>
</header>
