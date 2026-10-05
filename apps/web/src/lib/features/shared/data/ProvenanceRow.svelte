<script lang="ts">
	// 04-UI-SPEC "ProvenanceRow": chip + (live/stale only) "Refresh (1 call)". Refresh bypasses the
	// TTL, so it always costs 1 call. The caller's onRefresh runs the gateway refresh and renders
	// any GatewayError itself; this row never calls the gateway.
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import type { Provenance } from '@tran/core/request';
	import CostLabel from './CostLabel.svelte';
	import ProvenanceChip from './ProvenanceChip.svelte';
	import { REFRESH_DONE, REFRESH_LABEL, REFRESHING } from './copy/provenance';
	import { Button, announce } from './platform-ui';

	let {
		provenance,
		onRefresh,
		now
	}: { provenance: Provenance; onRefresh?: () => Promise<void>; now?: number } = $props();

	let running = $state(false);

	async function refresh() {
		if (running || !onRefresh) return;
		running = true;
		try {
			await onRefresh();
			announce(REFRESH_DONE);
		} finally {
			running = false;
		}
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<ProvenanceChip {provenance} {now} />
	{#if provenance.source === 'rentcast' && onRefresh}
		<Button variant="outline" disabled={running} onclick={refresh}>
			{#if running}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				{REFRESHING}
			{:else}
				<RefreshCw class="size-4" aria-hidden="true" />
				{REFRESH_LABEL}
				<CostLabel estimate={{ calls: 1, reason: 'network' }} />
			{/if}
		</Button>
	{/if}
</div>
