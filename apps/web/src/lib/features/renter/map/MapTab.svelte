<script lang="ts">
	// The Map tab (06-19, RENT-02; 06-UI-SPEC "Map contract" and "Map accessibility").
	//
	// ResultsView mounts this panel the first time Map is chosen and keeps it mounted (hidden, not
	// removed, while List shows). The heavy map is behind LazyMap's dynamic import. Everything here
	// is local: selecting, clustering and filtering never spend a call.
	//
	// Live results (RentCast) draw on OpenStreetMap tiles; sample results draw on a plain backdrop
	// with zero third-party requests, because fixture addresses are made up.
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import type { Listing } from '@tran/core/listings';
	import { formatRent } from '@tran/core/renter/format';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import LazyMap from '$lib/features/shared/listings/map/LazyMap.svelte';
	import { streetLine } from '../listing/address';
	import type { RenterSearch } from '../search/search-state.svelte';
	import type { MapBounds } from './in-bounds';
	import SelectedListingPreview from './SelectedListingPreview.svelte';
	import SplitList from './SplitList.svelte';

	let { search }: { search: RenterSearch } = $props();

	const mode = $derived<'sample' | 'live'>(
		search.provenance?.source === 'rentcast' ? 'live' : 'sample'
	);
	const rows = $derived(search.filtered);
	const active = $derived(search.view === 'map');
	/** Refit only for a new location (or source); filter changes keep the user's pan. */
	const fitKey = $derived(`${search.locationText}|${search.provenance?.source ?? ''}`);
	const selectedRow = $derived(
		search.selectedListingId ? (rows.find((r) => r.id === search.selectedListingId) ?? null) : null
	);

	let spot = $state.raw<Listing[] | null>(null);
	let focusToken = $state(0);
	/** Pin activations at the split-view width: the split list scrolls to and focuses the card. */
	let scrollToken = $state(0);
	let bounds = $state.raw<MapBounds | null>(null);

	/** The UI-SPEC split view starts at 1024px (Tailwind `lg`). */
	function splitView(): boolean {
		return matchMedia('(min-width: 1024px)').matches;
	}
	let afterMap = $state<HTMLElement | null>(null);

	function onready(count: number): void {
		announce(
			mode === 'sample' ? 'Map ready with sample listings.' : `Map ready. ${count} rentals shown.`
		);
	}

	function onselect(id: string): void {
		const row = rows.find((r) => r.id === id);
		if (!row) return;
		spot = null;
		search.select(id);
		if (splitView()) scrollToken++;
		else focusToken++;
		const rent = formatRent(row.price);
		announce(`${streetLine(row)}, ${rent ? `${rent} a month` : 'rent not listed'}, selected.`);
	}

	function onspot(leaves: Listing[]): void {
		spot = leaves;
		focusToken++;
		announce(`${leaves.length} rentals at this spot.`);
	}

	function skipMap(e: MouseEvent): void {
		e.preventDefault();
		afterMap?.focus();
	}
</script>

<div data-map-tab={mode} class="flex flex-col gap-4">
	<div class="flex flex-col gap-2">
		{#if mode === 'sample'}
			<div class="flex flex-wrap items-center gap-2">
				{#if search.provenance}
					<ProvenanceChip provenance={search.provenance} />
				{/if}
			</div>
			<p class="flex items-start gap-2 text-sm text-foreground">
				<FlaskConical size={14} aria-hidden="true" class="mt-1 shrink-0" />
				<span>
					Sample listings are shown on a plain backdrop because their addresses are made up. With a
					RentCast key, rentals appear on an OpenStreetMap street map.
				</span>
			</p>
		{/if}
		<p class="text-sm text-muted-foreground">
			Drag, or use the arrow keys, to move the map. Use + and − to zoom. Every listing here is also
			in the list.
		</p>
	</div>

	<a
		href="#after-map"
		onclick={skipMap}
		class="sr-only rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:self-start"
		>Skip the map</a
	>

	<div
		data-map-split
		class="flex flex-col gap-4 lg:grid lg:grid-cols-[400px_1fr] lg:items-start lg:gap-8"
	>
		<div class="hidden lg:block">
			<SplitList {search} {bounds} {scrollToken} />
		</div>
		<section aria-labelledby="map-heading" class="flex min-w-0 flex-col gap-2 lg:sticky lg:top-4">
			<h3 id="map-heading" class="sr-only">Map of {rows.length} rentals</h3>
			{#key mode}
				<LazyMap
					{rows}
					newIds={search.newIds}
					selectedId={search.selectedListingId}
					highlightedId={search.hoveredListingId}
					{mode}
					{fitKey}
					{active}
					{onselect}
					{onspot}
					onhover={(id) => search.hover(id)}
					{onready}
					onbounds={(b) => (bounds = b)}
					onShowList={() => search.setView('list')}
				/>
			{/key}
			{#if mode === 'live'}
				<p class="text-sm">
					<a
						href="https://www.openstreetmap.org/fixthemap"
						class="inline-flex min-h-11 items-center gap-1 text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>Report a map problem<ExternalLink size={14} aria-hidden="true" /></a
					>
				</p>
			{/if}
		</section>
	</div>

	<div id="after-map" bind:this={afterMap} tabindex="-1" class="flex flex-col gap-2 outline-none">
		<!-- From 1024px the split list shows the selection; a spot list still appears here. -->
		<div class={spot ? 'contents' : 'contents lg:hidden'}>
			<SelectedListingPreview
				row={selectedRow}
				{spot}
				provenance={search.provenance}
				newIds={search.newIds}
				{focusToken}
			/>
		</div>
	</div>
</div>

<style>
	/* Split view (UI-SPEC): the sticky map fills the viewport height, minimum 480px. */
	@media (min-width: 1024px) {
		[data-map-split] :global(.tran-map),
		[data-map-split] :global([data-map-loading]) {
			height: calc(100dvh - 128px);
			min-height: 480px;
		}
	}
</style>
