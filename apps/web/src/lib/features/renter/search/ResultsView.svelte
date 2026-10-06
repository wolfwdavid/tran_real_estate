<script lang="ts">
	// 06-UI-SPEC "View tabs" (RENT-02): List | Map as WAI-ARIA tabs (bits-ui: roving tabindex, arrow
	// keys, Tab into the panel). The choice lives in search.view, which the page mirrors into the
	// URL (`view=map`), so Back and shared links restore it. Switching tabs is local: 0 calls.
	//
	// The Map panel mounts only once the Map tab has been chosen (the map module is lazy, 06-19) and
	// stays mounted after that, so returning to Map does not reload it. Returning to List scrolls
	// the selected card into view without moving focus.
	import { tick, untrack } from 'svelte';
	import ListIcon from '@lucide/svelte/icons/list';
	import MapIcon from '@lucide/svelte/icons/map';
	import type { ResultsView } from '@tran/core/renter';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import MapTab from '../map/MapTab.svelte';
	import FilteredEmptyState from './FilteredEmptyState.svelte';
	import ResultsList from './ResultsList.svelte';
	import type { RenterSearch } from './search-state.svelte';

	interface Props {
		search: RenterSearch;
		/** After Clear filters in the filtered-empty state (the page focuses the Filters button). */
		onFiltersCleared?: () => void;
	}

	let { search, onFiltersCleared }: Props = $props();

	let mapOpened = $state(untrack(() => search.view === 'map'));
	let listPanel = $state<HTMLElement | null>(null);

	$effect(() => {
		if (search.view === 'map') mapOpened = true;
	});

	function reducedMotion(): boolean {
		return (
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	async function onValueChange(value: string): Promise<void> {
		const next: ResultsView = value === 'map' ? 'map' : 'list';
		if (next === search.view) return;
		search.setView(next);
		if (next !== 'list' || !search.selectedListingId) return;
		await tick();
		const card = listPanel?.querySelector<HTMLElement>(
			`[data-listing-card="${CSS.escape(search.selectedListingId)}"]`
		);
		card?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
	}
</script>

<Tabs.Root value={search.view} {onValueChange} data-results-view>
	<Tabs.List aria-label="Show results as">
		<Tabs.Trigger value="list"><ListIcon size={16} aria-hidden="true" />List</Tabs.Trigger>
		<Tabs.Trigger value="map"><MapIcon size={16} aria-hidden="true" />Map</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="list" bind:ref={listPanel} class="flex flex-col gap-4">
		{#if search.rows.length > 0 && search.filtered.length === 0}
			<FilteredEmptyState {search} onCleared={onFiltersCleared} />
		{:else}
			<ResultsList {search} />
		{/if}
	</Tabs.Content>
	<Tabs.Content value="map">
		{#if mapOpened}
			<MapTab {search} />
		{/if}
	</Tabs.Content>
</Tabs.Root>
