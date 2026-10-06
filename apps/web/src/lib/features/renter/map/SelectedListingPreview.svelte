<script lang="ts">
	// The listing picked on the map (06-19, RENT-02; 06-UI-SPEC "List <-> map linking").
	//
	// aria-live="off": the selection is announced once through the shared announcer, and focus moves
	// here (to the address link) only when the user activated a pin or cluster (focusToken bumps).
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Listing } from '@tran/core/listings';
	import { formatRent } from '@tran/core/renter/format';
	import type { Provenance } from '$lib/data';
	import { placeLine, streetLine } from '../listing/address';
	import ListingCard from '../search/ListingCard.svelte';

	interface Props {
		row: Listing | null;
		/** Units at one spot that cannot be split by zooming ("{n} rentals at this spot"). */
		spot: readonly Listing[] | null;
		provenance: Provenance | null;
		newIds: ReadonlySet<string>;
		/** Bumped by the map after a pin/cluster activation: focus moves into the preview. */
		focusToken: number;
	}

	let { row, spot, provenance, newIds, focusToken }: Props = $props();

	let root = $state<HTMLElement | null>(null);

	function beds(n: number | null): string | null {
		if (n === null || !Number.isFinite(n)) return null;
		if (n === 0) return 'Studio';
		return n === 1 ? '1 bedroom' : `${n} bedrooms`;
	}

	$effect(() => {
		if (focusToken === 0) return;
		void tick().then(() => {
			root?.querySelector<HTMLAnchorElement>('a[data-preview-link], article a[href]')?.focus();
		});
	});
</script>

<div bind:this={root} aria-live="off" data-selected-preview class="flex flex-col gap-2">
	{#if spot && spot.length > 0}
		<h3 class="text-base leading-[1.6] font-semibold text-foreground">
			{spot.length} rentals at this spot
		</h3>
		<ul class="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
			{#each spot as r (r.id)}
				<li class="flex flex-col gap-1 p-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the ?id= query, built as ListingCard builds it -->
					<a
						data-preview-link
						href={`${resolve('/renter/listing/')}?${new URLSearchParams({ id: r.id }).toString()}`}
						class="inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>{streetLine(r)}</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<span class="text-sm text-muted-foreground">{placeLine(r)}</span>
					<span class="text-sm text-foreground tabular-nums">
						{formatRent(r.price) ? `${formatRent(r.price)} a month` : 'Rent not listed'}{beds(
							r.bedrooms
						)
							? ` · ${beds(r.bedrooms)}`
							: ''}
					</span>
				</li>
			{/each}
		</ul>
	{:else if row && provenance}
		<ListingCard {row} {provenance} isNew={newIds.has(row.id)} selected />
	{:else}
		<p class="text-sm text-muted-foreground">Select a price on the map to see that rental here.</p>
	{/if}
</div>
