<script lang="ts">
	// /investor/memo/ (INV-06). Prerendered shell: the deal id travels as ?id= and is read in
	// MemoPage's onMount from new URL(location.href), never from the prerendered page store.
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import MemoPage from '$lib/features/investor/memo/MemoPage.svelte';
</script>

<svelte:head>
	<title>Investment memo: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Draft a plain-language memo for one of your saved deals from its figures, and review it before you print."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Investment memo</h1>
	<MemoPage />
</div>
