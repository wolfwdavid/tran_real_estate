<script lang="ts">
	// 06-UI-SPEC "ShortlistBoard" (RENT-05): the summary line and the saved listings, or the empty
	// state. Reads the shortlist through a liveQuery (0 calls); nothing renders until the first
	// result, so the empty state never flashes over a populated shortlist (or into prerendered HTML).
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { shortlistSummary, type ShortlistItem } from '@tran/core/renter/records';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import type { DataGateway } from '$lib/data';
	import { live } from '$lib/storage/live.svelte';
	import { getShortlistRepo } from '../storage/shortlist-repo';
	import ShortlistCard from './ShortlistCard.svelte';

	interface Props {
		/** Fixed items (SSR tests); omitted, the board follows the shortlist repo live. */
		items?: readonly ShortlistItem[] | null;
		/** Cache-only reads for the rent-change line (null during prerender). */
		gateway?: Pick<DataGateway, 'peekListingById'> | null;
	}

	let { items: fixed, gateway = null }: Props = $props();

	const source = live<ShortlistItem[] | null>(() => getShortlistRepo().liveAll(), null);
	const items = $derived(fixed !== undefined ? fixed : source.current);

	const ordered = $derived(
		items === null
			? []
			: [...items].sort(
					(a, b) =>
						b.statusChangedAt - a.statusChangedAt ||
						(a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0)
				)
	);

	const summary = $derived.by(() => {
		const s = shortlistSummary(ordered);
		const n = s.total === 1 ? '1 listing' : `${s.total} listings`;
		return `${n} · ${s.contacted} contacted · ${s.applied} applied`;
	});

	// --- Focus after a removal ----------------------------------------------------------------
	let summaryEl = $state<HTMLElement | null>(null);
	let emptyHeadingEl = $state<HTMLElement | null>(null);

	/** Focus `target` once `ready(items)` holds, i.e. after the liveQuery re-rendered the board. */
	let pending = $state<{
		ready: (list: readonly ShortlistItem[]) => boolean;
		target: () => HTMLElement | null;
	} | null>(null);

	$effect(() => {
		const list = items;
		const p = pending;
		if (!p || list === null || !p.ready(list)) return;
		pending = null;
		void tick().then(() => p.target()?.focus());
	});

	const cardEl = (listingId: string) =>
		document.getElementById('item-' + encodeURIComponent(listingId));

	function onRemoving(listingId: string): void {
		const i = ordered.findIndex((x) => x.listingId === listingId);
		const next = ordered[i + 1] ?? ordered[i - 1];
		pending = {
			ready: (list) => !list.some((x) => x.listingId === listingId),
			target: () => (next ? cardEl(next.listingId) : (summaryEl ?? emptyHeadingEl))
		};
	}

	// A #item-{id} link from the listing detail: the cards render after the first query, so the
	// browser could not scroll to the fragment on load. Do it once the item is on the board.
	let fragmentDone = false;
	$effect(() => {
		if (fragmentDone || items === null) return;
		fragmentDone = true;
		const hash = decodeURIComponent(location.hash.slice(1));
		if (!hash.startsWith('item-')) return;
		const listingId = hash.slice('item-'.length);
		if (!items.some((x) => x.listingId === listingId)) return;
		void tick().then(() => {
			const el = cardEl(listingId);
			el?.scrollIntoView({ block: 'start' });
			el?.focus({ preventScroll: true });
		});
	});
</script>

{#if items !== null}
	{#if ordered.length === 0}
		<section class="mt-8 grid max-w-reading justify-items-start gap-4" data-shortlist-empty>
			<h2
				bind:this={emptyHeadingEl}
				tabindex="-1"
				class="font-display text-heading font-semibold focus:outline-none"
			>
				Your shortlist is empty
			</h2>
			<p class="text-base leading-[1.6] text-muted-foreground">
				Save listings from your search results to compare them and track where each one stands.
			</p>
			<ButtonLink href={resolve('/renter/')}>Search rentals</ButtonLink>
		</section>
	{:else}
		<div class="mt-8 grid gap-6" data-shortlist-board>
			<p
				bind:this={summaryEl}
				tabindex="-1"
				class="text-label text-muted-foreground tabular-nums focus:outline-none"
				data-shortlist-summary
			>
				{summary}
			</p>
			<ul class="grid gap-4 md:grid-cols-2">
				{#each ordered as item (item.listingId)}
					<li class="min-w-0">
						<ShortlistCard {item} {gateway} {onRemoving} onRemoveFailed={() => (pending = null)} />
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/if}
