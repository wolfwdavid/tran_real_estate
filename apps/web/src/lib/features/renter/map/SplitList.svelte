<script lang="ts">
	// The split view's list column (06-21, RENT-02; 06-UI-SPEC "View tabs" >= 1024px and "List <->
	// map linking").
	//
	// Shows only the rentals inside the current map view, in the chosen sort order, as compact
	// cards in its own scrollable region. Hovering or focusing a card highlights its pin (through
	// search.hover); the map highlights the card the same way. When a pin is activated on the map
	// (scrollToken bumps), the matching card scrolls into view and its address link takes focus,
	// unless the user is typing in a filter field. Everything is local: 0 calls.
	import { tick, untrack } from 'svelte';
	import { sortRentals } from '@tran/core/renter';
	import ListingCard from '../search/ListingCard.svelte';
	import type { RenterSearch } from '../search/search-state.svelte';
	import { rowsInBounds, type MapBounds } from './in-bounds';

	interface Props {
		search: RenterSearch;
		/** The map's current view; null until the map has drawn (then every result is listed). */
		bounds: MapBounds | null;
		/** Bumped by MapTab after a pin activation at this width: scroll + focus the card. */
		scrollToken: number;
		now?: Date;
	}

	let { search, bounds, scrollToken, now = new Date() }: Props = $props();

	const inView = $derived(bounds ? rowsInBounds(search.filtered, bounds) : search.filtered);
	const rows = $derived(sortRentals(inView, search.sort));
	const count = $derived(rows.length);

	let region = $state<HTMLElement | null>(null);

	function motionOK(): boolean {
		return matchMedia('(prefers-reduced-motion: no-preference)').matches;
	}

	/** Never pull focus away from someone typing in a filter field. */
	function typing(): boolean {
		const active = document.activeElement;
		return active instanceof HTMLElement && active.matches('input, select, textarea');
	}

	$effect(() => {
		if (scrollToken === 0) return;
		const id = untrack(() => search.selectedListingId);
		if (!id) return;
		void tick().then(() => {
			if (!region || region.offsetParent === null || typing()) return;
			const card = region.querySelector<HTMLElement>(`[data-listing-card="${CSS.escape(id)}"]`);
			if (!card) return;
			card.scrollIntoView({ block: 'nearest', behavior: motionOK() ? 'smooth' : 'instant' });
			card
				.querySelector<HTMLAnchorElement>(`#${CSS.escape(`card-${id}-addr`)}`)
				?.focus({ preventScroll: true });
		});
	});
</script>

<!-- A scrollable region must be reachable by keyboard to scroll it (UI-SPEC, WCAG 2.1.1). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	bind:this={region}
	role="region"
	tabindex="0"
	aria-label="Rentals in this view"
	data-split-list
	class="flex h-[calc(100dvh-128px)] min-h-[480px] flex-col gap-4 overflow-y-auto rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
	<h3
		data-split-count
		class="sticky top-0 z-10 bg-background py-2 text-base leading-[1.6] font-semibold text-foreground tabular-nums"
	>
		{count === 1 ? '1 rental in this map view' : `${count} rentals in this map view`}
	</h3>
	{#if search.provenance}
		{@const provenance = search.provenance}
		{#if count === 0}
			<p class="text-sm text-muted-foreground">
				No rentals in this part of the map. Zoom out or drag the map to see more.
			</p>
		{:else}
			<ul class="flex flex-col gap-4">
				{#each rows as row (row.id)}
					<li class="min-w-0">
						<ListingCard
							{row}
							{provenance}
							{now}
							compact
							isNew={search.newIds.has(row.id)}
							selected={search.selectedListingId === row.id}
							highlighted={search.hoveredListingId === row.id}
							onhover={(id) => search.hover(id)}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
