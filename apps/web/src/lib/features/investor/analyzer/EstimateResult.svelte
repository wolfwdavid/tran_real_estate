<script lang="ts">
	// EstimateResult (07-UI-SPEC "Autofill and field provenance"): the estimate as a reference block
	// under its AutofillButton. Range and comparable count always (false-precision guard), a "Few
	// comparables" badge under 3, the factual price comparison for value estimates, the Phase 4
	// ProvenanceRow, "Use $x" when the field holds a different number, and the comparables table.
	// Never spends: "Use" only writes the field.
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { NOT_AVAILABLE, usd, usdRange } from '@tran/core/format';
	import { parseMoneyInput } from '@tran/core/finance';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import { formatRelative } from '$lib/features/shared/data/relative-time';
	import type { Estimate } from '../data/investor-port';
	import { priceComparison, type AutofillTarget } from './autofill';

	interface Props {
		target: AutofillTarget;
		estimate: Estimate;
		/** Current text of the field the estimate targets (Monthly rent / Purchase price). */
		fieldValue: string;
		/** Purchase price in cents when entered (value estimates show the comparison). */
		priceCents?: number | null;
		onuse: () => void;
		now?: number;
	}

	let { target, estimate, fieldValue, priceCents = null, onuse, now }: Props = $props();

	const amount = $derived(usd(estimate.amountCents));
	const n = $derived(estimate.comparables.length);
	const comps = $derived(n === 1 ? '1 comparable' : `${n.toLocaleString('en-US')} comparables`);
	const few = $derived(n < 3);
	const sample = $derived(estimate.provenance.source === 'sample');
	const wholeCents = $derived(Math.round(estimate.amountCents / 100) * 100);
	const differs = $derived.by(() => {
		const r = parseMoneyInput(fieldValue);
		return r.ok && r.value !== null && r.value !== wholeCents;
	});
	const caption = $derived(
		`Comparables used for this ${target === 'rent' ? 'rent' : 'value'} estimate${sample ? ' (sample data)' : ''}`
	);
	const clock = $derived(now ?? Date.now());

	const num = (v: number | null) => (v === null ? NOT_AVAILABLE : v.toLocaleString('en-US'));
	const th = 'py-2 pr-4 font-semibold whitespace-nowrap';
	const td = 'py-2 pr-4 whitespace-nowrap tabular-nums';
</script>

<div
	class="grid gap-2 rounded-md bg-surface p-4 text-base leading-[1.6] text-foreground"
	data-estimate-result={target}
>
	<p class="font-semibold tabular-nums">
		{target === 'rent'
			? `RentCast rent estimate: ${amount} a month`
			: `RentCast value estimate: ${amount}`}
	</p>
	<p class="tabular-nums">
		{#if estimate.rangeLowCents !== null && estimate.rangeHighCents !== null}
			Range {usdRange(estimate.rangeLowCents, estimate.rangeHighCents)}, based on {comps}.
		{:else}
			Based on {comps}.
		{/if}
	</p>
	{#if few}
		<p class="flex flex-wrap items-center gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-2 py-1 text-label font-semibold text-foreground"
				data-few-comps><TriangleAlert class="size-3.5" aria-hidden="true" />Few comparables</span
			>
			<span>This estimate rests on fewer than 3 comparable homes, so treat it as rough.</span>
		</p>
	{/if}
	{#if target === 'value' && priceCents !== null && priceCents > 0}
		<p data-price-comparison>{priceComparison(priceCents, estimate.amountCents)}</p>
	{/if}
	<ProvenanceRow provenance={estimate.provenance} {now} />
	{#if differs}
		<div>
			<Button variant="outline" onclick={onuse}>Use {usd(wholeCents)}</Button>
		</div>
	{/if}
	{#if n > 0}
		<details class="min-w-0">
			<summary
				class="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>Comparables used ({n})</summary
			>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="mt-2 overflow-x-auto rounded-md bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				tabindex="0"
				role="region"
				aria-label={caption}
			>
				<table class="w-full min-w-[40rem] border-collapse" data-comparables>
					<caption class="p-2 text-left text-label text-muted-foreground">{caption}</caption>
					<thead>
						<tr class="border-b border-border">
							<th scope="col" class="{th} pl-2 text-left">Address</th>
							<th scope="col" class="{th} text-right">{target === 'rent' ? 'Rent' : 'Price'}</th>
							<th scope="col" class="{th} text-right">Beds</th>
							<th scope="col" class="{th} text-right">Baths</th>
							<th scope="col" class="{th} text-right">Sq ft</th>
							<th scope="col" class="{th} text-right">Distance</th>
							<th scope="col" class="{th} text-right">Seen</th>
						</tr>
					</thead>
					<tbody>
						{#each estimate.comparables as c, i (i)}
							<tr class="border-b border-border last:border-b-0">
								<td class="py-2 pr-4 pl-2">{c.address}</td>
								<td class="{td} text-right">{usd(c.amountCents)}</td>
								<td class="{td} text-right">{num(c.bedrooms)}</td>
								<td class="{td} text-right">{num(c.bathrooms)}</td>
								<td class="{td} text-right">{num(c.squareFeet)}</td>
								<td class="{td} text-right"
									>{c.distanceMi === null ? NOT_AVAILABLE : `${c.distanceMi.toFixed(1)} mi`}</td
								>
								<td class="{td} text-right"
									>{c.seenAt === null
										? NOT_AVAILABLE
										: formatRelative(c.seenAt, Math.max(clock, c.seenAt))}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}
</div>
