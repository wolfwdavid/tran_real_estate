<script lang="ts">
	// /investor/analyze/ (INV-01, INV-02). Prerendered shell: a saved deal opens with ?id=, read in onMount by the analyzer (07-later plans).
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
</script>

<svelte:head>
	<title>Analyze a deal: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Work out monthly cash flow, cap rate and cash-on-cash return for a rental property from the numbers you enter."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Analyze a deal</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
</div>
