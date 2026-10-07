<script lang="ts" module>
	export type ChartState = 'loading' | 'empty' | 'error' | 'ready';

	/** Print plot width in viewBox units: the 816px sheet minus 2 x 72px margins (09 Pitfall 11). */
	export const PRINT_VIEWBOX_WIDTH = 672;
	/** Print plot height in viewBox units when the caller passes none (the 320px screen height). */
	export const PRINT_VIEWBOX_HEIGHT = 320;

	export const LOADING_TEXT = 'Loading market data…';
	export const EMPTY_TEXT =
		'Not enough monthly data for this ZIP yet. RentCast needs at least 2 months of listings to draw a trend.';
</script>

<script lang="ts">
	// Shared chart figure (07-UI-SPEC "ChartFigure"), exported for Phase 9. It owns every text
	// alternative (title, time line, legend, summary, caveat, data table) and every state, so the
	// figure is complete before, and without, the client-only LayerChart plot.
	import type { Snippet } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChartDataTable, { type ChartTable } from './ChartDataTable.svelte';
	import ChartLegend, { type LegendItem } from './ChartLegend.svelte';

	interface Props {
		id: string;
		title: string;
		headingLevel?: 2 | 3;
		state: ChartState;
		timeRange?: string;
		legend?: LegendItem[];
		summary: string;
		caveat: string;
		table: ChartTable;
		/**
		 * Print variant: table open (no <details>), provenance told to drop Refresh, title in Body
		 * 16/600 (still an h2 unless headingLevel is 3), and the plot laid out in a fixed
		 * 672-unit viewBox (height `height` or 320) that scales to the sheet width (Phase 9). In
		 * print media the card chrome (padding, border, shadow) drops, the figure may break across
		 * pages (the plot itself never splits) and the data table prints compact, so a figure with a
		 * 24-month table fits the 672px page box and does not leave a near-empty page before it.
		 */
		print?: boolean;
		/**
		 * Explicit plot size in px; otherwise 256px tall below 768px, 320px from 768px. In print
		 * only `height` applies, in viewBox units.
		 */
		width?: number;
		height?: number;
		provenance?: Snippet<[{ print: boolean }]>;
		error?: Snippet;
		plot?: Snippet;
	}

	let {
		id,
		title,
		headingLevel = 2,
		state,
		timeRange,
		legend,
		summary,
		caveat,
		table,
		print = false,
		width,
		height,
		provenance,
		error,
		plot
	}: Props = $props();

	const titleId = $derived(`${id}-title`);
	const summaryId = $derived(`${id}-summary`);
	const ready = $derived(state === 'ready');
	const sized = $derived(width !== undefined || height !== undefined);
	const printHeight = $derived(height ?? PRINT_VIEWBOX_HEIGHT);
</script>

<figure
	class:print-flow={print}
	aria-labelledby={titleId}
	aria-describedby={ready ? summaryId : undefined}
	class="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6 {print
		? 'print:gap-2 print:rounded-none print:border-0 print:p-0 print:shadow-none'
		: ''}"
>
	<svelte:element
		this={headingLevel === 3 ? 'h3' : 'h2'}
		id={titleId}
		class={print
			? 'text-base leading-[1.6] font-semibold text-balance text-foreground'
			: 'font-display text-heading font-semibold text-balance text-foreground'}
		>{title}</svelte:element
	>

	{#if provenance}{@render provenance({ print })}{/if}

	{#if state === 'error'}
		{@render error?.()}
	{:else if state === 'loading'}
		<div
			aria-hidden="true"
			class="{sized ? '' : 'h-64 md:h-80'} w-full rounded-md bg-surface"
			style:width={width !== undefined ? `${width}px` : undefined}
			style:height={height !== undefined ? `${height}px` : undefined}
		></div>
		<p class="text-label text-muted-foreground">{LOADING_TEXT}</p>
	{:else if state === 'empty'}
		<p class="text-base leading-[1.6] text-foreground">{EMPTY_TEXT}</p>
	{:else}
		{#if timeRange}
			<p class="text-label text-muted-foreground">{timeRange}</p>
		{/if}
		{#if legend && legend.length > 0}
			<ChartLegend items={legend} />
		{/if}
		{#if print}
			<!-- The plot lays out at a fixed 672 x height box; the SVG scales it to the sheet width. -->
			<svg
				viewBox="0 0 {PRINT_VIEWBOX_WIDTH} {printHeight}"
				class="block h-auto w-full max-w-full break-inside-avoid"
				data-print-plot
			>
				<foreignObject x="0" y="0" width={PRINT_VIEWBOX_WIDTH} height={printHeight}>
					<div class="relative h-full w-full">
						{@render plot?.()}
					</div>
				</foreignObject>
			</svg>
		{:else}
			<div
				class="{sized ? '' : 'h-64 md:h-80'} relative w-full max-w-full"
				style:width={width !== undefined ? `${width}px` : undefined}
				style:height={height !== undefined ? `${height}px` : undefined}
			>
				{@render plot?.()}
			</div>
		{/if}
		<p id={summaryId} class="text-base leading-[1.6] text-foreground">{summary}</p>
		<p class="text-label text-muted-foreground">{caveat}</p>
		{#if print}
			<ChartDataTable {table} print />
		{:else}
			<details class="group">
				<summary
					class="flex min-h-11 cursor-pointer touch-manipulation list-none items-center gap-2 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden"
				>
					<ChevronRight
						size={16}
						aria-hidden="true"
						class="shrink-0 motion-safe:transition-transform motion-safe:group-open:rotate-90"
					/>Show data table
				</summary>
				<div class="mt-2">
					<ChartDataTable {table} />
				</div>
			</details>
		{/if}
	{/if}
</figure>

<style>
	/*
	 * The shared print stylesheet keeps every figure on one page (break-inside: avoid). A print
	 * variant figure carries an open data table that can be most of a page tall, so it may break
	 * between table rows instead of leaving a near-empty page before it; the plot itself (an
	 * atomic SVG) never splits and the title stays with it (h2 break-after: avoid). This rule is
	 * unlayered on purpose: a Tailwind utility (cascade layer) cannot override print.css.
	 */
	@media print {
		figure.print-flow {
			break-inside: auto;
		}
		/* Title, provenance, time range and legend stay on the page with the plot. */
		figure.print-flow > :global(:has(~ [data-print-plot])) {
			break-after: avoid;
		}
	}
</style>
