<script lang="ts">
	// 06-UI-SPEC "Not found": a missing, malformed or unknown `?id=`. In live mode, for a
	// valid-looking id, **Look it up again** shows its cost first and spends exactly one call when
	// pressed (the caller's onLookUp runs fetchListingById from this click handler). A gateway error
	// from that lookup renders the Phase 4 GatewayError panel.
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Search from '@lucide/svelte/icons/search';
	import { resolve } from '$app/paths';
	import type { CostEstimate, GatewayError as GatewayErrorType } from '$lib/data';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import { Button } from '$lib/features/shared/data/platform-ui';

	interface Props {
		variant: 'missing-id' | 'not-found';
		canFetch: boolean;
		error?: GatewayErrorType;
		/** The by-id lookup's cost (from gateway.estimateCost, 0 calls). */
		estimate: CostEstimate | null;
		onLookUp: () => Promise<void>;
	}

	let { variant, canFetch, error, estimate, onLookUp }: Props = $props();

	let loading = $state(false);

	async function lookUp(): Promise<void> {
		if (loading) return;
		loading = true;
		try {
			await onLookUp();
		} finally {
			loading = false;
		}
	}

	const BODY = {
		'missing-id': "This link doesn't point to a listing. Search again to find it.",
		'not-found':
			"This listing isn't saved in this browser. It may have come from a search you no longer have. Search again to find it."
	} as const;
</script>

<div class="grid max-w-reading gap-4">
	<h1 class="font-display text-display font-semibold text-balance">Listing not found</h1>
	<p class="text-base leading-[1.6] text-foreground">{BODY[variant]}</p>

	{#if error}
		<GatewayError {error} focusOnMount />
	{/if}

	<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
		<a
			href={resolve('/renter/')}
			class="inline-flex min-h-12 items-center justify-center gap-1 rounded-md border border-border-strong px-6 text-base leading-[1.6] font-semibold text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<Search size={16} aria-hidden="true" />
			Back to search
		</a>
		{#if canFetch}
			<Button variant="outline" disabled={loading} onclick={lookUp}>
				{#if loading}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Loading…
				{:else}
					Look it up again <CostLabel {estimate} />
				{/if}
			</Button>
		{/if}
	</div>
</div>
