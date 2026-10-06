<script lang="ts">
	// Stub: 06-19 owns this file (lazy Leaflet map).
	//
	// 06-16 mounts this panel the first time the Map tab is selected and keeps it mounted after
	// that. 06-19 replaces the body with the dynamically imported map, its loading/failed states
	// and SelectedListingPreview. This stub loads nothing and requests no tiles.
	import type { RenterSearch } from '../search/search-state.svelte';

	let { search }: { search: RenterSearch } = $props();
</script>

<div data-map-tab data-map-stub data-rows={search.sorted.length}>
	<p class="text-sm text-muted-foreground">Loading map…</p>
</div>
