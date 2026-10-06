<script lang="ts">
	// /investor/markets/ (INV-05). Prerendered shell: watched ZIP codes load in the browser.
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
</script>

<svelte:head>
	<title>Markets: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Watch up to 5 ZIP codes and follow their rent trends and price-to-rent figures."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Markets</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
</div>
