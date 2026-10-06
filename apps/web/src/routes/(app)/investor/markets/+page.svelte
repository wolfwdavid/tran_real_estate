<script lang="ts">
	// /investor/markets/ (INV-05). Prerendered shell: watched ZIP codes load in the browser.
	// Opening the page never spends: each card's figures come from the free peek (cache in live
	// mode, fixtures in sample mode). Calls happen only on Watch ZIP (1 call unless cached) and
	// on a card's Refresh (1 call), both click handlers.
	import { onMount, tick, untrack } from 'svelte';
	import { MAX_WATCHED_ZIPS } from '@tran/core/markets';
	import { getDataRuntime, isGatewayError, type GatewayError } from '$lib/data';
	import { announce } from '$lib/features/shared/data/platform-ui';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import { loadMarket, readMarketOnMount } from '$lib/features/shared/markets/market-load';
	import { useMarketsPort, type MarketResult } from '$lib/features/shared/markets/markets-port';
	import WatchZipForm from '$lib/features/shared/markets/WatchZipForm.svelte';
	import ZipCard from '$lib/features/shared/markets/ZipCard.svelte';
	import {
		unwatchZip,
		watchedZipsLive,
		type WatchedZip
	} from '$lib/features/shared/markets/watchedZipsRepo';

	type CardData = { result?: MarketResult; error?: GatewayError };

	// Built during component init: the runtime lives in Svelte context.
	const runtime = getDataRuntime();
	const port = useMarketsPort();

	let watchedLive = $state<{ readonly current: WatchedZip[] | undefined } | null>(null);
	/** Optimistic edits, so focus can move before the live query catches up. */
	let added = $state<string[]>([]);
	let removed = $state<string[]>([]);
	let cards = $state<Record<string, CardData>>({});
	let zipInput = $state<HTMLInputElement | null>(null);

	const base = $derived(watchedLive?.current?.map((w) => w.zip));
	const zips = $derived.by(() => {
		if (base === undefined) return undefined;
		const list = base.filter((z) => !removed.includes(z));
		for (const z of added) if (!list.includes(z) && !removed.includes(z)) list.push(z);
		return list;
	});
	const atLimit = $derived((zips?.length ?? 0) >= MAX_WATCHED_ZIPS);
	const headingId = (zip: string) => `zip-card-${zip}`;

	onMount(() => {
		watchedLive = watchedZipsLive();
	});

	// Drop optimistic edits once the live list agrees with them.
	$effect(() => {
		const live = base;
		if (!live) return;
		untrack(() => {
			added = added.filter((z) => !live.includes(z));
			removed = removed.filter((z) => live.includes(z));
		});
	});

	// The free read for every watched ZIP without figures yet (peek only, never a call). A mode
	// switch rebuilds the gateway, so every card is read again under the new source.
	let readGateway: unknown = null;
	$effect(() => {
		const gateway = runtime.gateway;
		const list = zips;
		if (!gateway || !list) return;
		untrack(() => {
			if (readGateway !== gateway) {
				readGateway = gateway;
				cards = {};
			}
			for (const zip of list) {
				if (cards[zip]) continue;
				cards[zip] = {};
				readMarketOnMount(port, zip)
					.then((result) => {
						if (readGateway === gateway) cards[zip] = { result };
					})
					.catch((error: unknown) => {
						if (readGateway === gateway && isGatewayError(error)) cards[zip] = { error };
					});
			}
		});
	});

	async function focusHeading(zip: string): Promise<void> {
		await tick();
		document.getElementById(headingId(zip))?.focus();
	}

	async function onWatched(zip: string, result: MarketResult): Promise<void> {
		removed = removed.filter((z) => z !== zip);
		if (!added.includes(zip)) added = [...added, zip];
		cards[zip] = { result };
		await focusHeading(zip);
	}

	async function stop(zip: string): Promise<void> {
		const list = zips ?? [];
		const at = list.indexOf(zip);
		const rest = list.filter((z) => z !== zip);
		const next = rest[at] ?? rest[at - 1];
		added = added.filter((z) => z !== zip);
		removed = [...removed, zip];
		await unwatchZip(zip);
		announce(`Stopped watching ZIP ${zip}. Its saved data stays in this browser.`);
		if (next) {
			await focusHeading(next);
		} else {
			await tick();
			zipInput?.focus();
		}
	}

	/** Refresh (1 call), from ProvenanceRow's click. Rejects so the row does not announce success. */
	async function refresh(zip: string): Promise<void> {
		const out = await loadMarket(port, zip, { refresh: true });
		if (out.ok) {
			cards[zip] = { result: out.result };
			return;
		}
		if (out.kind === 'cap' && out.dismissed) throw out.error;
		if (isGatewayError(out.error)) cards[zip] = { ...cards[zip], error: out.error };
		throw out.error;
	}
</script>

<svelte:head>
	<title>Markets: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Watch up to 5 ZIP codes and follow their rent trends and price-to-rent figures."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Markets</h1>
	<p class="mt-4 max-w-prose text-base leading-[1.6] text-foreground">
		Rent trends and price-to-rent figures for up to 5 ZIP codes. Market data is saved in this
		browser for 30 days, so opening a dashboard again costs nothing.
	</p>

	{#if zips === undefined}
		<p class="mt-6 text-label text-muted-foreground">Loading your investor data…</p>
	{:else}
		<div class="mt-6 flex flex-col gap-4">
			{#if zips.length === 0}
				<div>
					<h2 class="text-base leading-[1.6] font-semibold text-foreground">
						No ZIP codes watched yet
					</h2>
					<p class="mt-1 max-w-prose text-base leading-[1.6] text-foreground">
						Watch up to 5 ZIP codes to see rent trends and price-to-rent figures. Adding a ZIP uses
						1 call unless its data is already saved in this browser.
					</p>
				</div>
			{/if}

			{#if atLimit}
				<p class="max-w-prose text-base leading-[1.6] text-foreground" data-watch-limit>
					You're watching 5 ZIP codes, the most Tran tracks. Stop watching one to add another.
				</p>
			{:else if runtime.gateway}
				<!-- Keyed on the gateway: the cost label is read for the active source, and a mode
				     switch (rebuilt gateway) starts the form fresh instead of showing a stale cost. -->
				{#key runtime.gateway}
					<WatchZipForm {port} watched={zips} {onWatched} bind:input={zipInput} />
				{/key}
			{/if}

			<p class="text-label text-muted-foreground tabular-nums" data-watch-count>
				{zips.length} of 5 ZIP codes watched
			</p>

			{#if zips.length > 0}
				<ul class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each zips as zip (zip)}
						<li>
							<ZipCard
								{zip}
								result={cards[zip]?.result}
								error={cards[zip]?.error ?? null}
								headingId={headingId(zip)}
								onRefresh={() => refresh(zip)}
								onStop={() => stop(zip)}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
