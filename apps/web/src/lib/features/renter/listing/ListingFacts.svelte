<script lang="ts">
	// 06-UI-SPEC "ListingFacts": a <dl> of all nine facts, always in this order, so the grid never
	// shifts. A missing value reads "Not listed" in muted text; nothing is shown as 0.
	import type { Listing } from '@tran/core/listings';
	import {
		formatMonthDayYear,
		formatRent,
		formatSqft,
		relativeListed
	} from '@tran/core/renter/format';
	import { propertyTypeLabel } from '@tran/core/renter/labels';

	let { row, now }: { row: Listing; now: Date } = $props();

	const count = (n: number | null | undefined) =>
		typeof n === 'number' && Number.isFinite(n) ? String(n) : null;

	const hoa = (fee: number | null | undefined) => {
		const money = formatRent(fee);
		return money ? `${money} a month` : null;
	};

	/** "3 days ago" / "today"; an older date drops relativeListed's leading "on ". */
	const lastSeen = (iso: string | null) => relativeListed(iso, now)?.replace(/^on /, '') ?? null;

	const facts = $derived<{ term: string; value: string | null }[]>([
		{ term: 'Bedrooms', value: row.bedrooms === 0 ? 'Studio' : count(row.bedrooms) },
		{ term: 'Bathrooms', value: count(row.bathrooms) },
		{ term: 'Square feet', value: formatSqft(row.squareFootage) },
		{
			term: 'Property type',
			value: row.propertyType ? propertyTypeLabel(row.propertyType) : null
		},
		{ term: 'Year built', value: count(row.yearBuilt) },
		{ term: 'HOA fee', value: hoa(row.hoaFee) },
		{ term: 'Days on market', value: count(row.daysOnMarket) },
		{ term: 'Listed on', value: formatMonthDayYear(row.listedDate) },
		{ term: 'Last seen listed', value: lastSeen(row.lastSeenDate) }
	]);
</script>

<dl class="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3" data-listing-facts>
	{#each facts as fact (fact.term)}
		<div class="grid content-start gap-1">
			<dt class="text-label font-semibold text-muted-foreground">{fact.term}</dt>
			{#if fact.value !== null}
				<dd class="text-base leading-[1.6] text-foreground tabular-nums">{fact.value}</dd>
			{:else}
				<dd class="text-base leading-[1.6] text-muted-foreground">Not listed</dd>
			{/if}
		</div>
	{/each}
</dl>
