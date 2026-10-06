<script lang="ts">
	// The /renter/ search page body (RENT-01/RENT-02) under the route's h1 and lead.
	//
	// Loading a URL never spends: onMount restores from the query string with gateway.peek only, and
	// a mode switch (new gateway) re-peeks. The URL mirror effect only writes history. Calls are
	// spent solely from the Search / Narrow / Refresh click handlers (search-state.svelte.ts).
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Listing } from '@tran/core/listings';
	import { getDataRuntime, SAMPLE_METROS, type DataGateway } from '$lib/data';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import SavedSearchesSection from '../saved/SavedSearchesSection.svelte';
	import ActiveFilterChips from './ActiveFilterChips.svelte';
	import ResultsHeader from './ResultsHeader.svelte';
	import ResultsView from './ResultsView.svelte';
	import SearchForm from './SearchForm.svelte';
	import StartEmptyState from './StartEmptyState.svelte';
	import TruncationNotice from './TruncationNotice.svelte';
	import { createRenterSearch } from './search-state.svelte';
	import { encodeSearchParams } from '@tran/core/renter';
	import { getRenterSavedSearches } from '../saved/saved-searches';

	const runtime = getDataRuntime();
	const search = createRenterSearch({
		gateway: () => runtime.gateway,
		spend: (req, kind) => runtime.requestSpend<Listing[]>(req, kind),
		now: () => new Date(),
		announce
	});

	let form = $state<ReturnType<typeof SearchForm> | null>(null);
	let restored = $state(false);
	let peekedWith: DataGateway | null = null;

	const gateway = $derived(runtime.gateway);
	const sample = $derived(runtime.mode?.source === 'sample');

	onMount(() => {
		peekedWith = untrack(() => runtime.gateway);
		restore().finally(() => {
			restored = true;
		});
		return () => search.dispose();
	});

	/**
	 * Restores the URL's search (peek only, 0 calls). `?saved={id}` is View results on a saved
	 * search: read its "New" ids BEFORE marking it seen, restore its saved filters, and keep the
	 * badges until the page is left. The URL mirror then drops `saved`, so a reload never re-marks.
	 */
	async function restore(): Promise<void> {
		const savedId = page.url.searchParams.get('saved');
		if (savedId && (await openSaved(savedId))) return;
		await search.restoreFromUrl(page.url.searchParams);
	}

	/** The saved id already opened (each View results marks seen exactly once). */
	let openedSaved: string | null = null;

	async function openSaved(id: string): Promise<boolean> {
		openedSaved = id;
		const opened = await getRenterSavedSearches(() => runtime.gateway)
			.openForResults(id)
			.catch(() => null);
		if (!opened) return false;
		await search.restoreFromUrl(encodeSearchParams(opened.state));
		search.newIds = opened.newIds;
		return true;
	}

	// View results from this same page (a client navigation to /renter/?...&saved={id}) does not
	// remount it, so a new `saved` id in the URL is opened here.
	$effect(() => {
		const id = page.url.searchParams.get('saved');
		if (!id || !restored) return;
		untrack(() => {
			if (id !== openedSaved) void openSaved(id);
		});
	});

	// A new gateway (runtime started, or the mode changed): re-read the cache for the current
	// location. peek only, 0 calls.
	$effect(() => {
		const gw = runtime.gateway;
		if (!gw || !restored) return;
		untrack(() => {
			if (gw === peekedWith) return;
			peekedWith = gw;
			void search.peekCurrent();
		});
	});

	// Mirror the search into the URL (replaceState: Back, reload and shared links restore it).
	// History only; never the gateway.
	$effect(() => {
		const qs = search.toUrlParams().toString();
		if (!restored) return;
		untrack(() => {
			if (new URLSearchParams(page.url.search).toString() === qs) return;
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus this page's own query string
			replaceState(`${resolve('/renter/')}${qs ? `?${qs}` : ''}`, page.state);
		});
	});

	function trySample() {
		search.locInput = SAMPLE_METROS[0].zipCodes[0] ?? SAMPLE_METROS[0].label;
		void search.search();
	}
</script>

<div class="mt-8 flex flex-col gap-8">
	<SavedSearchesSection {search} />

	<div class="flex flex-col gap-4">
		<SearchForm bind:this={form} {search} {gateway} />
		<ActiveFilterChips {search} onEmpty={() => form?.focusFilters()} />
	</div>

	{#if search.status === 'error' && search.error}
		<GatewayError
			error={search.error}
			onTryAgain={() => search.search()}
			onUseSample={() => void runtime.setSourcePreference('sample')}
			onContinuePastCap={() => void search.search()}
			onEditSearch={() => form?.focusLocation()}
		/>
	{:else if search.status === 'ready' || search.rows.length > 0}
		<section
			aria-labelledby="results-heading"
			aria-busy={search.status === 'loading'}
			class="flex flex-col gap-4"
		>
			<ResultsHeader {search} />
			<TruncationNotice {search} {gateway} />
			{#if search.rows.length > 0}
				<!-- 06-16: List | Map tabs, cards and paging. The Map panel body is 06-19's MapTab. -->
				<ResultsView {search} onFiltersCleared={() => form?.focusFilters()} />
			{/if}
		</section>
	{:else}
		<StartEmptyState {sample} onSample={trySample} />
	{/if}
</div>
