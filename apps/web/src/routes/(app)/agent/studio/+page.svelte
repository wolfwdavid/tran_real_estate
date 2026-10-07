<script lang="ts">
	// /agent/studio/ (09-UI-SPEC "Routes"): the Studio hub. Prerendered with static anchors to the
	// four tools and the sample report, so the crawler reaches every Phase 9 route
	// (handleUnseenRoutes: 'fail'). Plan 09-12 replaces the list with StudioToolCards and keeps
	// these exact hrefs.
	import { resolve } from '$app/paths';

	const tools = [
		{ href: resolve('/agent/studio/listing/'), label: 'Write a listing description' },
		{ href: resolve('/agent/studio/social/'), label: 'Write a post pack' },
		{ href: resolve('/agent/studio/reel/'), label: 'Write a reel script' },
		{ href: resolve('/agent/studio/snapshot/'), label: 'Build a Market Snapshot' }
	];
	const sampleReportHref = `${resolve('/print/snapshot/')}?id=sample`;
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
	<p class="mt-4 max-w-prose text-body text-muted-foreground">
		Write listing descriptions, social posts, and reel scripts from facts you enter, and build a
		branded market report for any ZIP code. Every draft is checked for Fair Housing problem phrases
		and gets your disclosure added.
	</p>
	<ul class="mt-8 grid gap-2">
		{#each tools as t (t.href)}
			<li>
				<a
					href={t.href}
					class="inline-flex min-h-11 items-center text-body font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2"
					>{t.label}</a
				>
			</li>
		{/each}
	</ul>
	<p class="mt-6 text-body text-foreground">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus ?id=sample -->
		<a
			href={sampleReportHref}
			class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2"
			>Preview a sample report</a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</p>
</div>
