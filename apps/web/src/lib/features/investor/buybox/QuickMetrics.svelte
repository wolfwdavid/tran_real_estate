<script lang="ts">
	// Quick metrics for one buy-box match (07-UI-SPEC "Buy boxes"): Rent-to-price, GRM and Est. cap
	// rate from the ZIP's cached median rent (07-07 quickMetrics), plus the basis line. Pure render:
	// the numbers come from matches.ts at 0 calls. Without cached ZIP stats every value is "—".
	import { quickBasisLine, type QuickMetrics } from '@tran/core/finance';
	import { NOT_AVAILABLE, pct, ratio } from '@tran/core/format';

	let { quick, beds }: { quick: QuickMetrics | null; beds: number | null } = $props();

	const items = $derived([
		{
			term: 'Rent-to-price',
			value: quick?.rentToPricePct == null ? NOT_AVAILABLE : pct(quick.rentToPricePct, 2)
		},
		{ term: 'GRM', value: quick?.grm == null ? NOT_AVAILABLE : ratio(quick.grm, 1) },
		{
			term: 'Est. cap rate',
			value: quick?.estCapRatePct == null ? NOT_AVAILABLE : pct(quick.estCapRatePct, 1)
		}
	]);
</script>

<div class="grid min-w-0 gap-2" data-quick-metrics>
	<dl class="flex flex-wrap gap-x-4 gap-y-2">
		{#each items as item (item.term)}
			<div class="flex min-w-0 flex-col">
				<dt class="text-label text-muted-foreground">{item.term}</dt>
				<dd class="text-base leading-[1.6] font-semibold text-foreground tabular-nums">
					{item.value}
				</dd>
			</div>
		{/each}
	</dl>
	{#if quick}
		<p class="text-label text-muted-foreground" data-quick-basis>{quickBasisLine(quick, beds)}</p>
	{/if}
</div>
