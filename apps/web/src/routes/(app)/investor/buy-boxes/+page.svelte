<script lang="ts">
	// /investor/buy-boxes/ (INV-04). Prerendered shell: buy boxes and matches load in the browser.
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
</script>

<svelte:head>
	<title>Buy boxes: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Saved searches over homes for sale with your location, price range and target numbers, checked at most once a day."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Buy boxes</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
</div>
