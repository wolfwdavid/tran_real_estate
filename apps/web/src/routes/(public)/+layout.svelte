<script lang="ts">
	// The chrome-free (public) layout for pages seen by an agent's leads, not by Tran users: no site
	// header, portal switcher, wordmark link, DataShell or AppNotice, and no storage, vault, AI or
	// data-layer imports (eslint.config.js and scripts/agent-boundary.test.ts enforce it).
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<!-- Not a marketing page: kept out of search results and the sitemap (10-UI-SPEC robots rule). -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<header class="flex h-16 items-center border-b border-border bg-background px-4">
		<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">Inquiry form</p>
	</header>
	<main
		id="main-content"
		tabindex="-1"
		class="mx-auto w-full max-w-[640px] flex-1 px-4 pt-12 pb-16"
	>
		{@render children()}
	</main>
	<footer class="bg-surface p-8 text-label text-muted-foreground">
		<div class="mx-auto grid max-w-[640px] gap-2">
			<p>
				This form was set up by the agent named above. Tran Real Estate Tools provides the form
				software, doesn't verify agents, and is not a real estate brokerage.
			</p>
			<p>
				<a
					href={resolve('/legal/privacy/')}
					class="inline-flex min-h-11 items-center text-foreground underline">Privacy</a
				>
			</p>
			<p>Equal Housing Opportunity.</p>
		</div>
	</footer>
</div>
