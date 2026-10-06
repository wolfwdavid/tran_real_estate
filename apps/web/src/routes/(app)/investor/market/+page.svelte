<script lang="ts">
	// /investor/market/ (INV-05). Prerendered as "ZIP market"; the ZIP travels as ?zip= and is read
	// only in onMount (page.url.searchParams throws while prerendering). The dashboard itself
	// arrives in a later plan.
	import { onMount } from 'svelte';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';

	let heading = $state('ZIP market');

	onMount(() => {
		const zip = new URL(location.href).searchParams.get('zip');
		if (zip !== null && /^\d{5}$/.test(zip)) {
			heading = `ZIP ${zip} market`;
			document.title = `ZIP ${zip} market: Tran Real Estate Tools`;
		}
	});
</script>

<svelte:head>
	<title>ZIP market: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Rent trends, sale prices and price-to-rent figures for one ZIP code you watch."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">{heading}</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
</div>
