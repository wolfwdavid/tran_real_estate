<script lang="ts">
	// /investor/analyze/ (INV-01, INV-02, INV-03). Prerendered shell: the empty analyzer renders in
	// the static HTML; a saved deal (?id=) or the sample link (?sample=1) is read in onMount from
	// new URL(location.href), never from the prerendered page store.
	import { onMount } from 'svelte';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import AnalyzerForm from '$lib/features/investor/analyzer/AnalyzerForm.svelte';

	let analyzer = $state<AnalyzerForm | null>(null);

	onMount(() => {
		void analyzer?.open(new URL(location.href).searchParams);
	});
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
	<AnalyzerForm bind:this={analyzer} />
</div>
