<script lang="ts" module>
	export interface CompareColumn {
		id: string;
		name: string;
		address: string;
		/** Any value in the deal came from sample data. */
		sample: boolean;
	}

	export const COMPARE_CAPTION =
		"Highest or Lowest marks the top figure in each row for that measure, for example the lowest GRM or the highest cash flow. It's arithmetic, not a recommendation.";
</script>

<script lang="ts">
	// 07-UI-SPEC "Compare" (INV-03). Both layouts are in the DOM: a real <table> from 768px and a
	// stacked-by-metric view below it. CSS display:none hides the inactive one, which also removes it
	// from the accessibility tree, so nothing is read twice. Markers are arithmetic: the extreme in
	// each row gets a secondary-surface fill, a chevron icon AND the word Highest or Lowest (never
	// color alone, never a recommendation).
	import ChevronsDown from '@lucide/svelte/icons/chevrons-down';
	import ChevronsUp from '@lucide/svelte/icons/chevrons-up';
	import X from '@lucide/svelte/icons/x';
	import type { CompareRow } from '@tran/core/finance';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';

	interface Props {
		deals: readonly CompareColumn[];
		rows: readonly CompareRow[];
		onremove: (id: string) => void;
	}

	let { deals, rows, onremove }: Props = $props();

	const SAMPLE = { source: 'sample', fetchedAt: 0, stale: false } as const;
	const removeName = (name: string) => `Remove ${name} from comparison`;
	const sectionId = (key: string) => `compare-metric-${key}`;
</script>

{#snippet marker(row: CompareRow)}
	<span
		class="mt-1 inline-flex items-center gap-1 rounded-full text-label font-semibold text-secondary"
		data-marker
	>
		{#if row.marker === 'Lowest'}
			<ChevronsDown size={14} aria-hidden="true" data-icon="chevrons-down" />
		{:else}
			<ChevronsUp size={14} aria-hidden="true" data-icon="chevrons-up" />
		{/if}
		{row.marker}
	</span>
{/snippet}

<div class="hidden md:block" data-compare-view="table">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="overflow-x-auto rounded-lg border border-border bg-card shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		tabindex="0"
		role="region"
		aria-label={COMPARE_CAPTION}
	>
		<table class="w-full border-collapse text-base leading-[1.6]">
			<caption class="caption-top px-4 py-2 text-left text-label text-muted-foreground"
				>{COMPARE_CAPTION}</caption
			>
			<thead class="bg-surface">
				<tr>
					<td class="border-b border-border px-4 py-2"></td>
					{#each deals as deal (deal.id)}
						<th
							scope="col"
							class="border-b border-border px-4 py-2 text-left align-top font-semibold"
							data-provenance={deal.sample ? 'sample' : undefined}
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<span class="block [overflow-wrap:anywhere]">{deal.name}</span>
									{#if deal.address}
										<span
											class="block text-label font-normal [overflow-wrap:anywhere] text-muted-foreground"
											>{deal.address}</span
										>
									{/if}
									{#if deal.sample}<span class="mt-1 inline-block"
											><ProvenanceChip provenance={SAMPLE} now={0} /></span
										>{/if}
								</div>
								<Button
									variant="ghost"
									size="icon"
									aria-label={removeName(deal.name)}
									data-compare-remove={deal.id}
									onclick={() => onremove(deal.id)}
								>
									<X size={16} aria-hidden="true" />
								</Button>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					<tr class="border-b border-border last:border-b-0" data-row={row.key}>
						<th scope="row" class="px-4 py-2 text-left font-semibold">{row.label}</th>
						{#each row.display as value, i (deals[i]?.id ?? i)}
							{@const marked = row.marked.includes(i)}
							<td
								class="px-4 py-2 text-right align-top font-semibold tabular-nums {marked
									? 'bg-secondary-surface'
									: ''}"
								data-marked={marked ? 'true' : undefined}
							>
								<span class="block">{value}</span>
								{#if marked}{@render marker(row)}{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<div class="grid gap-4 md:hidden" data-compare-view="stacked">
	<p class="text-label text-muted-foreground">{COMPARE_CAPTION}</p>
	<section
		aria-labelledby="compare-deals-heading"
		class="rounded-lg border border-border bg-card p-4"
	>
		<h2 id="compare-deals-heading" class="text-base leading-[1.6] font-semibold">
			Deals in this comparison
		</h2>
		<ul class="mt-2 grid gap-2">
			{#each deals as deal (deal.id)}
				<li
					class="flex items-start justify-between gap-2"
					data-provenance={deal.sample ? 'sample' : undefined}
				>
					<div class="min-w-0">
						<span class="block text-base leading-[1.6] [overflow-wrap:anywhere]">{deal.name}</span>
						{#if deal.address}
							<span class="block text-label [overflow-wrap:anywhere] text-muted-foreground"
								>{deal.address}</span
							>
						{/if}
						{#if deal.sample}<span class="mt-1 inline-block"
								><ProvenanceChip provenance={SAMPLE} now={0} /></span
							>{/if}
					</div>
					<Button
						variant="ghost"
						size="icon"
						aria-label={removeName(deal.name)}
						data-compare-remove={deal.id}
						onclick={() => onremove(deal.id)}
					>
						<X size={16} aria-hidden="true" />
					</Button>
				</li>
			{/each}
		</ul>
	</section>
	{#each rows as row (row.key)}
		<section
			aria-labelledby={sectionId(row.key)}
			class="rounded-lg border border-border bg-card p-4"
			data-metric-card={row.key}
		>
			<h2 id={sectionId(row.key)} class="text-base leading-[1.6] font-semibold">{row.label}</h2>
			<dl class="mt-2 grid gap-2">
				{#each row.display as value, i (deals[i]?.id ?? i)}
					{@const marked = row.marked.includes(i)}
					<div
						class="flex items-start justify-between gap-4 rounded-md px-2 py-1 {marked
							? 'bg-secondary-surface'
							: ''}"
						data-marked={marked ? 'true' : undefined}
					>
						<dt class="min-w-0 text-base leading-[1.6] [overflow-wrap:anywhere]">
							{deals[i]?.name}
						</dt>
						<dd class="text-right text-base leading-[1.6] font-semibold tabular-nums">
							<span class="block">{value}</span>
							{#if marked}{@render marker(row)}{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</section>
	{/each}
</div>
