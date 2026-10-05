<script lang="ts">
	// 06-UI-SPEC "ListingStatusChip" (honest recency). Says when RentCast last saw the listing,
	// never whether it is open: the renter asks the listing contact. "Gone" only on RentCast's own
	// evidence (Inactive or a removal date), decided by core listingStatus. Chip anatomy matches the
	// Phase 4 ProvenanceChip. Recent listings show nothing on cards (no noise on the common case).
	import CircleSlash from '@lucide/svelte/icons/circle-slash';
	import Eye from '@lucide/svelte/icons/eye';
	import History from '@lucide/svelte/icons/history';
	import { formatMonthDay, relativeListed } from '@tran/core/renter/format';
	import { listingStatus } from '@tran/core/renter/listing-status';

	interface Props {
		row: { status: string | null; lastSeenDate: string | null; removedDate?: string | null };
		now?: Date;
		context?: 'card' | 'detail';
	}

	let { row, now = new Date(), context = 'card' }: Props = $props();

	const status = $derived(listingStatus(row, now));

	const BASE =
		'inline-flex items-center gap-1 border border-transparent px-2 py-1 text-label font-semibold tabular-nums';
	// The longest text may wrap inside the chip at 375px; the chip then uses radius-lg.
	const NEUTRAL = 'rounded-lg bg-surface text-foreground sm:rounded-full sm:whitespace-nowrap';
</script>

{#if status.kind === 'recent'}
	{#if context === 'detail'}
		<span
			data-listing-status="recent"
			class="{BASE} rounded-full bg-secondary-surface whitespace-nowrap text-secondary"
		>
			<Eye class="size-3.5 shrink-0" aria-hidden="true" />
			<span
				>Last seen listed <time datetime={status.lastSeen}
					>{relativeListed(status.lastSeen, now)}</time
				></span
			>
		</span>
	{/if}
{:else if status.kind === 'stale'}
	<span data-listing-status="stale" class="{BASE} {NEUTRAL}">
		<History class="size-3.5 shrink-0" aria-hidden="true" />
		{#if status.lastSeen}
			<span
				>Not seen lately: last seen listed <time datetime={status.lastSeen}
					>{formatMonthDay(status.lastSeen)}</time
				></span
			>
		{:else}
			<span>Not seen lately</span>
		{/if}
	</span>
{:else}
	<span data-listing-status="gone" class="{BASE} {NEUTRAL}">
		<CircleSlash class="size-3.5 shrink-0" aria-hidden="true" />
		<span>No longer listed in RentCast</span>
	</span>
{/if}
