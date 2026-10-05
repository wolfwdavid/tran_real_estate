<script lang="ts">
	import SiteHeader from '$lib/components/layout/SiteHeader.svelte';
	import SiteFooter from '$lib/components/layout/SiteFooter.svelte';

	let { children } = $props();
</script>

<SiteHeader />
<main id="main-content" tabindex="-1">
	{@render children()}
</main>
<SiteFooter />
