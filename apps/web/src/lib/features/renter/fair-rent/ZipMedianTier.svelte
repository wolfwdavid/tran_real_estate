<script lang="ts">
	// 06-UI-SPEC "FairRentCheck" Tier 1 (RENT-06): the asking rent against the ZIP median.
	// Reading is free: the effect below calls ONLY gateway.peek (cache in live mode, fixtures in
	// sample mode) and gateway.estimateCost, so a ZIP whose market stats are cached, or any sample
	// listing, renders at 0 calls. When nothing is cached the button shows its cost first, and the
	// one spend is that click, through runtime.requestSpend so the over-cap prompt applies.
	// The request is the same one Phase 7 uses, so one 30-day cache entry serves both portals.
	import { tick, untrack } from 'svelte';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Listing, MarketStats } from '@tran/core/listings';
	import {
		getDataRuntime,
		GatewayError as GatewayErrorClass,
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
	import { marketsRequest } from '../data/requests';
	import ZipMedianResult from './ZipMedianResult.svelte';

	let { row }: { row: Listing } = $props();

	type Tier =
		| { kind: 'loading' }
		| { kind: 'not-cached'; estimate: CostEstimate | null }
		| { kind: 'data'; stats: MarketStats; provenance: Provenance }
		| { kind: 'error'; error: GatewayErrorType };

	const runtime = getDataRuntime();
	const zip = $derived(row.zipCode);

	let tier = $state<Tier>({ kind: 'loading' });
	let loading = $state(false);
	let body = $state<HTMLElement | null>(null);

	// Read-only: peek and estimateCost never spend. Re-runs when the ZIP or the gateway changes.
	$effect(() => {
		const gateway = runtime.gateway;
		const req = marketsRequest(zip);
		if (!gateway) return;
		let cancelled = false;
		untrack(() => {
			tier = { kind: 'loading' };
			void gateway
				.peek<MarketStats>(req)
				.then(async (peeked) => {
					if (cancelled) return;
					if (peeked?.kind === 'data') {
						tier = {
							kind: 'data',
							stats: peeked.result.data,
							provenance: peeked.result.provenance
						};
					} else if (peeked?.kind === 'error') {
						tier = { kind: 'error', error: peeked.error };
					} else {
						const estimate = await gateway.estimateCost(req);
						if (!cancelled) tier = { kind: 'not-cached', estimate };
					}
				})
				.catch(() => {
					// Storage unavailable: offer the explicit load rather than nothing.
					if (!cancelled) tier = { kind: 'not-cached', estimate: null };
				});
		});
		return () => {
			cancelled = true;
		};
	});

	/** No usable rental stats in a successful answer reads the same as RentCast's 404. */
	const NO_DATA = new GatewayErrorClass({ kind: 'NoResults' });
	const hasRental = (s: MarketStats) =>
		s.rental !== null && (s.rental.byBedrooms.length > 0 || s.rental.median !== null);

	function show(r: GatewayResult<MarketStats>): void {
		tier = { kind: 'data', stats: r.data, provenance: r.provenance };
	}

	/** Announces the rendered result sentence, so the spoken text is exactly the visible text. */
	async function announceResult(): Promise<void> {
		await tick();
		const text = [...(body?.querySelectorAll('[data-fair-rent-sentence]') ?? [])]
			.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
			.join(' ');
		if (text) announce(text);
	}

	/** "Load {zip} rent data (1 call)": the only Tier 1 spend, from a click. */
	async function load(): Promise<void> {
		if (loading) return;
		loading = true;
		try {
			show(await runtime.requestSpend<MarketStats>(marketsRequest(zip)));
			await announceResult();
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
			show(await runtime.requestSpend<MarketStats>(marketsRequest(zip), 'refresh'));
		} catch (error) {
			if (isGatewayError(error) && error.detail !== 'dismissed') tier = { kind: 'error', error };
			throw error;
		}
	}

	const NO_ZIP_DATA = $derived(
		`RentCast has no rent data for ${zip} yet. The rent estimate below compares this home with nearby rentals instead.`
	);
</script>

<div class="grid gap-4" data-fair-rent-tier="zip-median">
	<h3 class="text-base leading-[1.6] font-semibold text-balance text-foreground">
		Compared with the ZIP median
	</h3>

	<div class="grid gap-4" bind:this={body}>
		{#if tier.kind === 'loading'}
			<p class="text-label text-muted-foreground">Checking saved {zip} rent data…</p>
		{:else if tier.kind === 'not-cached'}
			<p class="text-base leading-[1.6] text-foreground">
				See how this rent sits against the typical rent in {zip}. ZIP data is saved for 30 days, so
				other listings in {zip} reuse it at no cost.
			</p>
			<Button variant="outline" class="justify-self-start" disabled={loading} onclick={load}>
				{#if loading}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Loading…
				{:else}
					<ChartColumn size={16} aria-hidden="true" />
					Load {zip} rent data <CostLabel estimate={tier.estimate} />
				{/if}
			</Button>
		{:else if tier.kind === 'error'}
			{#if tier.error.kind === 'NoResults'}
				<GatewayError error={tier.error} body={NO_ZIP_DATA} actions={false} />
			{:else}
				<GatewayError error={tier.error} onTryAgain={load} />
			{/if}
		{:else if tier.stats.rental && hasRental(tier.stats)}
			<ZipMedianResult {row} rental={tier.stats.rental} {zip} />
			{#if tier.provenance.source === 'rentcast'}
				<ProvenanceRow provenance={tier.provenance} onRefresh={refresh} />
			{/if}
		{:else}
			<GatewayError error={NO_DATA} body={NO_ZIP_DATA} actions={false} />
		{/if}
	</div>
</div>
