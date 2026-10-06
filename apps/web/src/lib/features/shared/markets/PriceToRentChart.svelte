<script lang="ts">
	// Price-to-rent ratio for one watched ZIP (07-UI-SPEC; INV-05), exported for Phase 9. A single
	// series with a direct label at its last point and no legend. No reference line or good/bad
	// band: a threshold would read as a buy-or-rent recommendation.
	import type { Snippet } from 'svelte';
	import { monthYear, ratio } from '@tran/core/format';
	import {
		hasEnoughData,
		priceToRentSeries,
		priceToRentSummary,
		timeRangeLine,
		type MarketStatsInput
	} from '@tran/core/markets';
	import ChartFigure from './ChartFigure.svelte';
	import LinePlot from './LinePlot.svelte';
	import type { PlotRow } from './SeriesMarkers.svelte';
	import { PRICE_TO_RENT_STYLE, monthDate } from './series-style';

	const TITLE = 'Price-to-rent ratio';
	const CAVEAT =
		'Median sale price divided by a year of median rent. Sale and rent medians cover different sets of homes, so treat this as a rough market signal.';
	const LINE = { key: 'ratio', ...PRICE_TO_RENT_STYLE };

	interface Props {
		id?: string;
		zip: string;
		stats: MarketStatsInput | null;
		state: 'loading' | 'error' | 'ready';
		sample: boolean;
		provenance?: Snippet<[{ print: boolean }]>;
		error?: Snippet;
		headingLevel?: 2 | 3;
		print?: boolean;
		width?: number;
		height?: number;
	}

	let {
		id,
		zip,
		stats,
		state,
		sample,
		provenance,
		error,
		headingLevel = 2,
		print = false,
		width,
		height
	}: Props = $props();

	const figureId = $derived(id ?? `price-to-rent-${zip}`);
	const series = $derived(stats ? priceToRentSeries(stats) : { months: [], points: [] });
	const figureState = $derived(
		state === 'ready' && !hasEnoughData([series.points]) ? 'empty' : state
	);

	const fmt = (v: number) => ratio(v, 1);

	const rows = $derived(
		series.months.map((m, i): PlotRow => ({ date: monthDate(m), ratio: series.points[i] }))
	);
	const table = $derived({
		caption: series.months.length
			? `${TITLE}, ${monthYear(series.months[0])} to ${monthYear(series.months[series.months.length - 1])}`
			: TITLE,
		columns: ['Month', TITLE],
		rows: series.months.map((m, i) => {
			const v = series.points[i];
			return { label: monthYear(m), cells: [v === null ? 'No data' : fmt(v)] };
		})
	});
</script>

<ChartFigure
	id={figureId}
	title={TITLE}
	{headingLevel}
	state={figureState}
	timeRange={timeRangeLine(series.months)}
	summary={priceToRentSummary(zip, series, { sample })}
	caveat={CAVEAT}
	{table}
	{print}
	{width}
	{height}
	{provenance}
	{error}
>
	{#snippet plot()}
		<LinePlot id={figureId} {rows} lines={[LINE]} yFormat={fmt} lastLabel />
	{/snippet}
</ChartFigure>
