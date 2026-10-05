<script lang="ts">
	// 06-UI-SPEC truncation notice: RentCast returned its 500-row maximum. Never paginates
	// (each page would be a billed call). With local filters set, "Narrow on RentCast" re-asks once
	// with those filters server-side; its cost shows before the click.
	import Info from '@lucide/svelte/icons/info';
	import { hasLocalFilters } from '@tran/core/renter';
	import type { DataGateway } from '$lib/data';
	import { Button } from '$lib/components/ui/button/index.js';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import { createCostEstimate } from './cost-estimate.svelte';
	import type { RenterSearch } from './search-state.svelte';

	let { search, gateway }: { search: RenterSearch; gateway: DataGateway | null } = $props();

	const canNarrow = $derived(hasLocalFilters(search.filters) && !search.rentError);
	const cost = createCostEstimate(() => ({
		gateway,
		request: canNarrow ? search.narrowRequest : null,
		version: search.version
	}));
</script>

{#if search.truncated}
	<div class="flex items-start gap-2 rounded-lg bg-surface p-4 text-foreground sm:gap-4">
		<Info size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
		<div class="flex min-w-0 flex-col gap-2">
			<p class="text-base leading-[1.6] font-semibold">Some listings may be missing</p>
			<p class="max-w-reading text-base leading-[1.6]">
				RentCast sends at most 500 listings per search, and {search.locationText} reached that limit.
				Search a ZIP code to see everything in a smaller area.
			</p>
			{#if canNarrow}
				<div>
					<Button
						variant="outline"
						class="h-auto min-h-12 w-full py-2 whitespace-normal sm:w-auto"
						disabled={search.status === 'loading'}
						onclick={() => search.narrow()}
					>
						Narrow on RentCast <CostLabel estimate={cost.current} />
					</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}
