<script lang="ts">
	// /agent/studio/ (09-UI-SPEC "Routes" and "StudioHub"): the Studio hub. Prerendered: StudioHub's
	// tool cards and the sample report link are static anchors, so the crawler reaches every
	// Phase 9 route (handleUnseenRoutes: 'fail'). The drafts and snapshot counts and the agent
	// profile load in the browser after mount (Dexie by dynamic import, zero RentCast calls).
	import StudioHub from '$lib/features/studio/StudioHub.svelte';
</script>

<svelte:head>
	<title>Studio: Agent portal &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Write listing descriptions, social posts and reel scripts from your own facts, and build a branded market report for any ZIP code."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h1 class="font-display text-display font-semibold">Studio</h1>
	<StudioHub />
</div>
