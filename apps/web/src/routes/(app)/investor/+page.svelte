<script lang="ts">
	// /investor/ (07-UI-SPEC "Investor overview"). Replaces the Phase 2 PortalPlaceholder; the h1
	// "Investor portal" is kept. The overview cards and their live counts arrive in a later plan.
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
</script>

<svelte:head>
	<title>Investor portal: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="The investor portal of Tran Real Estate Tools: analyze a property, save the deals you want to revisit, and watch the ZIP codes you care about."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<div class="max-w-reading">
		<h1 class="font-display text-display font-semibold">Investor portal</h1>
		<p class="mt-4 text-base leading-[1.6] text-muted-foreground">
			Analyze a property, save the deals you want to revisit, and watch the ZIP codes you care
			about.
		</p>
	</div>
	<p class="mt-6 text-label text-muted-foreground">Loading your investor data…</p>
	<p class="mt-6 text-label text-muted-foreground">
		Not investment, legal, or tax advice. Tran is software, not a brokerage.
	</p>
</div>
