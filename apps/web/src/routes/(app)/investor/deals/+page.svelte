<script lang="ts">
	// /investor/deals/ (INV-03). Prerendered shell: the list reads Dexie in the browser through a
	// liveQuery, so a delete (or a save in another tab) updates it without a reload. 0 calls.
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import DealsList from '$lib/features/investor/deals/DealsList.svelte';
	import { dealsLive } from '$lib/features/investor/deals/dealsRepo';

	const deals = dealsLive();
</script>

<svelte:head>
	<title>Saved deals: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="The deal analyses you saved, stored only in this browser. Pick up to 3 to compare side by side."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Saved deals</h1>
	<DealsList deals={deals.current} />
</div>
