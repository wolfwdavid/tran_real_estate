<script lang="ts">
	// 06-UI-SPEC ShortlistCard "Status" (RENT-05): a native <select> (keyboard and screen-reader
	// safe, platform picker on phones; drag-and-drop was rejected). A change saves immediately via
	// repo.setStatus (core changeStatus stamps statusChangedAt), is announced, and moves the card;
	// the board then puts focus back on this card's select in its new section.
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { formatMonthDay } from '@tran/core/renter/format';
	import {
		SHORTLIST_STATUSES,
		STATUS_LABELS,
		type ShortlistItem,
		type ShortlistStatus
	} from '@tran/core/renter/records';
	import { announce } from '$lib/features/shared/data/platform-ui';
	import { getShortlistRepo } from '../storage/shortlist-repo';
	import { STATUS_BADGE, STATUS_ICONS } from './status-icons';

	interface Props {
		item: ShortlistItem;
		streetLine: string;
		/** Called before the write, so the board can refocus the select once the card has moved. */
		onStatusChanging?: (listingId: string, status: ShortlistStatus) => void;
	}

	let { item, streetLine, onStatusChanging }: Props = $props();

	const selectId = $derived('status-' + encodeURIComponent(item.listingId));
	const Icon = $derived(STATUS_ICONS[item.status]);
	const label = $derived(STATUS_LABELS[item.status]);
	const changedOn = $derived(formatMonthDay(new Date(item.statusChangedAt).toISOString()) ?? '');

	const isStatus = (v: string): v is ShortlistStatus =>
		(SHORTLIST_STATUSES as readonly string[]).includes(v);

	async function onchange(e: Event & { currentTarget: HTMLSelectElement }): Promise<void> {
		const next = e.currentTarget.value;
		if (!isStatus(next) || next === item.status) return;
		onStatusChanging?.(item.listingId, next);
		await getShortlistRepo().setStatus(item.listingId, next);
		announce(`${streetLine} moved to ${STATUS_LABELS[next]}.`);
	}
</script>

<div class="grid gap-2">
	<label for={selectId} class="text-base leading-[1.6] font-semibold text-foreground">Status</label>
	<div class="relative">
		<select
			id={selectId}
			value={item.status}
			{onchange}
			class="h-12 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pr-10 pl-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			{#each SHORTLIST_STATUSES as s (s)}
				<option value={s}>{STATUS_LABELS[s]}</option>
			{/each}
		</select>
		<ChevronDown
			class="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-foreground"
			aria-hidden="true"
		/>
	</div>
	<p
		class="flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-muted-foreground tabular-nums"
		data-status-meta
	>
		<span
			class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold {STATUS_BADGE[
				item.status
			]}"
			data-status-badge={item.status}
		>
			<Icon class="size-3.5 shrink-0" aria-hidden="true" />{label}</span
		>
		<time datetime={new Date(item.statusChangedAt).toISOString()}>{changedOn}</time>
	</p>
</div>
