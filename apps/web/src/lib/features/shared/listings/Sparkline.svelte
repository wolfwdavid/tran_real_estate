<script lang="ts">
	// 06-UI-SPEC "PriceHistory" sparkline: decorative trend line, only with 3+ points (fewer reads
	// better as the summary sentence). The table next to it carries every value as text.
	import { lastPoint, sparklinePath } from '@tran/core/renter/sparkline';

	let { values }: { values: number[] } = $props();

	const W = 320;
	const H = 48;
	const PAD = 2;
	const d = $derived(values.length < 3 ? null : sparklinePath(values, W, H, PAD));
	const dot = $derived(values.length < 3 ? null : lastPoint(values, W, H, PAD));
</script>

{#if d}
	<svg
		viewBox="0 0 {W} {H}"
		width="100%"
		height={H}
		style:max-width="{W}px"
		aria-hidden="true"
		focusable="false"
		data-sparkline
	>
		<path
			{d}
			fill="none"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
			class="stroke-secondary"
		/>
		{#if dot}
			<circle cx={dot.x} cy={dot.y} r="2" class="fill-foreground" />
		{/if}
	</svg>
{/if}
