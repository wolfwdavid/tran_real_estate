<script lang="ts">
	// 04-UI-SPEC "NewSinceBadge": saved-search diff summary (core.diffSnapshots counts), an optional
	// detail line (non-zero parts only) and a "Checked {relative}" line naming the data source.
	import BellDot from '@lucide/svelte/icons/bell-dot';
	import { CHECKED_PREFIX, checkedSuffix, detailText, newSinceText } from './copy/provenance';
	import { formatRelative, toIso } from './relative-time';

	let {
		newCount,
		priceChanged,
		gone,
		checkedAt,
		source,
		now
	}: {
		newCount: number;
		priceChanged: number;
		gone: number;
		checkedAt: number | null;
		source: 'rentcast' | 'sample';
		now?: number;
	} = $props();

	// Own clock when the caller does not pass `now`: re-renders at most once a minute (UI-SPEC).
	let tick = $state(Date.now());
	$effect(() => {
		if (now !== undefined) return;
		const id = setInterval(() => {
			tick = Date.now();
		}, 60_000);
		return () => clearInterval(id);
	});

	const hasNew = $derived(newCount > 0);
	const detail = $derived(detailText({ new: newCount, priceChanged, gone }));
	const relative = $derived(checkedAt === null ? '' : formatRelative(checkedAt, now ?? tick));
</script>

<div class="flex flex-col items-start gap-1">
	<span
		data-new-since
		class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-label font-semibold whitespace-nowrap tabular-nums {hasNew
			? 'bg-accent-surface text-foreground'
			: 'bg-surface text-muted-foreground'}"
	>
		{#if hasNew}<BellDot class="size-3.5" aria-hidden="true" />{/if}
		{newSinceText(newCount)}
	</span>
	{#if detail}
		<p data-new-since-detail class="text-label text-muted-foreground tabular-nums">{detail}</p>
	{/if}
	{#if checkedAt !== null}
		<p data-new-since-checked class="text-label text-muted-foreground">
			{CHECKED_PREFIX}<time datetime={toIso(checkedAt)} aria-live="off">{relative}</time
			>{checkedSuffix(source)}
		</p>
	{/if}
</div>
