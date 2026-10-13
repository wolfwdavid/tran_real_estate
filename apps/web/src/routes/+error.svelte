<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SiteHeader from '$lib/components/layout/SiteHeader.svelte';
	import SiteFooter from '$lib/components/layout/SiteFooter.svelte';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'}: Tran Real Estate Tools</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<SiteHeader />
<main id="main-content" tabindex="-1">
	<div class="mx-auto max-w-page px-6 py-12 md:px-8">
		<h1 class="font-display text-display font-semibold">
			{page.status}: {notFound ? 'Page not found' : 'Something went wrong'}
		</h1>
		<p class="mt-4 max-w-reading text-body">
			{#if notFound}
				That address doesn't match any page on Tran Real Estate Tools. Check the link, or start from
				the home page.
			{:else}
				This page didn't load. Reload it, or start from the home page.
			{/if}
		</p>
		<div class="mt-6">
			<ButtonLink href={resolve('/')} variant="primary">Go to the home page</ButtonLink>
		</div>
	</div>
</main>
<SiteFooter />
