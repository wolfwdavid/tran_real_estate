<script lang="ts">
	// /investor/market/ (INV-05). Prerendered as "ZIP market"; the ZIP travels as ?zip= and is read
	// only in onMount (reading the query from page.url throws while prerendering).
	//
	// Opening a dashboard never spends: the figures come from the free peek (cache in live mode,
	// fixtures in sample mode). When nothing is saved for the ZIP the charts show their no-data
	// state and Watch ZIP is the only spend path (a click). The two charts, and LayerChart with
	// them, are imported with import() inside onMount so no other route ships the chart library;
	// until they arrive each figure shows its loading placeholder.
	import { onMount, untrack, type Component } from 'svelte';
	import { resolve } from '$app/paths';
	import { ratio, usd } from '@tran/core/format';
	import { currentStats, validateZip } from '@tran/core/markets';
	import {
		getDataRuntime,
		isGatewayError,
		type CostEstimate,
		type GatewayError as GatewayErrorType
	} from '$lib/data';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import NotFoundPanel from '$lib/features/shared/NotFoundPanel.svelte';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import ChartFigure from '$lib/features/shared/markets/ChartFigure.svelte';
	import { loadMarket, readMarketOnMount } from '$lib/features/shared/markets/market-load';
	import { useMarketsPort, type MarketResult } from '$lib/features/shared/markets/markets-port';
	import {
		watchZip,
		watchedZipsLive,
		type WatchedZip
	} from '$lib/features/shared/markets/watchedZipsRepo';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the two chart components share one prop shape
	type ChartComponent = Component<any>;

	// Built during component init: the runtime lives in Svelte context.
	const runtime = getDataRuntime();
	const port = useMarketsPort();

	let heading = $state('ZIP market');
	let zip = $state<string | null>(null);
	let invalid = $state(false);
	let watchedLive = $state<{ readonly current: WatchedZip[] | undefined } | null>(null);
	let charts = $state<{ trend: ChartComponent; priceToRent: ChartComponent } | null>(null);

	let read = $state(false);
	let result = $state<MarketResult | undefined>(undefined);
	let readError = $state<GatewayErrorType | null>(null);
	let estimate = $state<CostEstimate | null>(null);
	let watching = $state(false);
	let watchError = $state<GatewayErrorType | null>(null);
	let retryCap = $state<(() => ReturnType<typeof loadMarket>) | null>(null);

	const isWatched = $derived(
		zip !== null && (watchedLive?.current?.some((w) => w.zip === zip) ?? true)
	);
	const now = $derived(result ? currentStats(result.stats) : null);
	const sample = $derived(result?.provenance.source === 'sample');
	const chartState = $derived<'loading' | 'error' | 'ready'>(
		!read ? 'loading' : readError ? 'error' : 'ready'
	);
	const dollars = (v: number | null | undefined) =>
		v === null || v === undefined ? '—' : usd(Math.round(v) * 100);

	onMount(() => {
		const v = validateZip(new URL(location.href).searchParams.get('zip') ?? '');
		if (!v.ok) {
			invalid = true;
			return;
		}
		zip = v.zip;
		heading = `ZIP ${v.zip} market`;
		document.title = `ZIP ${v.zip} market: Tran Real Estate Tools`;
		watchedLive = watchedZipsLive();
		void Promise.all([
			import('$lib/features/shared/markets/ZipTrendChart.svelte'),
			import('$lib/features/shared/markets/PriceToRentChart.svelte')
		]).then(([trend, priceToRent]) => {
			charts = { trend: trend.default, priceToRent: priceToRent.default };
		});
	});

	// The free read (peek and estimateCost only, never a call). Re-runs when the gateway is
	// rebuilt (mode switch) so the figures always match the active source.
	$effect(() => {
		const gateway = runtime.gateway;
		const z = zip;
		if (!gateway || z === null) return;
		let cancelled = false;
		untrack(() => {
			read = false;
			readError = null;
			readMarketOnMount(port, z)
				.then((r) => {
					if (!cancelled) result = r;
				})
				.catch((e: unknown) => {
					if (!cancelled && isGatewayError(e)) readError = e;
				})
				.finally(() => {
					if (!cancelled) read = true;
				});
			port
				.estimateCost(z)
				.then((e) => {
					if (!cancelled) estimate = e;
				})
				.catch(() => undefined);
		});
		return () => {
			cancelled = true;
		};
	});

	async function runWatch(load: () => ReturnType<typeof loadMarket>): Promise<void> {
		const z = zip;
		if (z === null || watching) return;
		watching = true;
		watchError = null;
		retryCap = null;
		try {
			const out = await load();
			if (out.ok) {
				result = out.result;
				readError = null;
				read = true;
				const stored = await watchZip(z);
				if (stored.ok) announce(`Now watching ZIP ${z}.`);
				return;
			}
			if (out.kind === 'cap') {
				if (out.dismissed) return;
				watchError = out.error;
				retryCap = out.retry;
				return;
			}
			if (!isGatewayError(out.error)) throw out.error;
			watchError = out.error;
		} finally {
			watching = false;
		}
	}

	async function watch(): Promise<void> {
		const z = zip;
		if (z !== null) await runWatch(() => loadMarket(port, z));
	}

	/** Refresh (1 call), from ProvenanceRow's click. Rejects so the row does not announce success. */
	async function refresh(): Promise<void> {
		if (zip === null) return;
		const out = await loadMarket(port, zip, { refresh: true });
		if (out.ok) {
			result = out.result;
			readError = null;
			return;
		}
		if (out.kind === 'error' && isGatewayError(out.error)) watchError = out.error;
		throw out.error;
	}
</script>

<svelte:head>
	<title>ZIP market: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Rent trends, sale prices and price-to-rent figures for one ZIP code you watch."
	/>
</svelte:head>

<!-- Inside each figure: the chip only. Refresh (1 call) lives once, in the row under the h1, so
     a print variant and the screen figures both render the chip without onRefresh. -->
{#snippet chartProvenance()}
	{#if result}<ProvenanceRow provenance={result.provenance} />{/if}
{/snippet}

{#snippet chartError()}
	{#if readError}<GatewayError error={readError} actions={false} />{/if}
{/snippet}

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">{heading}</h1>

	{#if invalid}
		<div class="mt-6">
			<NotFoundPanel
				title="Pick a ZIP code to see its dashboard"
				body="Open a dashboard from your watched ZIP codes."
				href={resolve('/investor/markets/')}
				linkLabel="Go to markets"
			/>
		</div>
	{:else if zip === null}
		<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
	{:else}
		<div class="mt-4 flex flex-col gap-4">
			{#if result}
				<ProvenanceRow provenance={result.provenance} onRefresh={refresh} />
			{/if}

			<dl class="flex flex-wrap gap-x-8 gap-y-4">
				<div>
					<dt class="text-label text-muted-foreground">Median rent</dt>
					<dd class="text-heading font-semibold text-foreground tabular-nums">
						{dollars(now?.medianRent)}
					</dd>
				</div>
				<div>
					<dt class="text-label text-muted-foreground">Median sale price</dt>
					<dd class="text-heading font-semibold text-foreground tabular-nums">
						{dollars(now?.medianPrice)}
					</dd>
				</div>
				<div>
					<dt class="text-label text-muted-foreground">Price-to-rent ratio</dt>
					<dd class="text-heading font-semibold text-foreground tabular-nums">
						{now?.priceToRent == null ? '—' : ratio(now.priceToRent, 1)}
					</dd>
				</div>
				<div>
					<dt class="text-label text-muted-foreground">Listings counted</dt>
					<dd class="text-heading font-semibold text-foreground tabular-nums">
						{now?.listings == null ? '—' : now.listings.toLocaleString('en-US')}
					</dd>
				</div>
			</dl>

			{#if !isWatched}
				<div class="flex flex-wrap items-center gap-4">
					<p class="text-base leading-[1.6] text-foreground">You're not watching this ZIP.</p>
					<Button variant="outline" disabled={watching} onclick={watch}>
						Watch ZIP <CostLabel {estimate} />
					</Button>
				</div>
			{/if}
			{#if watchError}
				<GatewayError
					error={watchError}
					focusOnMount={true}
					onTryAgain={watch}
					onContinuePastCap={() => {
						const retry = retryCap;
						if (retry) void runWatch(retry);
					}}
				/>
			{/if}
		</div>

		<div class="mt-6 flex flex-col gap-6 md:mt-8 md:gap-8">
			{#if charts}
				<charts.trend
					{zip}
					stats={result?.stats ?? null}
					state={chartState}
					{sample}
					provenance={chartProvenance}
					error={chartError}
				/>
				<charts.priceToRent
					{zip}
					stats={result?.stats ?? null}
					state={chartState}
					{sample}
					provenance={chartProvenance}
					error={chartError}
				/>
			{:else}
				{#each ['Rent trend by bedroom count', 'Price-to-rent ratio'] as title, i (title)}
					<ChartFigure
						id={`chart-placeholder-${i}`}
						{title}
						state="loading"
						summary=""
						caveat=""
						table={{ caption: title, columns: [], rows: [] }}
					/>
				{/each}
			{/if}
		</div>
	{/if}
</div>
