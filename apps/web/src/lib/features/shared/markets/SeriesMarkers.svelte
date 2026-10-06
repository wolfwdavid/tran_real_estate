<script lang="ts" module>
	/** One plotted month: the UTC first of the month plus a value (or null gap) per series key. */
	export interface PlotRow {
		date: Date;
		[key: string]: Date | number | null;
	}
</script>

<script lang="ts">
	// Markers for one series, drawn at every non-null month through the chart's own scales. A
	// missing month draws nothing, matching the gap in the line. Not focusable, no pointer events:
	// every value is in the data table.
	import SeriesMarker from './SeriesMarker.svelte';
	import type { ChartToken, MarkerShape } from './series-style';

	interface Props {
		/** Chart context scales (LayerChart `children` snippet `context`). */
		xScale: (d: Date) => number;
		yScale: (v: number) => number;
		rows: PlotRow[];
		key: string;
		token: ChartToken;
		marker: MarkerShape;
	}

	let { xScale, yScale, rows, key, token, marker }: Props = $props();

	const points = $derived(
		rows.flatMap((r) => {
			const v = r[key];
			return typeof v === 'number'
				? [{ x: xScale(r.date), y: yScale(v), t: r.date.getTime() }]
				: [];
		})
	);
</script>

<g class="pointer-events-none" data-series={key}>
	{#each points as p (p.t)}
		<SeriesMarker shape={marker} {token} x={p.x} y={p.y} />
	{/each}
</g>
