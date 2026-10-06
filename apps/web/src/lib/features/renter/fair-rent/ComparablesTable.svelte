<script lang="ts">
	// 06-UI-SPEC "ComparablesTable": the rentals RentCast compared, nearest first, at most 10 (the
	// caller passes @tran/core displayComparables rows, subject already removed). Addresses are text,
	// not links: comparables are not in Tran's listing store.
	import type { Comparable } from '@tran/core/listings';
	import { formatDistance, formatRent, formatSqft } from '@tran/core/renter/format';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';

	/** `sample` puts the Sample chip in the caption row (06-UI-SPEC Sample Data Contract). */
	let { rows, sample = false }: { rows: readonly Comparable[]; sample?: boolean } = $props();

	const SAMPLE = { source: 'sample', fetchedAt: 0, stale: false } as const;

	const CAPTION = 'Similar rentals RentCast compared';
	const NOT_LISTED = 'Not listed';

	/** The street part of RentCast's one-line address. */
	const street = (c: Comparable) => c.formattedAddress.split(',')[0]?.trim() || c.formattedAddress;

	function rooms(c: Comparable): string | null {
		const parts: string[] = [];
		if (c.bedrooms !== null) parts.push(c.bedrooms === 0 ? 'Studio' : `${c.bedrooms} bd`);
		if (c.bathrooms !== null) parts.push(`${c.bathrooms} ba`);
		return parts.length ? parts.join(' · ') : null;
	}

	function size(c: Comparable): string {
		const s = formatSqft(c.squareFootage);
		return s ? `${s} sq ft` : NOT_LISTED;
	}
</script>

{#if rows.length === 0}
	<p class="text-base leading-[1.6] text-foreground" data-comparables-empty>
		RentCast didn't return comparable rentals for this estimate.
	</p>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="overflow-x-auto" tabindex="0" role="region" aria-label={CAPTION}>
		<table class="w-full min-w-[30rem] border-collapse text-base leading-[1.6]" data-comparables>
			<caption class="mb-2 text-left text-label text-muted-foreground">
				<span class="inline-flex flex-wrap items-center gap-2"
					>{CAPTION}{#if sample}
						<ProvenanceChip provenance={SAMPLE} now={0} />{/if}</span
				>
			</caption>
			<thead>
				<tr class="border-b border-border">
					<th scope="col" class="py-2 pr-4 text-left font-semibold">Rental</th>
					<th scope="col" class="py-2 pr-4 text-right font-semibold">Rent</th>
					<th scope="col" class="py-2 pr-4 text-right font-semibold">Distance</th>
					<th scope="col" class="py-2 text-right font-semibold">Size</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as c, i (c.id || i)}
					{@const r = rooms(c)}
					<tr class="border-b border-border align-top last:border-b-0" data-distance={c.distance}>
						<td class="py-2 pr-4">
							<span class="block font-semibold">{street(c)}</span>
							{#if r}<span class="block text-label text-muted-foreground tabular-nums">{r}</span
								>{/if}
						</td>
						<td class="py-2 pr-4 text-right whitespace-nowrap tabular-nums">
							{formatRent(c.price) ?? NOT_LISTED}
						</td>
						<td class="py-2 pr-4 text-right whitespace-nowrap tabular-nums">
							{formatDistance(c.distance) ?? NOT_LISTED}
						</td>
						<td class="py-2 text-right whitespace-nowrap tabular-nums">{size(c)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
