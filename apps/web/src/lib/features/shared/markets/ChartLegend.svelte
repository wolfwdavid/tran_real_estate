<script lang="ts" module>
	import type { ChartToken, MarkerShape } from './series-style';

	export interface LegendItem {
		key: string;
		label: string;
		token: ChartToken;
		dash: string | null;
		marker: MarkerShape;
	}
</script>

<script lang="ts">
	// Visible legend above the plot (07-UI-SPEC item 4): each item draws a 32x12 line sample with
	// the series dash and its marker, so the key matches the plot exactly by more than color.
	import SeriesMarker from './SeriesMarker.svelte';
	import { strokeClass } from './series-style';

	let { items }: { items: LegendItem[] } = $props();
</script>

<ul aria-label="Legend" class="flex flex-wrap gap-x-4 gap-y-2">
	{#each items as item (item.key)}
		<li class="flex items-center gap-2 text-label font-semibold text-foreground">
			<svg aria-hidden="true" width="32" height="12" viewBox="0 0 32 12" class="shrink-0">
				<line
					x1="0"
					y1="6"
					x2="32"
					y2="6"
					class="fill-none stroke-2 {strokeClass(item.token)}"
					stroke-dasharray={item.dash ?? undefined}
				/>
				<SeriesMarker shape={item.marker} token={item.token} x={16} y={6} />
			</svg>
			{item.label}
		</li>
	{/each}
</ul>
