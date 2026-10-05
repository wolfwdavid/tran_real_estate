<script lang="ts">
	// /renter/listing/?id= (RENT-03). Prerendered once with no id (static hosting forbids [param]
	// routes); the id is read in the browser only, because Kit throws when a prerendered page reads
	// the query string. A same-route ?id=a -> ?id=b navigation re-resolves through the derived id.
	//
	// Resolution costs 0 calls by construction (resolveListing reads the shortlist and the cache
	// only). The single spending path is the "Look it up again (1 call)" click handler, plus the live
	// header's "Refresh (1 call)"; both go through runtime.requestSpend so the cap prompt applies.
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import type { Listing } from '@tran/core/listings';
	import {
		getDataRuntime,
		isGatewayError,
		type CostEstimate,
		type GatewayError,
		type GatewayResult
	} from '$lib/data';
	import { listingByIdRequest } from '$lib/features/renter/data/requests';
	import { streetLine } from '$lib/features/renter/listing/address';
	import ListingDetail from '$lib/features/renter/listing/ListingDetail.svelte';
	import ListingNotFound from '$lib/features/renter/listing/ListingNotFound.svelte';
	import {
		fetchListingById,
		resolveListing,
		type ResolveDeps,
		type ResolvedListing
	} from '$lib/features/renter/listing/resolve';
	import { getShortlistRepo } from '$lib/features/renter/storage/shortlist-repo';

	const runtime = getDataRuntime();

	const id = $derived(browser ? page.url.searchParams.get('id') : null);
	const mode = $derived<'sample' | 'live'>(runtime.mode?.source === 'rentcast' ? 'live' : 'sample');

	let view = $state<'loading' | ResolvedListing>('loading');
	let estimate = $state<CostEstimate | null>(null);
	let refreshError = $state<GatewayError | null>(null);
	/** True after a lookup replaced the not-found view, so focus moves to the new h1. */
	let focusHeading = $state(false);

	function deps(): ResolveDeps {
		const gateway = runtime.gateway;
		if (!gateway) throw new Error('data runtime has no gateway yet');
		return {
			shortlist: getShortlistRepo(),
			gateway,
			mode: () => mode,
			spend: (req) => runtime.requestSpend<Listing>(req)
		};
	}

	// Re-resolves when the id changes or the runtime swaps gateways (mode change). Reads only:
	// resolveListing never spends, and estimateCost is free.
	$effect(() => {
		const current = id;
		const gateway = runtime.gateway;
		if (!browser || !gateway || !runtime.mode) return;
		let cancelled = false;
		untrack(() => {
			view = 'loading';
			estimate = null;
			refreshError = null;
			focusHeading = false;
			void resolveListing(current, deps()).then(async (r) => {
				if (cancelled) return;
				view = r;
				if (r.kind === 'not-found' && r.canFetch && current) {
					const cost = await gateway.estimateCost(listingByIdRequest(current));
					if (!cancelled) estimate = cost;
				}
			});
		});
		return () => {
			cancelled = true;
		};
	});

	/** "Look it up again (1 call)": the only by-id spend, from a click. */
	async function lookUp(): Promise<void> {
		if (!id) return;
		const r = await fetchListingById(id, deps());
		view = r;
		focusHeading = r.kind === 'found';
	}

	/** Live header "Refresh (1 call)". Rejects on error so ProvenanceRow does not announce success. */
	async function refresh(): Promise<void> {
		if (!id) return;
		refreshError = null;
		try {
			const r: GatewayResult<Listing> = await runtime.requestSpend<Listing>(
				listingByIdRequest(id),
				'refresh'
			);
			view = { kind: 'found', source: 'network', row: r.data, provenance: r.provenance };
		} catch (error) {
			if (isGatewayError(error) && error.detail !== 'dismissed') refreshError = error;
			throw error;
		}
	}

	const title = $derived(
		view === 'loading'
			? 'Listing details'
			: view.kind === 'found'
				? streetLine(view.row)
				: 'Listing not found'
	);
</script>

<svelte:head>
	<title>{title}: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Details for one rental listing: rent, facts, price history and how to reach the listing contact."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 py-12 md:px-8 md:py-16">
	{#if view === 'loading'}
		<div class="max-w-reading">
			<h1 class="font-display text-display font-semibold">Listing details</h1>
			<p class="mt-4 text-label text-muted-foreground">Loading listing…</p>
		</div>
	{:else if view.kind === 'found'}
		<ListingDetail
			row={view.row}
			provenance={view.provenance}
			{mode}
			onRefresh={view.provenance.source === 'rentcast' ? refresh : undefined}
			{refreshError}
			{focusHeading}
		/>
	{:else}
		<ListingNotFound
			variant={view.kind}
			canFetch={view.kind === 'not-found' && view.canFetch}
			error={view.kind === 'not-found' ? view.error : undefined}
			{estimate}
			onLookUp={lookUp}
		/>
	{/if}
</div>
