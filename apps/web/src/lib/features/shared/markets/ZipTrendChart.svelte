<script lang="ts">
	// Rent trend by bedroom count for one watched ZIP (07-UI-SPEC; INV-05), exported for Phase 9.
	// The core series keeps missing months as null, so the line breaks there and the table says
	// "No data"; nothing is ever drawn or listed as $0.
	import type { Snippet } from 'svelte';
	import { monthYear, usd } from '@tran/core/format';
	import {
		fewListingsSuffix,
		hasEnoughData,
		rentTrendSeries,
		rentTrendSummary,
		timeRangeLine,
		type MarketStatsInput
	} from '@tran/core/markets';
	import ChartFigure from './ChartFigure.svelte';
	import LinePlot from './LinePlot.svelte';
	import type { PlotRow } from './SeriesMarkers.svelte';
	import { SERIES_STYLE, monthDate } from './series-style';

	const TITLE = 'Rent trend by bedroom count';
	const CAVEAT =
		'Medians come from listings RentCast saw each month. Months with fewer than 5 listings for a bedroom count are marked in the table.';

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

	const figureId = $derived(id ?? `rent-trend-${zip}`);
	const trend = $derived(stats ? rentTrendSeries(stats) : { months: [], series: [] });
	const enough = $derived(hasEnoughData(trend.series.map((s) => s.points)));
	const figureState = $derived(state === 'ready' && !enough ? 'empty' : state);

	const dollars = (v: number) => usd(Math.round(v) * 100);

	const legend = $derived(
		trend.series.map((s) => ({ key: s.key, label: s.label, ...SERIES_STYLE[s.key] }))
	);
	const rows = $derived(
		trend.months.map((m, i): PlotRow => {
			const row: PlotRow = { date: monthDate(m) };
			for (const s of trend.series) row[s.key] = s.points[i];
			return row;
		})
	);
	const table = $derived({
		caption: trend.months.length
			? `${TITLE}, ${monthYear(trend.months[0])} to ${monthYear(trend.months[trend.months.length - 1])}`
			: TITLE,
		columns: ['Month', ...trend.series.map((s) => s.label)],
		rows: trend.months.map((m, i) => ({
			label: monthYear(m),
			cells: trend.series.map((s) => {
				const v = s.points[i];
				return v === null ? 'No data' : dollars(v) + fewListingsSuffix(s.counts[i]);
			})
		}))
	});
</script>

<ChartFigure
	id={figureId}
	title={TITLE}
	{headingLevel}
	state={figureState}
	timeRange={timeRangeLine(trend.months)}
	{legend}
	summary={rentTrendSummary(zip, trend, { sample })}
	caveat={CAVEAT}
	{table}
	{print}
	{width}
	{height}
	{provenance}
	{error}
>
	{#snippet plot()}
		<LinePlot id={figureId} {rows} lines={legend} yFormat={dollars} />
	{/snippet}
</ChartFigure>
