<script lang="ts">
	// The client-only LayerChart plot shared by ZipTrendChart and PriceToRentChart. Composed from
	// primitives (Chart + Svg + Grid + Axis + Spline) so every element carries explicit Phase 2
	// token classes; markers are our own layer. No hover popups, no motion, nothing focusable: the
	// figure's summary and data table carry every value. LayerChart's <Chart> renders nothing on
	// the server, so the SVG appears after hydration.
	import { Axis, Chart, Grid, Spline, Svg } from 'layerchart';
	import SeriesMarkers, { type PlotRow } from './SeriesMarkers.svelte';
	import {
		CHART_PADDING,
		CHART_PADDING_LABELLED,
		strokeClass,
		tickLabel,
		xTickEvery,
		type ChartToken,
		type MarkerShape
	} from './series-style';

	interface Line {
		key: string;
		token: ChartToken;
		dash: string | null;
		marker: MarkerShape;
	}

	interface Props {
		/** Figure id: the SVG is named by `{id}-title` and described by `{id}-summary`. */
		id: string;
		rows: PlotRow[];
		lines: Line[];
		yFormat: (v: number) => string;
		/** Draw the last value as a direct label right of the last point (single-series charts). */
		lastLabel?: boolean;
	}

	let { id, rows, lines, yFormat, lastLabel = false }: Props = $props();

	const values = $derived(
		rows.flatMap((r) =>
			lines.map((l) => r[l.key]).filter((v): v is number => typeof v === 'number')
		)
	);
	const yDomain = $derived.by((): [number, number] => {
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		return lo === hi ? [lo * 0.95, hi * 1.05] : [lo, hi];
	});

	/** The last non-null point of the first line, for the direct label. */
	const last = $derived.by(() => {
		const key = lines[0]?.key;
		for (let i = rows.length - 1; i >= 0; i--) {
			const v = rows[i][key];
			if (typeof v === 'number') return { date: rows[i].date, v };
		}
		return null;
	});

	const xTicksFor = (width: number): Date[] => {
		const every = xTickEvery(width);
		return rows.filter((_, i) => i % every === 0).map((r) => r.date);
	};
	const firstTick = $derived(rows[0]?.date.getTime());
	const xFormat = (d: Date) => tickLabel(d, d.getTime() === firstTick);
	const isDefined = (key: string) => (d: PlotRow) => typeof d[key] === 'number';
</script>

<Chart
	data={rows}
	x="date"
	y={lines[0]?.key}
	{yDomain}
	yNice
	padding={lastLabel ? CHART_PADDING_LABELLED : CHART_PADDING}
>
	{#snippet children({ context })}
		<Svg role="img" aria-labelledby="{id}-title {id}-summary" pointerEvents={false}>
			<Grid
				y={{ class: 'stroke-border', stroke: 'var(--color-border)', strokeWidth: 1 }}
				yTicks={5}
			/>
			<Axis
				placement="left"
				ticks={5}
				format={(v: number) => yFormat(v)}
				rule={false}
				tickMarks={false}
				tickOcclusion={false}
				fill="var(--color-muted-foreground)"
				classes={{ tickLabel: 'fill-muted-foreground tabular-nums' }}
			/>
			<Axis
				placement="bottom"
				ticks={xTicksFor(context.containerWidth)}
				format={(d: Date) => xFormat(d)}
				rule
				tickMarks={false}
				tickOcclusion={false}
				stroke="var(--color-border-strong)"
				fill="var(--color-muted-foreground)"
				classes={{ rule: 'stroke-border-strong', tickLabel: 'fill-muted-foreground tabular-nums' }}
			/>
			{#each lines as line (line.key)}
				<Spline
					y={line.key}
					defined={isDefined(line.key)}
					class="fill-none stroke-2 {strokeClass(line.token)}"
					stroke="var(--color-{line.token})"
					stroke-width={2}
					stroke-dasharray={line.dash ?? undefined}
				/>
				<SeriesMarkers
					xScale={context.xScale}
					yScale={context.yScale}
					{rows}
					key={line.key}
					token={line.token}
					marker={line.marker}
				/>
			{/each}
			{#if lastLabel && last}
				<text
					x={context.xScale(last.date) + 8}
					y={context.yScale(last.v)}
					dominant-baseline="middle"
					class="fill-foreground text-label font-semibold tabular-nums">{yFormat(last.v)}</text
				>
			{/if}
		</Svg>
	{/snippet}
</Chart>
