<script lang="ts">
	// 07-UI-SPEC "Deals list" (INV-03): sort, the in-memory compare selection (max 3, never saved)
	// and the saved deal cards. Figures are recomputed from each deal's stored inputs. Focus after a
	// delete is owned here (06-15 pending-focus pattern): the card reports the intent before its
	// write, and once the live list no longer holds the deal the next card's heading, else the
	// previous one's, else the empty-state heading takes focus.
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { analyze } from '@tran/core/finance';
	import { announce, buttonVariants } from '$lib/features/shared/data/platform-ui';
	import CompareBar from './CompareBar.svelte';
	import DealCard from './DealCard.svelte';
	import {
		COMPARE_CAP_REASON,
		isSortKey,
		SORT_OPTIONS,
		sortDeals,
		toggleSelection,
		type DealRow,
		type SortKey
	} from './deals-view';
	import type { DealRecord } from './schema';

	interface Props {
		/** Live deals; undefined until the first query resolves. */
		deals: readonly DealRecord[] | undefined;
	}

	let { deals }: Props = $props();

	let sortKey = $state<SortKey>('saved');
	let picked = $state<string[]>([]);
	let capNotice = $state(false);

	// Relative "Saved …" times re-render at most once a minute.
	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(id);
	});

	const rows = $derived<DealRow[] | undefined>(
		deals?.map((record) => ({ record, analysis: analyze(record.inputs) }))
	);
	const sorted = $derived(rows ? sortDeals(rows, sortKey) : undefined);
	/** Selection never points at a deleted deal. */
	const selected = $derived(deals ? picked.filter((id) => deals.some((d) => d.id === id)) : picked);
	const atCap = $derived(selected.length >= 3);

	function toggle(id: string): void {
		const r = toggleSelection(selected, id);
		picked = r.selected;
		if (r.blocked) {
			capNotice = true;
			announce(COMPARE_CAP_REASON);
		} else {
			capNotice = false;
		}
	}

	function clear(): void {
		picked = [];
		capNotice = false;
	}

	function onSort(e: Event & { currentTarget: HTMLSelectElement }): void {
		const v = e.currentTarget.value;
		if (isSortKey(v)) sortKey = v;
	}

	// --- Focus after a delete --------------------------------------------------------------------
	let emptyHeadingEl = $state<HTMLElement | null>(null);
	let pending = $state<{
		ready: (list: readonly DealRecord[]) => boolean;
		target: () => HTMLElement | null;
	} | null>(null);

	$effect(() => {
		const list = deals;
		const p = pending;
		if (!p || list === undefined || !p.ready(list)) return;
		pending = null;
		void tick().then(() => p.target()?.focus());
	});

	const headingEl = (id: string) => document.getElementById(`deal-${id}-name`);

	function onDeleting(id: string): void {
		const order = sorted ?? [];
		const i = order.findIndex((r) => r.record.id === id);
		const next = order[i + 1]?.record.id;
		const prev = i > 0 ? order[i - 1]?.record.id : undefined;
		pending = {
			ready: (list) => !list.some((d) => d.id === id),
			target: () =>
				(next ? headingEl(next) : null) ?? (prev ? headingEl(prev) : null) ?? emptyHeadingEl
		};
	}

	const selectCls =
		'h-12 w-full min-w-0 cursor-pointer touch-manipulation appearance-none rounded-md border border-input bg-card pr-12 pl-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

{#if sorted === undefined}
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
{:else if sorted.length === 0}
	<section
		aria-labelledby="deals-empty-heading"
		class="mt-8 max-w-reading rounded-lg border border-border bg-card p-4 sm:p-6"
		data-deals-empty
	>
		<h2
			id="deals-empty-heading"
			bind:this={emptyHeadingEl}
			tabindex="-1"
			class="font-display text-heading font-semibold text-foreground focus:outline-none"
		>
			No saved deals yet
		</h2>
		<p class="mt-2 text-base leading-[1.6] text-foreground">
			Analyze a property and save it to keep it here. You can compare up to 3 saved deals side by
			side.
		</p>
		<div class="mt-4 flex flex-wrap gap-2">
			<a href={resolve('/investor/analyze/')} class={buttonVariants()}>Analyze a deal</a>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus ?sample=1 -->
			<a
				href={`${resolve('/investor/analyze/')}?sample=1`}
				class={buttonVariants({ variant: 'outline' })}>Try a sample deal</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</section>
{:else}
	<div class="mt-6 grid max-w-sm gap-2">
		<label for="deals-sort" class="text-base leading-[1.6] font-semibold text-foreground"
			>Sort by</label
		>
		<div class="relative">
			<select id="deals-sort" class={selectCls} value={sortKey} onchange={onSort}>
				{#each SORT_OPTIONS as o (o.key)}
					<option value={o.key}>{o.label}</option>
				{/each}
			</select>
			<ChevronDown
				class="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
		</div>
	</div>

	<div class="mt-6">
		<CompareBar {selected} {capNotice} onclear={clear} />
	</div>

	<ul class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-deals-list>
		{#each sorted as row (row.record.id)}
			<li class="min-w-0">
				<DealCard
					{row}
					{now}
					selected={selected.includes(row.record.id)}
					{atCap}
					ontoggle={toggle}
					{onDeleting}
					onDeleteFailed={() => (pending = null)}
				/>
			</li>
		{/each}
	</ul>
{/if}
