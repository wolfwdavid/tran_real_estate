<script lang="ts">
	// 07-UI-SPEC "ZipCard" (INV-05): one watched ZIP's current figures, its provenance and actions.
	// The card never reads or spends by itself: the page peeks on open, and Refresh (1 call) and
	// Stop watching are the caller's click handlers.
	import { resolve } from '$app/paths';
	import { ratio, usd } from '@tran/core/format';
	import { currentStats } from '@tran/core/markets';
	import type { GatewayError as GatewayErrorType } from '$lib/data';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import { Button, buttonVariants } from '$lib/features/shared/data/platform-ui';
	import type { MarketResult } from './markets-port';

	interface Props {
		zip: string;
		/** undefined while the free read runs or when nothing is saved for this ZIP. */
		result?: MarketResult;
		error?: GatewayErrorType | null;
		headingId: string;
		/** Refresh (1 call). Rejects on failure so ProvenanceRow does not announce success. */
		onRefresh?: () => Promise<void>;
		onStop: () => void | Promise<void>;
	}

	let { zip, result, error = null, headingId, onRefresh, onStop }: Props = $props();

	const DASH = '—';
	const now = $derived(result ? currentStats(result.stats) : null);
	const dollars = (v: number | null | undefined) =>
		v === null || v === undefined ? DASH : usd(Math.round(v) * 100);
	const href = $derived(
		`${resolve('/investor/market/')}?${new URLSearchParams({ zip }).toString()}`
	);
</script>

<article
	class="flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
	aria-labelledby={headingId}
>
	<h2
		id={headingId}
		tabindex="-1"
		class="text-base leading-[1.6] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	>
		ZIP {zip}
	</h2>

	<dl class="grid gap-3">
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
				{now?.priceToRent == null ? DASH : ratio(now.priceToRent, 1)}
			</dd>
		</div>
	</dl>

	{#if error}
		<GatewayError {error} actions={false} />
	{:else if result}
		<ProvenanceRow provenance={result.provenance} {onRefresh} />
	{/if}

	<div class="mt-auto flex flex-wrap items-center gap-2">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a ?zip= query -->
		<a {href} class={buttonVariants({ variant: 'outline' })}>Open dashboard</a>
		<Button variant="ghost" onclick={() => onStop()}>Stop watching</Button>
	</div>
</article>
