<script lang="ts">
	// /investor/compare/ (INV-03). Prerendered shell: the deal ids travel as ?ids=a,b,c and are read
	// in onMount from new URL(location.href). Each saved deal is re-analyzed from its stored inputs
	// and buildComparison marks the top figure per row. Unknown ids are dropped with a note; fewer
	// than 2 valid deals shows the empty state. 0 calls.
	import { onMount, tick } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { analyze, buildComparison, MIN_COMPARE } from '@tran/core/finance';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { announce, buttonVariants } from '$lib/features/shared/data/platform-ui';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import CompareTable, {
		type CompareColumn
	} from '$lib/features/investor/compare/CompareTable.svelte';
	import { getDeal } from '$lib/features/investor/deals/dealsRepo';
	import {
		compareHref,
		droppedNote,
		parseCompareIds
	} from '$lib/features/investor/deals/deals-view';
	import type { DealRecord } from '$lib/features/investor/deals/schema';

	let loaded = $state(false);
	let records = $state<DealRecord[]>([]);
	let dropped = $state(0);
	let h1El = $state<HTMLElement | null>(null);

	const columns = $derived<CompareColumn[]>(
		records.map((r) => ({
			id: r.id,
			name: r.name,
			address: r.address,
			sample: Object.values(r.sources ?? {}).some((s) => s?.source === 'sample')
		}))
	);
	const rows = $derived(
		records.length >= MIN_COMPARE
			? buildComparison(records.map((r) => ({ inputs: r.inputs, analysis: analyze(r.inputs) })))
			: null
	);

	onMount(() => {
		const ids = parseCompareIds(new URL(location.href).search);
		void (async () => {
			const found = await Promise.all(ids.map((id) => getDeal(id).catch(() => null)));
			records = found.filter((r): r is DealRecord => r !== null);
			dropped = ids.length - records.length;
			loaded = true;
		})();
	});

	/** The remove button for `id` in whichever layout is showing (the other is display:none). */
	function visibleRemove(id: string): HTMLElement | null {
		const all = document.querySelectorAll<HTMLElement>(`[data-compare-remove="${CSS.escape(id)}"]`);
		return [...all].find((el) => el.getClientRects().length > 0) ?? null;
	}

	async function remove(id: string): Promise<void> {
		const i = records.findIndex((r) => r.id === id);
		if (i < 0) return;
		const name = records[i].name;
		records = records.filter((r) => r.id !== id);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- compareHref resolves the base
		replaceState(compareHref(records.map((r) => r.id)), {});
		announce(`${name} removed from the comparison.`);
		await tick();
		const next = records.length >= MIN_COMPARE ? records[i] : undefined;
		const target = (next ? visibleRemove(next.id) : null) ?? h1El;
		target?.focus();
	}
</script>

<svelte:head>
	<title>Compare deals: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Compare 2 or 3 of your saved deals side by side, figure by figure."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1
		bind:this={h1El}
		tabindex="-1"
		class="font-display text-display font-semibold focus:outline-none"
	>
		Compare deals
	</h1>
	<p class="mt-4 max-w-prose text-base leading-[1.6] text-foreground">
		Figures from each saved deal, side by side.
	</p>

	{#if !loaded}
		<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
	{:else}
		{#if dropped > 0}
			<p class="mt-4 text-label text-muted-foreground" data-dropped-note>{droppedNote(dropped)}</p>
		{/if}
		{#if rows}
			<div class="mt-6">
				<CompareTable deals={columns} {rows} onremove={(id) => void remove(id)} />
			</div>
		{:else}
			<section
				aria-labelledby="compare-empty-heading"
				class="mt-8 max-w-reading rounded-lg border border-border bg-card p-4 sm:p-6"
				data-compare-empty
			>
				<h2 id="compare-empty-heading" class="font-display text-heading font-semibold">
					Pick at least 2 deals to compare
				</h2>
				<p class="mt-2 text-base leading-[1.6] text-foreground">
					Choose 2 or 3 deals from your saved deals.
				</p>
				<a href={resolve('/investor/deals/')} class="mt-4 {buttonVariants({ variant: 'outline' })}"
					>Go to saved deals</a
				>
			</section>
		{/if}
	{/if}
</div>
