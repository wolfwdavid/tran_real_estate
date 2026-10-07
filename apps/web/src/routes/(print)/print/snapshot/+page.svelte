<script lang="ts">
	// /print/snapshot/?id= (STU-04): the chrome-free Market Snapshot printout. The prerendered shell
	// (09-09) shows the h1 and a preparing line; plan 09-18 reads ?id= in onMount and renders the
	// frozen snapshot record (or the built-in ?id=sample). This route spends 0 RentCast calls: it
	// never imports the gateway or the data layer.
</script>

<svelte:head>
	<title>Market Snapshot &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="A printable Market Snapshot report for one ZIP code, branded with your details."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 py-8 md:px-8">
	<h1 class="font-display text-display font-semibold">Market Snapshot</h1>
	<p class="mt-4 text-label text-muted-foreground">Preparing your printout&hellip;</p>
</div>
