<script lang="ts">
	// /investor/compare/ (INV-03). Prerendered shell: the deal ids travel as ?ids=a,b,c and are read in onMount.
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
</script>

<svelte:head>
	<title>Compare deals: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Compare 2 or 3 of your saved deals side by side, figure by figure."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Compare deals</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
</div>
