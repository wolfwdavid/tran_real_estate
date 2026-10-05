<script lang="ts">
	// 06-UI-SPEC "PriceHistory" (RENT-03): heading + one summary sentence + a decorative sparkline
	// (3+ points) + the dated events table, newest first. Wording says "rent" because RentCast
	// history rows carry the listed rent; Phase 7 sale listings pass their own history the same way.
	import {
		historyEvents,
		historySummary,
		pricePoints,
		type HistoryEvent,
		type HistoryEventKind,
		type RawHistory
	} from '@tran/core/renter/history';
	import { formatMonthDayYear, formatRent } from '@tran/core/renter/format';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import Sparkline from './Sparkline.svelte';

	interface Props {
		history: RawHistory;
		listedDate: string | null;
		headingLevel?: 2 | 3;
		/** Shows the Phase 4 Sample chip in the header (fixture data). */
		sample?: boolean;
	}

	let { history, listedDate, headingLevel = 2, sample = false }: Props = $props();

	const CAPTION = 'Listing events from RentCast';
	const EVENT_LABEL: Record<HistoryEventKind, string> = {
		listed: 'Listed',
		'rent-changed': 'Rent changed',
		delisted: 'Delisted',
		relisted: 'Relisted'
	};
	const SAMPLE = { source: 'sample', fetchedAt: 0, stale: false } as const;

	const events = $derived(historyEvents(history));
	const summary = $derived(historySummary(events));
	const points = $derived(pricePoints(events));
	/** Only a bare "Listed" entry (or nothing): the empty line replaces the table. */
	const onlyListed = $derived(events.every((e) => e.kind === 'listed'));

	const rent = (n: number) => formatRent(n) ?? '';
	const day = (iso: string | null) => (iso ? formatMonthDayYear(iso) : null);

	/** The "no rent changes" date: the listed event, or the caller's listedDate when history is empty. */
	const emptyDate = $derived(
		summary?.kind === 'none' ? day(summary.listedOn) : events.length === 0 ? day(listedDate) : null
	);

	const sentence = $derived.by(() => {
		if (!summary || summary.kind === 'none') return null;
		if (summary.kind === 'one') {
			return `Rent changed from ${rent(summary.from)} to ${rent(summary.to)} on ${day(summary.on)}.`;
		}
		return `Rent went from ${rent(summary.first)} on ${day(summary.firstOn)} to ${rent(summary.last)} on ${day(summary.lastOn)}.`;
	});

	function change(e: HistoryEvent): string | null {
		if (e.kind !== 'rent-changed' || e.change === null || e.change === 0) return null;
		// U+2212 minus sign, not a hyphen.
		return `${e.change < 0 ? '−' : '+'}${rent(Math.abs(e.change))}`;
	}
</script>

<section class="grid gap-3" data-price-history>
	<div class="flex flex-wrap items-center gap-2">
		<svelte:element
			this={`h${headingLevel}`}
			class="font-display text-heading font-semibold text-balance text-foreground"
			>Price and listing history</svelte:element
		>
		{#if sample}
			<ProvenanceChip provenance={SAMPLE} now={0} />
		{/if}
	</div>

	{#if sentence}
		<p class="text-base leading-[1.6] text-foreground tabular-nums">{sentence}</p>
	{:else if emptyDate}
		<p class="text-base leading-[1.6] text-foreground tabular-nums">
			No rent changes recorded since it was listed on {emptyDate}.
		</p>
	{:else}
		<p class="text-base leading-[1.6] text-muted-foreground">Not listed</p>
	{/if}

	{#if !onlyListed}
		<Sparkline values={points} />

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="overflow-x-auto" tabindex="0" role="region" aria-label={CAPTION}>
			<table class="w-full min-w-[22rem] border-collapse text-base leading-[1.6]">
				<caption class="mb-2 text-left text-label text-muted-foreground">{CAPTION}</caption>
				<thead>
					<tr class="border-b border-border">
						<th scope="col" class="py-2 pr-4 text-left font-semibold">Date</th>
						<th scope="col" class="py-2 pr-4 text-left font-semibold">Event</th>
						<th scope="col" class="py-2 pr-4 text-right font-semibold">Rent</th>
						<th scope="col" class="py-2 text-right font-semibold">Change</th>
					</tr>
				</thead>
				<tbody>
					{#each events as e, i (i)}
						{@const delta = change(e)}
						<tr class="border-b border-border last:border-b-0">
							<td class="py-2 pr-4 whitespace-nowrap tabular-nums">
								<time datetime={e.date}>{day(e.date)}</time>
							</td>
							<td class="py-2 pr-4">{EVENT_LABEL[e.kind]}</td>
							<td class="py-2 pr-4 text-right tabular-nums">
								{#if e.rent !== null}
									{rent(e.rent)}
								{:else}
									<span aria-hidden="true">—</span><span class="sr-only">not recorded</span>
								{/if}
							</td>
							<td class="py-2 text-right whitespace-nowrap tabular-nums">
								{#if delta}
									{delta}
								{:else}
									<span aria-hidden="true">—</span><span class="sr-only">no change</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
