<script lang="ts">
	// /agent/studio/snapshot/ (STU-04): the Market Snapshot builder and the saved snapshots.
	// The prerendered skeleton (09-09): back link, h1 and the hydration line; the tool body
	// mounts after hydration.
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>Market Snapshot: Studio &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Build a branded Market Snapshot report for any ZIP code and keep the snapshots you save."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<a
		href={resolve('/agent/studio/')}
		class={buttonVariants({ variant: 'ghost', class: 'h-11 gap-2 px-2' })}
	>
		<ArrowLeft size={16} aria-hidden="true" />
		Studio
	</a>
	<h1 class="mt-6 font-display text-display font-semibold">Market Snapshot</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your studio&hellip;</p>
</div>
