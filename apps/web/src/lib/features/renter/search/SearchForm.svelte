<script lang="ts">
	// 06-UI-SPEC "SearchForm" (RENT-01): required location + Search rentals with its cost, then the
	// local filters (a disclosure below 1024px, always open from 1024px). Submitting is the only
	// spend here; every filter change is local and free.
	import { hasLocalFilters, filterCount } from '@tran/core/renter';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import type { DataGateway } from '$lib/data';
	import { Button } from '$lib/components/ui/button/index.js';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import LocationField from '$lib/features/shared/listings/LocationField.svelte';
	import { createCostEstimate } from './cost-estimate.svelte';
	import FilterFields from './FilterFields.svelte';
	import type { RenterSearch } from './search-state.svelte';

	let { search, gateway }: { search: RenterSearch; gateway: DataGateway | null } = $props();

	let inputEl = $state<HTMLInputElement | undefined>();
	let filtersButton = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);
	let open = $state(false);

	const loading = $derived(search.status === 'loading');
	const count = $derived(filterCount(search.filters));
	const cost = createCostEstimate(() => ({
		gateway,
		request: search.typedRequest,
		version: search.version
	}));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		await search.search();
		if (search.locationError) inputEl?.focus();
	}

	/** Escape inside the open panel closes it and returns focus to the Filters button (< 1024px). */
	$effect(() => {
		const el = panel;
		if (!el) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || !open || !isVisible(filtersButton)) return;
			e.preventDefault();
			open = false;
			filtersButton?.focus();
		};
		el.addEventListener('keydown', onKey);
		return () => el.removeEventListener('keydown', onKey);
	});

	const isVisible = (el: HTMLElement | null): el is HTMLElement =>
		el !== null && el.getClientRects().length > 0;

	/** Focus target after the last filter chip is removed: the Filters button, else the first field. */
	export function focusFilters() {
		if (isVisible(filtersButton)) filtersButton.focus();
		else panel?.querySelector<HTMLElement>('input')?.focus();
	}

	export function focusLocation() {
		inputEl?.focus();
	}
</script>

<form
	role="search"
	aria-label="Search rentals"
	novalidate
	onsubmit={submit}
	class="rounded-lg border border-border bg-card p-4 sm:p-6"
>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
		<div class="min-w-0 flex-1">
			<LocationField
				id="renter-location"
				bind:value={search.locInput}
				bind:inputEl
				error={search.locationError}
			/>
		</div>
		<!-- Aligned with the input: label line (16px × 1.6) + the 8px label gap. The label may wrap
		     ("Search rentals (0 calls · sample data)" under WCAG 1.4.12 text spacing at 375px). -->
		<Button
			type="submit"
			class="h-auto min-h-12 w-full py-2 whitespace-normal sm:mt-[calc(1.6rem+0.5rem)] sm:w-auto"
			disabled={loading}
		>
			{#if loading}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				Searching…
			{:else}
				<SearchIcon class="size-4" aria-hidden="true" />
				Search rentals <CostLabel estimate={cost.current} />
			{/if}
		</Button>
	</div>

	<div class="mt-4">
		<Button
			variant="outline"
			class="h-11 w-full sm:w-auto lg:hidden"
			aria-expanded={open}
			aria-controls="renter-filters"
			bind:ref={filtersButton}
			onclick={() => (open = !open)}
		>
			<SlidersHorizontal class="size-4" aria-hidden="true" />
			{count > 0 ? `Filters · ${count}` : 'Filters'}
		</Button>
		<div
			id="renter-filters"
			bind:this={panel}
			class="{open
				? 'mt-2 block'
				: 'hidden'} rounded-lg bg-surface p-4 lg:mt-0 lg:block lg:bg-transparent lg:p-0"
		>
			<FilterFields {search} />
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<p class="text-label text-muted-foreground">Shows active listings only.</p>
				{#if hasLocalFilters(search.filters)}
					<Button variant="ghost" class="h-11" onclick={() => search.clearFilters()}
						>Clear filters</Button
					>
				{/if}
			</div>
		</div>
	</div>
</form>
