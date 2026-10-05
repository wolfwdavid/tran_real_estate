<script lang="ts">
	// 06-UI-SPEC results header (RENT-02): count heading, provenance (+ Refresh (1 call) live),
	// Sort by (local, 0 calls) and Save this search (06-20). Lives inside SearchPage's
	// <section aria-labelledby="results-heading">.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { isSortId, resultsHeading, SORT_OPTIONS } from '@tran/core/renter';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import SaveSearchButton from '../saved/SaveSearchButton.svelte';
	import type { RenterSearch } from './search-state.svelte';

	let { search }: { search: RenterSearch } = $props();

	const heading = $derived(
		resultsHeading({
			total: search.rows.length,
			shown: search.filtered.length,
			location: search.locationText
		})
	);

	function onSort(value: string) {
		if (isSortId(value)) search.setSort(value);
	}
</script>

<div class="flex flex-col gap-2">
	<h2
		id="results-heading"
		class="text-base leading-[1.6] font-semibold text-foreground tabular-nums"
	>
		{heading}
	</h2>
	{#if search.provenance}
		<ProvenanceRow
			provenance={search.provenance}
			onRefresh={search.provenance.source === 'rentcast' ? () => search.refresh() : undefined}
		/>
	{/if}
	<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<label for="renter-sort" class="text-base leading-[1.6] font-semibold text-foreground"
				>Sort by</label
			>
			<div class="relative w-full sm:w-auto">
				<select
					id="renter-sort"
					value={search.sort}
					onchange={(e) => onSort(e.currentTarget.value)}
					class="h-12 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pr-10 pl-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
				>
					{#each SORT_OPTIONS as option (option.id)}
						<option value={option.id}>{option.label}</option>
					{/each}
				</select>
				<ChevronDown
					class="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-foreground"
					aria-hidden="true"
				/>
			</div>
		</div>
		<SaveSearchButton {search} />
	</div>
</div>
