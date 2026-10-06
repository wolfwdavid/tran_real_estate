<script lang="ts">
	// 06-UI-SPEC "FairRentCheck" (RENT-06): how the asking rent compares, in two tiers. Tier 1 reads
	// the ZIP median (0 calls when the ZIP's market stats are cached, always 0 in sample mode). Tier 2
	// is RentCast's rent estimate (1 call, cost shown first; 0 when cached or sample). Each tier is
	// self-contained, so Tier 2 can be cut without touching Tier 1. The copy is a comparison only; it
	// never judges the price.
	import type { Listing } from '@tran/core/listings';
	import { getDataRuntime, type Provenance } from '$lib/data';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import RentEstimateTier from './RentEstimateTier.svelte';
	import ZipMedianTier from './ZipMedianTier.svelte';

	let { row, provenance }: { row: Listing; provenance: Provenance } = $props();

	const runtime = getDataRuntime();
	/** Both tiers read fixtures in sample mode, so the card carries the Sample chip in its header. */
	const sample = $derived(runtime.mode?.source !== 'rentcast');
	const SAMPLE = { source: 'sample', fetchedAt: 0, stale: false } as const;
</script>

<section
	class="grid gap-6 rounded-lg border border-border bg-card p-4 sm:p-6"
	aria-labelledby="fair-rent-heading"
	data-fair-rent={row.id}
	data-fair-rent-source={provenance.source}
>
	<div class="flex flex-wrap items-center gap-2">
		<h2
			id="fair-rent-heading"
			class="font-display text-heading font-semibold text-balance text-foreground"
		>
			How this rent compares
		</h2>
		{#if sample}
			<ProvenanceChip provenance={SAMPLE} now={0} />
		{/if}
	</div>

	<ZipMedianTier {row} />

	<div class="border-t border-border pt-6">
		<RentEstimateTier {row} />
	</div>
</section>
