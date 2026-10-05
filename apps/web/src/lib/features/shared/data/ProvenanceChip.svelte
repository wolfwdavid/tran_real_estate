<script lang="ts">
	// 04-UI-SPEC "ProvenanceChip": a non-interactive <span> whose text carries the full meaning.
	// Renders provenance.fetchedAt verbatim, so a cached repeat shows the ORIGINAL fetch time.
	import Database from '@lucide/svelte/icons/database';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import History from '@lucide/svelte/icons/history';
	import type { Provenance } from '@tran/core/request';
	import { CHIP_LIVE_PREFIX, CHIP_SAMPLE, CHIP_STALE_SUFFIX } from './copy/provenance';
	import { formatRelative, toIso } from './relative-time';

	let { provenance, now }: { provenance: Provenance; now?: number } = $props();

	// Own clock when the caller does not pass `now`: re-renders at most once a minute (UI-SPEC).
	let tick = $state(Date.now());
	$effect(() => {
		if (now !== undefined) return;
		const id = setInterval(() => {
			tick = Date.now();
		}, 60_000);
		return () => clearInterval(id);
	});

	const variant = $derived(
		provenance.source === 'sample' ? 'sample' : provenance.stale ? 'stale' : 'live'
	);
	const relative = $derived(formatRelative(provenance.fetchedAt, now ?? tick));

	const BASE =
		'inline-flex items-center gap-1 border px-2 py-1 text-label font-semibold tabular-nums';
	const VARIANT_CLASS = {
		sample: 'rounded-full whitespace-nowrap border-border-strong bg-accent-surface text-foreground',
		live: 'rounded-full whitespace-nowrap border-transparent bg-secondary-surface text-secondary',
		// The longest text may wrap inside the chip at 375px; the chip then uses radius-lg.
		stale:
			'rounded-lg border-transparent bg-surface text-foreground sm:rounded-full sm:whitespace-nowrap'
	} as const;
</script>

<span data-provenance-chip={variant} class="{BASE} {VARIANT_CLASS[variant]}">
	{#if variant === 'sample'}
		<FlaskConical class="size-3.5" aria-hidden="true" />
		{CHIP_SAMPLE}
	{:else}
		{#if variant === 'live'}
			<Database class="size-3.5" aria-hidden="true" />
		{:else}
			<History class="size-3.5" aria-hidden="true" />
		{/if}
		<span
			>{CHIP_LIVE_PREFIX}<time datetime={toIso(provenance.fetchedAt)} aria-live="off"
				>{relative}</time
			>{#if variant === 'stale'}{CHIP_STALE_SUFFIX}{/if}</span
		>
	{/if}
</span>
