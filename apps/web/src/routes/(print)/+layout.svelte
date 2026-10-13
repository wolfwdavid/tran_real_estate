<script lang="ts">
	// The chrome-free (print) layout: no site header, portal switcher, footer, DataShell or
	// AppNotice. The shared print stylesheet is imported here and nowhere else (07-19).
	import '$lib/features/shared/print/print.css';

	let { children } = $props();
</script>

<svelte:head>
	<!-- Not a marketing page: kept out of search results and the sitemap (10-UI-SPEC robots rule). -->
	<meta name="robots" content="noindex" />
</svelte:head>

<main id="main-content" tabindex="-1">
	{@render children()}
</main>
