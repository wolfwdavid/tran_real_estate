<script lang="ts">
	// 06-UI-SPEC "FairRentCheck" Tier 2 (RENT-06): RentCast's rent estimate for this home.
	// Reading is free: the effect below calls ONLY gateway.peek and gateway.estimateCost, so a cached
	// estimate (or any sample listing) renders with no button and 0 calls. Otherwise "Get rent
	// estimate" shows its cost first, and the one spend is that click, through runtime.requestSpend
	// so the over-cap prompt applies. Copy says "estimate", never a valuation of the home.
	import { untrack } from 'svelte';
	import Calculator from '@lucide/svelte/icons/calculator';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Listing, RentEstimate } from '@tran/core/listings';
	import { displayComparables, estimateConfidence } from '@tran/core/renter/fair-rent';
	import { formatRent } from '@tran/core/renter/format';
	import {
		getDataRuntime,
		isGatewayError,
		type CostEstimate,
		type GatewayError as GatewayErrorType,
		type GatewayResult,
		type Provenance
	} from '$lib/data';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import { rentEstimateRequest } from '../data/requests';
	import RentEstimateResult from './RentEstimateResult.svelte';

	let { row }: { row: Listing } = $props();

	type Tier =
		| { kind: 'loading' }
		| { kind: 'not-requested'; estimate: CostEstimate | null }
		| { kind: 'data'; estimate: RentEstimate; provenance: Provenance }
		| { kind: 'error'; error: GatewayErrorType };

	const runtime = getDataRuntime();
	const sample = $derived(runtime.mode?.source !== 'rentcast');

	let tier = $state<Tier>({ kind: 'loading' });
	let loading = $state(false);

	// Read-only: peek and estimateCost never spend. Re-runs when the listing or gateway changes.
	$effect(() => {
		const gateway = runtime.gateway;
		const req = rentEstimateRequest(row);
		if (!gateway) return;
		let cancelled = false;
		untrack(() => {
			tier = { kind: 'loading' };
			void gateway
				.peek<RentEstimate>(req)
				.then(async (peeked) => {
					if (cancelled) return;
					if (peeked?.kind === 'data') {
						tier = {
							kind: 'data',
							estimate: peeked.result.data,
							provenance: peeked.result.provenance
						};
					} else if (peeked?.kind === 'error') {
						tier = { kind: 'error', error: peeked.error };
					} else {
						const estimate = await gateway.estimateCost(req);
						if (!cancelled) tier = { kind: 'not-requested', estimate };
					}
				})
				.catch(() => {
					if (!cancelled) tier = { kind: 'not-requested', estimate: null };
				});
		});
		return () => {
			cancelled = true;
		};
	});

	function show(r: GatewayResult<RentEstimate>): void {
		tier = { kind: 'data', estimate: r.data, provenance: r.provenance };
	}

	/** "Rent estimate ready: {$est} a month." (+ " Low confidence." when the badge shows). */
	function readyMessage(e: RentEstimate): string {
		const comps = displayComparables(e.comparables, row).rows;
		const low = estimateConfidence(comps.length) === 'low' ? ' Low confidence.' : '';
		return `Rent estimate ready: ${formatRent(e.estimate)} a month.${low}`;
	}

	/** "Get rent estimate (1 call)": the only Tier 2 spend, from a click. */
	async function getEstimate(): Promise<void> {
		if (loading) return;
		loading = true;
		try {
			const r = await runtime.requestSpend<RentEstimate>(rentEstimateRequest(row));
			show(r);
			announce(readyMessage(r.data));
		} catch (error) {
			if (!isGatewayError(error)) throw error;
			if (error.detail !== 'dismissed') tier = { kind: 'error', error };
		} finally {
			loading = false;
		}
	}

	/** Live "Refresh (1 call)". Rejects on error so ProvenanceRow does not announce success. */
	async function refresh(): Promise<void> {
		try {
			show(await runtime.requestSpend<RentEstimate>(rentEstimateRequest(row), 'refresh'));
		} catch (error) {
			if (isGatewayError(error) && error.detail !== 'dismissed') tier = { kind: 'error', error };
			throw error;
		}
	}

	const NO_ESTIMATE = "RentCast couldn't estimate rent for this address.";
</script>

<div class="grid gap-4" data-fair-rent-tier="rent-estimate">
	<h3 class="text-base leading-[1.6] font-semibold text-balance text-foreground">
		Rent estimate for this home
	</h3>

	{#if tier.kind === 'loading'}
		<p class="text-label text-muted-foreground">Checking for a saved estimate…</p>
	{:else if tier.kind === 'not-requested'}
		<p class="text-base leading-[1.6] text-foreground" data-estimate-intro>
			RentCast estimates rent from similar rentals nearby. It's an automated estimate, not a
			professional valuation, and it isn't a figure a landlord has to accept.
		</p>
		<Button variant="outline" class="justify-self-start" disabled={loading} onclick={getEstimate}>
			{#if loading}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				Getting estimate…
			{:else}
				<Calculator size={16} aria-hidden="true" />
				Get rent estimate <CostLabel estimate={tier.estimate} />
			{/if}
		</Button>
	{:else if tier.kind === 'error'}
		{#if tier.error.kind === 'NoResults'}
			<GatewayError error={tier.error} body={NO_ESTIMATE} actions={false} />
		{:else}
			<GatewayError error={tier.error} onTryAgain={getEstimate} />
		{/if}
	{:else}
		<RentEstimateResult {row} estimate={tier.estimate} {sample} />
		{#if tier.provenance.source === 'rentcast'}
			<ProvenanceRow provenance={tier.provenance} onRefresh={refresh} />
		{/if}
	{/if}
</div>
