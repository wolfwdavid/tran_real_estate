<script lang="ts">
	// /agent/studio/social/ (STU-02): the social post pack writer.
	// The prerendered skeleton (09-09): back link, h1 and the hydration line; the tool body
	// mounts after hydration.
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>Social post pack: Studio &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Write a pack of social posts from a short brief, checked for Fair Housing problem phrases, with your disclosure added."
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
	<h1 class="mt-6 font-display text-display font-semibold">Social post pack</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading your studio&hellip;</p>
</div>
