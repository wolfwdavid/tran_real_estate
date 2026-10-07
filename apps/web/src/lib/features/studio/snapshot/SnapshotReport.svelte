<script lang="ts" module>
	import { formatCount } from '@tran/core/budget';
	import { NOT_AVAILABLE, usd } from '@tran/core/format';
	import { fewListingsSuffix } from '@tran/core/markets';
	import { bedroomLabel, type SnapshotMetrics } from '@tran/core/studio';

	const count = (v: number | null): string => (v === null ? NOT_AVAILABLE : formatCount(v));

	/** Rent by bedroom rows: label, median rent (few-listings suffix per Phase 7), listings counted. */
	export function rentByBedroomRows(m: SnapshotMetrics): { label: string; cells: string[] }[] {
		return m.rentByBedroom.map((r) => ({
			label: bedroomLabel(r.beds),
			cells: [
				r.median === null ? NOT_AVAILABLE : usd(r.median * 100) + fewListingsSuffix(r.listings),
				count(r.listings)
			]
		}));
	}

	/** Days on market and inventory rows: Homes for sale, then Rentals. */
	export function domInventoryRows(m: SnapshotMetrics): { label: string; cells: string[] }[] {
		return [
			{ label: 'Homes for sale', cells: [count(m.saleDom), count(m.saleTotal), count(m.saleNew)] },
			{ label: 'Rentals', cells: [count(m.rentalDom), count(m.rentalTotal), count(m.rentalNew)] }
		];
	}

	/** The frozen notes as paragraphs (blank lines split them). */
	export function noteParagraphs(text: string): string[] {
		return text
			.split(/\n\s*\n/)
			.map((p) => p.trim())
			.filter((p) => p !== '');
	}
</script>

<script lang="ts">
	// The Market Snapshot printout (09-UI-SPEC "Market Snapshot print", anatomy 1-7; STU-04): the
	// frozen SnapshotRecord rendered in the Phase 7 PrintReport shell. Everything comes from the
	// record, so printing spends 0 calls. Not removable by any option: the short and full labels,
	// Prepared by, Data sources (with the as-of date) and the sample marking. Agent colors reach
	// only the band (BrandBand), the h1 and the Rent by bedroom header fill; charts keep Tran's
	// series tokens.
	import { formatDisclosure } from '@tran/core/studio';
	import { resolve } from '$app/paths';
	import PriceToRentChart from '$lib/features/shared/markets/PriceToRentChart.svelte';
	import ZipTrendChart from '$lib/features/shared/markets/ZipTrendChart.svelte';
	import PrintReport from '$lib/features/shared/print/PrintReport.svelte';
	import type { SnapshotRecord } from '$lib/storage/studio/types';
	import BrandBand, { bandColors } from './BrandBand.svelte';
	import ListingsSummaryTable from './ListingsSummaryTable.svelte';
	import SnapshotKeyFigures from './SnapshotKeyFigures.svelte';
	import {
		dataSourcesSentence,
		EHO_STATEMENT,
		EHO_TITLE,
		fullLabel,
		NOTES_AI_NOTE,
		notesPrinted,
		preparedLine,
		SAMPLE_FOOTER,
		SAMPLE_SENTENCE,
		SHORT_LABEL,
		TRAN_FOOTER
	} from './report-copy';

	let {
		record,
		logoUrl = null,
		preparing = false,
		onprint
	}: {
		record: SnapshotRecord;
		logoUrl?: string | null;
		preparing?: boolean;
		onprint?: () => void;
	} = $props();

	const colors = $derived(bandColors(record.agent));
	const d = $derived(record.agent.disclosure);
	const printed = $derived(formatDisclosure(d, 'print').print);
	const on = $derived(new Set(record.options.sections));
	const withNotes = $derived(notesPrinted(record));
	const agentName = $derived(d.fullName.trim() || 'the agent');
	const contactLines = $derived(printed?.contactLines ?? []);

	/** Print plot height in viewBox units: shorter than the 320 default to keep the printout compact. */
	const PRINT_PLOT_HEIGHT = 240;
	const BEDROOM_COLUMNS = ['Bedrooms', 'Median rent', 'Listings counted'];
	const DOM_COLUMNS = ['Median days on market', 'Active listings', 'New listings'];
</script>

<div
	class="snapshot-report"
	data-snapshot-report
	style:--brand-primary-effective={colors.primary}
	style:--brand-accent-effective={colors.accent}
>
	<PrintReport
		title="Market Snapshot: ZIP {record.zip}"
		subtitle={record.placeName ?? undefined}
		preparedAt={new Date(record.createdAt)}
		preparedLine={preparedLine(record.createdAt, d.fullName, d.brokerage)}
		sample={record.sample}
		sampleSentence={SAMPLE_SENTENCE}
		provenance={dataSourcesSentence(record)}
		disclaimer={SHORT_LABEL}
		disclaimerFull={fullLabel(record.fetchedAt, withNotes ? { agentName } : null)}
		backHref={resolve('/agent/studio/snapshot/')}
		backLabel="Back to Studio"
		{onprint}
		{preparing}
		brand={bandSnippet}
		footerNote={record.options.tranFooter || record.sample ? footerSnippet : undefined}
	>
		{#if on.has('keyFigures')}
			<section aria-labelledby="snap-key-figures" data-snap-section="keyFigures">
				<h2 id="snap-key-figures" class="mb-3 text-base leading-[1.6] font-semibold">
					Key figures
				</h2>
				<SnapshotKeyFigures metrics={record.metrics} print />
			</section>
		{/if}

		{#if on.has('rentTrend')}
			<section aria-labelledby="snap-rent-trend-title" data-snap-section="rentTrend">
				<ZipTrendChart
					id="snap-rent-trend"
					zip={record.zip}
					stats={record.series.rentTrend}
					state="ready"
					sample={record.sample}
					height={PRINT_PLOT_HEIGHT}
					print
				/>
			</section>
		{/if}

		{#if on.has('priceToRent')}
			<section aria-labelledby="snap-price-to-rent-title" data-snap-section="priceToRent">
				<PriceToRentChart
					id="snap-price-to-rent"
					zip={record.zip}
					stats={record.series.priceToRent}
					state="ready"
					sample={record.sample}
					height={PRINT_PLOT_HEIGHT}
					print
				/>
			</section>
		{/if}

		{#if on.has('rentByBedroom')}
			<section aria-labelledby="snap-rent-by-bedroom" data-snap-section="rentByBedroom">
				<h2 id="snap-rent-by-bedroom" class="mb-3 text-base leading-[1.6] font-semibold">
					Rent by bedroom
				</h2>
				{@render table(
					`Median asking rent by bedroom count in ZIP ${record.zip}`,
					BEDROOM_COLUMNS,
					rentByBedroomRows(record.metrics)
				)}
			</section>
		{/if}

		{#if on.has('domInventory')}
			<section aria-labelledby="snap-dom-inventory" data-snap-section="domInventory">
				<h2 id="snap-dom-inventory" class="mb-3 text-base leading-[1.6] font-semibold">
					Days on market and inventory
				</h2>
				{@render table(
					`Median days on market and listing counts in ZIP ${record.zip}`,
					['', ...DOM_COLUMNS],
					domInventoryRows(record.metrics)
				)}
			</section>
		{/if}

		{#if record.listingsSample}
			<section aria-labelledby="snap-listings" data-snap-section="listings">
				<h2 id="snap-listings" class="mb-3 text-base leading-[1.6] font-semibold">
					Active listings summary
				</h2>
				<ListingsSummaryTable sample={record.listingsSample} zip={record.zip} print />
			</section>
		{/if}

		{#if withNotes && record.narrative}
			<section aria-labelledby="snap-notes" data-snap-section="marketNotes">
				<h2 id="snap-notes" class="mb-3 text-base leading-[1.6] font-semibold">Market notes</h2>
				<div class="flex flex-col gap-3">
					{#each noteParagraphs(record.narrative.text) as para, i (i)}
						<p class="text-base leading-[1.6] break-words whitespace-pre-wrap text-foreground">
							{para}
						</p>
					{/each}
				</div>
				<p class="mt-3 text-label text-muted-foreground">{NOTES_AI_NOTE(agentName)}</p>
			</section>
		{/if}

		<section aria-labelledby="snap-prepared" class="print-keep" data-prepared-by>
			<h2 id="snap-prepared" class="mb-2 text-base leading-[1.6] font-semibold">Prepared by</h2>
			{#if printed?.brokerageLine}
				<p class="text-base leading-[1.6] font-semibold break-words" data-prepared-brokerage>
					{printed.brokerageLine}
				</p>
			{/if}
			{#if printed?.agentLine}
				<p class="text-base leading-[1.6] break-words" data-prepared-agent>{printed.agentLine}</p>
			{/if}
			{#if printed?.licenseLine}
				<p class="text-label text-foreground tabular-nums" data-prepared-license>
					{printed.licenseLine}
				</p>
			{/if}
			{#each contactLines as line, i (i)}
				<p class="text-base leading-[1.6] break-words tabular-nums">{line}</p>
			{/each}
		</section>

		{#if record.options.eho}
			<div class="print-keep" data-eho>
				<p class="text-base leading-[1.6] font-semibold">{EHO_TITLE}</p>
				<p class="text-base leading-[1.6]">{EHO_STATEMENT}</p>
			</div>
		{/if}
	</PrintReport>
</div>

{#snippet bandSnippet()}
	<BrandBand agent={record.agent} {logoUrl} />
{/snippet}

{#snippet footerSnippet()}
	{#if record.options.tranFooter}
		<p data-tran-footer>{TRAN_FOOTER}</p>
	{/if}
	{#if record.sample}
		<p data-sample-footer>{SAMPLE_FOOTER}</p>
	{/if}
{/snippet}

{#snippet table(caption: string, columns: string[], rows: { label: string; cells: string[] }[])}
	<table class="w-full border-collapse text-base leading-[1.6] text-foreground">
		<caption class="pb-2 text-left text-label text-muted-foreground">{caption}</caption>
		<thead class="snap-thead">
			<tr>
				{#each columns as col, i (i)}
					{#if col === ''}
						<td class="border-b border-border px-3 py-2 print:py-1"></td>
					{:else}
						<th
							scope="col"
							class="border-b border-border px-3 py-2 font-semibold print:py-1 {i === 0
								? 'text-left'
								: 'text-right'}">{col}</th
						>
					{/if}
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.label)}
				<tr class="border-b border-border last:border-b-0">
					<th scope="row" class="px-3 py-2 text-left font-normal print:py-1">{row.label}</th>
					{#each row.cells as cell, i (i)}
						<td class="px-3 py-2 text-right tabular-nums print:py-1">{cell}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<style>
	/* The report h1 takes the agent's effective primary (>= 4.5:1 on white by construction). */
	.snapshot-report :global(#report-title) {
		color: var(--brand-primary-effective);
	}
	/* Decorative brand fill behind the table headers; not forced to print. */
	.snap-thead {
		background-color: var(--brand-accent-effective);
	}
</style>
