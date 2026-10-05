<script lang="ts">
	// 06-UI-SPEC results list (RENT-02): sorted cards, 24 at a time. "Show 24 more" pages locally
	// (0 calls: the rows are already in memory), moves focus to the first newly rendered card's
	// address link and announces the new count. No infinite scroll. While a search is in flight for
	// more than 300ms, six card-shaped skeletons hold the space.
	import { tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import ListingCard from './ListingCard.svelte';
	import { PAGE_SIZE, type RenterSearch } from './search-state.svelte';

	interface Props {
		search: RenterSearch;
		/** Split-view list column: one column of compact cards. */
		compact?: boolean;
		now?: Date;
	}

	let { search, compact = false, now = new Date() }: Props = $props();

	const SKELETON_DELAY_MS = 300;
	const SKELETONS = [0, 1, 2, 3, 4, 5];

	const total = $derived(search.sorted.length);
	const visible = $derived(search.sorted.slice(0, search.shownCount));
	const shown = $derived(visible.length);
	const remaining = $derived(total - shown);

	let slow = $state(false);
	$effect(() => {
		if (search.status !== 'loading') {
			slow = false;
			return;
		}
		const id = setTimeout(() => {
			slow = true;
		}, SKELETON_DELAY_MS);
		return () => clearTimeout(id);
	});

	let listEl = $state<HTMLElement | null>(null);

	async function showMore(): Promise<void> {
		const firstNew = shown;
		search.showMore();
		await tick();
		const row = search.sorted[firstNew];
		if (row) {
			const link = listEl?.querySelector<HTMLElement>(`#${CSS.escape(`card-${row.id}-addr`)}`);
			link?.focus();
		}
		announce(`Showing ${shown} of ${total}.`);
	}
</script>

{#if slow}
	<ul
		aria-hidden="true"
		data-results-skeleton
		class="grid gap-4 {compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}"
	>
		{#each SKELETONS as i (i)}
			<li
				class="flex h-56 gap-4 rounded-lg border border-border bg-surface p-4 motion-safe:animate-pulse"
			>
				{#if !compact}<span class="size-16 shrink-0 rounded-full bg-card"></span>{/if}
				<span class="flex flex-1 flex-col gap-2">
					<span class="h-8 w-1/2 rounded-md bg-card"></span>
					<span class="h-5 w-3/4 rounded-md bg-card"></span>
					<span class="h-5 w-2/3 rounded-md bg-card"></span>
				</span>
			</li>
		{/each}
	</ul>
{:else if search.provenance}
	{@const provenance = search.provenance}
	<ul
		bind:this={listEl}
		data-results-list
		class="grid gap-4 {compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}"
	>
		{#each visible as row (row.id)}
			<li class="min-w-0">
				<ListingCard
					{row}
					{provenance}
					{now}
					{compact}
					isNew={search.newIds.has(row.id)}
					selected={search.selectedListingId === row.id}
					highlighted={search.hoveredListingId === row.id}
					onhover={(id) => search.hover(id)}
				/>
			</li>
		{/each}
	</ul>
	{#if total > PAGE_SIZE}
		<div class="flex flex-col items-start gap-2">
			<p data-results-count class="text-label text-muted-foreground tabular-nums">
				Showing {shown} of {total}
			</p>
			{#if remaining > 0}
				<Button
					variant="outline"
					class="h-auto min-h-11 w-full py-2 whitespace-normal sm:w-auto"
					onclick={showMore}
				>
					{remaining >= PAGE_SIZE ? 'Show 24 more' : `Show ${remaining} more`}
				</Button>
			{/if}
		</div>
	{/if}
{/if}
