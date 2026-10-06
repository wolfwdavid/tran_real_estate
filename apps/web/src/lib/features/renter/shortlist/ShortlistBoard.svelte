<script lang="ts">
	// 06-UI-SPEC "ShortlistBoard" (RENT-05): the summary line and five status sections in pipeline
	// order (stacked below 1280px, a 5-column board from 1280px), or the empty state. Reads the shortlist through a liveQuery (0 calls); nothing renders until the first
	// result, so the empty state never flashes over a populated shortlist (or into prerendered HTML).
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		groupByStatus,
		SHORTLIST_STATUSES,
		shortlistSummary,
		STATUS_LABELS,
		type ShortlistItem,
		type ShortlistStatus
	} from '@tran/core/renter/records';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import type { DataGateway } from '$lib/data';
	import { live } from '$lib/storage/live.svelte';
	import { getShortlistRepo } from '../storage/shortlist-repo';
	import ShortlistCard from './ShortlistCard.svelte';
	import { STATUS_ICONS } from './status-icons';

	interface Props {
		/** Fixed items (SSR tests); omitted, the board follows the shortlist repo live. */
		items?: readonly ShortlistItem[] | null;
		/** Cache-only reads for the rent-change line (null during prerender). */
		gateway?: Pick<DataGateway, 'peekListingById'> | null;
	}

	let { items: fixed, gateway = null }: Props = $props();

	const source = live<ShortlistItem[] | null>(() => getShortlistRepo().liveAll(), null);
	const items = $derived(fixed !== undefined ? fixed : source.current);

	/** All five statuses, each newest status change first (core groupByStatus; tombstones out). */
	const groups = $derived(groupByStatus(items ?? []));
	const total = $derived(SHORTLIST_STATUSES.reduce((n, st) => n + groups[st].length, 0));

	const summary = $derived.by(() => {
		const s = shortlistSummary(items ?? []);
		const n = s.total === 1 ? '1 listing' : `${s.total} listings`;
		return `${n} · ${s.contacted} contacted · ${s.applied} applied`;
	});

	// --- Focus after a move or a removal -------------------------------------------------------
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

	const headingId = (status: ShortlistStatus) => `shortlist-section-${status}`;

	/** Remove: the next card in the same section, else that section's heading. */
	function onRemoving(listingId: string): void {
		const status = items?.find((x) => x.listingId === listingId)?.status;
		if (!status) return;
		const group = groups[status];
		const next = group[group.findIndex((x) => x.listingId === listingId) + 1];
		pending = {
			ready: (list) => !list.some((x) => x.listingId === listingId),
			target: () =>
				(next ? cardEl(next.listingId) : document.getElementById(headingId(status))) ??
				emptyHeadingEl
		};
	}

	/** Status change: the same card's select, once the card has re-rendered in its new section. */
	function onStatusChanging(listingId: string, status: ShortlistStatus): void {
		pending = {
			ready: (list) => list.some((x) => x.listingId === listingId && x.status === status),
			target: () => document.getElementById('status-' + encodeURIComponent(listingId))
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
	{#if total === 0}
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
			<p class="text-label text-muted-foreground tabular-nums" data-shortlist-summary>
				{summary}
			</p>
			<div class="grid gap-8 xl:grid xl:grid-cols-5 xl:items-start xl:gap-4">
				{#each SHORTLIST_STATUSES as status (status)}
					{@const Icon = STATUS_ICONS[status]}
					{@const group = groups[status]}
					<section
						aria-labelledby={headingId(status)}
						class="grid min-w-0 gap-4 xl:rounded-lg xl:bg-surface xl:p-4"
						data-shortlist-section={status}
					>
						<h2
							id={headingId(status)}
							tabindex="-1"
							class="flex items-center gap-2 text-base leading-[1.6] font-semibold text-foreground focus:outline-none"
						>
							<Icon size={16} aria-hidden="true" />
							<span>{STATUS_LABELS[status]} <span class="tabular-nums">({group.length})</span></span
							>
						</h2>
						{#if group.length === 0}
							<p class="text-base leading-[1.6] text-muted-foreground">Nothing here yet.</p>
						{:else}
							<ul class="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
								{#each group as item (item.listingId)}
									<li class="min-w-0">
										<ShortlistCard
											{item}
											{gateway}
											{onRemoving}
											{onStatusChanging}
											onRemoveFailed={() => (pending = null)}
										/>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/each}
			</div>
		</div>
	{/if}
{/if}
