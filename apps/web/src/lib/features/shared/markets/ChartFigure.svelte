<script lang="ts" module>
	export type ChartState = 'loading' | 'empty' | 'error' | 'ready';

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
		/** Print variant: table open (no <details>), provenance told to drop Refresh. */
		print?: boolean;
		/** Explicit plot size in px (print); otherwise 256px tall below 768px, 320px from 768px. */
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
</script>

<figure
	aria-labelledby={titleId}
	aria-describedby={ready ? summaryId : undefined}
	class="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
>
	<svelte:element
		this={headingLevel === 3 ? 'h3' : 'h2'}
		id={titleId}
		class="font-display text-heading font-semibold text-balance text-foreground"
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
		<div
			class="{sized ? '' : 'h-64 md:h-80'} relative w-full max-w-full"
			style:width={width !== undefined ? `${width}px` : undefined}
			style:height={height !== undefined ? `${height}px` : undefined}
		>
			{@render plot?.()}
		</div>
		<p id={summaryId} class="text-base leading-[1.6] text-foreground">{summary}</p>
		<p class="text-label text-muted-foreground">{caveat}</p>
		{#if print}
			<ChartDataTable {table} />
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
