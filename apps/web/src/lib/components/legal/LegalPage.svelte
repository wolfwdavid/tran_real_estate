<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		docTitle,
		description,
		children
	}: { title: string; docTitle: string; description: string; children: Snippet } = $props();

	// Verbatim UI-SPEC notice line, kept on one line so it stays searchable.
	const notice =
		'This page explains, in plain language, how Tran Real Estate Tools works. It is not legal advice.';
</script>

<svelte:head>
	<title>{docTitle}</title>
	<meta name="description" content={description} />
</svelte:head>

<article class="legal mx-auto max-w-page px-6 py-12 md:px-8 md:py-16">
	<div class="max-w-reading">
		<h1 class="font-display text-display font-semibold">{title}</h1>
		<p class="mt-4 text-label font-semibold text-muted-foreground">Last updated: 4 October 2026</p>
		<p class="mt-4 text-muted-foreground">{notice}</p>
		{@render children()}
	</div>
</article>

<style>
	.legal :global(h2) {
		margin-top: 48px;
		font-family: var(--font-display);
		font-size: 1.5rem;
		line-height: 1.25;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.legal :global(h3) {
		margin-top: 32px;
		font-weight: 600;
	}
	.legal :global(p),
	.legal :global(ul) {
		margin-top: 16px;
	}
	.legal :global(ul) {
		list-style: disc;
		padding-left: 24px;
	}
	.legal :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
		overflow-wrap: anywhere;
	}
	@media (hover: hover) {
		.legal :global(a:hover) {
			color: var(--color-primary-hover);
			text-decoration-thickness: 2px;
		}
	}
</style>
