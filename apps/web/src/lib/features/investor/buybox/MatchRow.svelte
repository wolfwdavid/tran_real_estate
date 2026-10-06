<script lang="ts">
	// One buy-box match (07-UI-SPEC "Buy boxes" matches list). Address + New badge + Sample chip,
	// the listing line, zero-call QuickMetrics, and two cost-first actions whose ONLY spends are their
	// click handlers (never $effect):
	// - "Load ZIP rents ({cost})" when the listing's ZIP has no cached stats: loadMarket (1 call, or
	//   0 when cached / sample), then the page re-reads matches from the cache.
	// - "Deep analyze ({cost})": deepAnalyze (rent then value estimate, at most 2 calls), which writes
	//   the analyzer draft, then navigation to the analyzer, which renders from the cache.
	// Cost labels come from estimateCost (free), read on mount and when the pointer or focus reaches
	// the button, so they stay right after other rows load data.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BellDot from '@lucide/svelte/icons/bell-dot';
	import Calculator from '@lucide/svelte/icons/calculator';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { usd } from '@tran/core/format';
	import { GatewayError as GatewayErrorValue, isGatewayError } from '@tran/core/request';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import { announce, Button } from '$lib/features/shared/data/platform-ui';
	import { loadMarket, type LoadOutcome } from '$lib/features/shared/markets/market-load';
	import type { MarketsPort } from '$lib/features/shared/markets/markets-port';
	import { writeDraft } from '../analyzer/draftRepo';
	import type { CostEstimate, InvestorDataPort } from '../data/investor-port';
	import { deepAnalyze, listingQuery } from './deep-analyze';
	import type { MatchRow } from './matches';
	import QuickMetrics from './QuickMetrics.svelte';

	interface Props {
		row: MatchRow;
		sample: boolean;
		investor: InvestorDataPort;
		markets: MarketsPort;
		/** The listing's ZIP has no cached market stats (quick metrics need "Load ZIP rents"). */
		needsStats: boolean;
		/** Called after a ZIP's stats loaded: the page re-reads every match from the cache. */
		onZipLoaded: (zip: string) => Promise<void>;
	}

	let { row, sample, investor, markets, needsStats, onZipLoaded }: Props = $props();

	const l = $derived(row.listing);
	let deepCost = $state<CostEstimate | null>(null);
	let zipCost = $state<CostEstimate | null>(null);
	let analyzing = $state(false);
	let loadingZip = $state(false);
	let failure = $state<{
		error: GatewayErrorValue;
		from: 'zip' | 'deep';
		retry?: () => void;
	} | null>(null);

	const plural = (n: number, one: string, many: string) =>
		`${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

	const line = $derived(
		[
			usd(l.priceCents),
			l.bedrooms === null ? null : `${l.bedrooms} bd`,
			l.bathrooms === null ? null : `${l.bathrooms} ba`,
			l.squareFeet === null ? null : `${l.squareFeet.toLocaleString('en-US')} sq ft`,
			l.daysOnMarket === null ? null : `${plural(l.daysOnMarket, 'day', 'days')} listed`
		]
			.filter((p): p is string => p !== null)
			.join(' · ')
	);

	/** Free: two cache / fixture lookups. */
	async function refreshDeepCost(): Promise<void> {
		const q = listingQuery(l);
		try {
			const [rent, value] = await Promise.all([
				investor.estimateCost({ kind: 'rent', q }),
				investor.estimateCost({ kind: 'value', q })
			]);
			const calls = rent.calls + value.calls;
			deepCost = {
				calls,
				reason:
					rent.reason === 'sample' && value.reason === 'sample'
						? 'sample'
						: calls === 0
							? 'cached'
							: 'network'
			};
		} catch {
			deepCost = null;
		}
	}

	/** Free: cache / fixture lookup. */
	async function refreshZipCost(): Promise<void> {
		try {
			zipCost = await markets.estimateCost(l.zip);
		} catch {
			zipCost = null;
		}
	}

	onMount(() => {
		void refreshDeepCost();
		if (needsStats) void refreshZipCost();
	});

	const asGatewayError = (e: unknown) =>
		isGatewayError(e) ? e : new GatewayErrorValue({ kind: 'NetworkError' });

	async function settleZip(outcome: LoadOutcome): Promise<void> {
		if (outcome.ok) {
			await onZipLoaded(l.zip);
			announce(`ZIP rents loaded for ${l.zip}. Quick metrics updated.`);
			return;
		}
		if (outcome.kind === 'cap') {
			// "Not now" on the over-cap prompt: nothing was spent.
			if (outcome.dismissed) return;
			const retry = outcome.retry;
			failure = { error: outcome.error, from: 'zip', retry: () => void runZip(retry) };
			return;
		}
		failure = { error: asGatewayError(outcome.error), from: 'zip' };
	}

	async function runZip(load: () => Promise<LoadOutcome>): Promise<void> {
		if (loadingZip) return;
		loadingZip = true;
		failure = null;
		try {
			await settleZip(await load());
		} finally {
			loadingZip = false;
			void refreshZipCost();
		}
	}

	/** Click handler: the one market-stats spend for this ZIP. */
	function loadZipRents(): void {
		void runZip(() => loadMarket(markets, l.zip));
	}

	/** Click handler: the Deep analyze spend (at most 2 calls), then the analyzer opens from cache. */
	async function analyze(): Promise<void> {
		if (analyzing) return;
		analyzing = true;
		failure = null;
		try {
			await deepAnalyze(investor, $state.snapshot(l) as typeof l, {
				// The runtime's CapPrompt asks on the retry; nothing is granted here.
				confirmCap: async () => true,
				writeDraft
			});
			await goto(resolve('/investor/analyze/'));
		} catch (error) {
			failure = { error: asGatewayError(error), from: 'deep' };
			void refreshDeepCost();
		} finally {
			analyzing = false;
		}
	}
</script>

<div class="flex min-w-0 flex-col gap-3 py-4" data-match-row={l.id}>
	<p class="flex flex-wrap items-center gap-2">
		<span class="min-w-0 text-base leading-[1.6] font-semibold break-words text-foreground"
			>{l.address}</span
		>
		{#if row.isNew}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-accent-surface px-2 py-1 text-label font-semibold text-foreground"
				data-new-match><BellDot class="size-3.5" aria-hidden="true" />New</span
			>
		{/if}
		{#if sample}
			<ProvenanceChip provenance={{ source: 'sample', fetchedAt: 0, stale: false }} />
		{/if}
	</p>
	<p class="text-base leading-[1.6] text-foreground tabular-nums">{line}</p>
	<QuickMetrics quick={row.quick} beds={l.bedrooms} />
	{#if needsStats}
		<div class="flex flex-col items-start gap-2">
			<p class="text-base leading-[1.6] text-muted-foreground">
				Load ZIP rents to see quick metrics.
			</p>
			<Button
				variant="outline"
				class="h-auto min-h-11 py-2 text-left whitespace-normal"
				aria-disabled={loadingZip ? 'true' : undefined}
				onclick={loadZipRents}
				onpointerenter={() => void refreshZipCost()}
				onfocus={() => void refreshZipCost()}
			>
				{#if loadingZip}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Loading…
				{:else}
					Load ZIP rents <CostLabel estimate={zipCost} />
				{/if}
			</Button>
		</div>
	{/if}
	<div>
		<Button
			variant="outline"
			class="h-auto min-h-11 py-2 text-left whitespace-normal"
			aria-disabled={analyzing ? 'true' : undefined}
			onclick={() => void analyze()}
			onpointerenter={() => void refreshDeepCost()}
			onfocus={() => void refreshDeepCost()}
		>
			{#if analyzing}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				Analyzing…
			{:else}
				<Calculator class="size-4" aria-hidden="true" />
				Deep analyze <CostLabel estimate={deepCost} />
			{/if}
		</Button>
	</div>
	{#if failure}
		<GatewayError
			error={failure.error}
			focusOnMount
			onTryAgain={async () => {
				if (failure?.from === 'zip') loadZipRents();
				else await analyze();
			}}
			onContinuePastCap={failure.retry}
		/>
	{/if}
</div>
