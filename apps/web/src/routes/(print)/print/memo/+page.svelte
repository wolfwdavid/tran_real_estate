<script lang="ts">
	// /print/memo/ (INV-06): the chrome-free printout of a deal and its memo. The deal and memo ids
	// travel as ?id=&memo= and are read only in onMount; the PrintReport sheet arrives in a later
	// plan. No PortalSubNav: the print surface has no site chrome.
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Investment memo: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="A printable investment memo for one saved deal, with its figures, inputs and data sources."
	/>
</svelte:head>

<div data-print-hidden class="mx-auto max-w-page border-b border-border px-6 py-4">
	<a
		href={resolve('/investor/memo/')}
		class="inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:decoration-2"
		>Back to memo</a
	>
</div>
<div class="mx-auto max-w-page px-6 py-6">
	<h1 class="font-display text-heading font-semibold">Investment memo</h1>
	<p class="mt-4 text-label text-muted-foreground">Preparing your printout…</p>
</div>
