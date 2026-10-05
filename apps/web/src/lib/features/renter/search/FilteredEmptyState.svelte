<script lang="ts">
	// 06-UI-SPEC "Empty state (filters hide everything)": the search found rentals, but the local
	// filters hide all of them. Clearing filters is local and free, so the copy says so.
	import { Button } from '$lib/components/ui/button/index.js';
	import type { RenterSearch } from './search-state.svelte';

	interface Props {
		search: RenterSearch;
		/** Called after the filters are cleared (the page focuses the Filters button). */
		onCleared?: () => void;
	}

	let { search, onCleared }: Props = $props();

	const n = $derived(search.rows.length);
</script>

{#if n > 0 && search.filtered.length === 0}
	<div data-filtered-empty class="flex flex-col items-start gap-4 py-8">
		<h3 class="font-display text-heading font-semibold text-balance">
			No rentals match these filters
		</h3>
		<p class="max-w-reading text-base leading-[1.6] text-muted-foreground">
			{n}
			{n === 1 ? 'rental' : 'rentals'} in {search.locationText}
			{n === 1 ? 'is' : 'are'} hidden by your filters. Clearing them costs nothing.
		</p>
		<Button
			variant="outline"
			onclick={() => {
				search.clearFilters();
				onCleared?.();
			}}
		>
			Clear filters
		</Button>
	</div>
{/if}
