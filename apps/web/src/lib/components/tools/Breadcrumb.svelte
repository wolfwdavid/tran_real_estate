<script lang="ts">
	// UI-SPEC "Tool pages" item 1: Home → Tools → current page. On the /tools/ hub the current page
	// IS "Tools", so the trail is Home → Tools (current) with no Tools link. Shared by the hub and
	// the calculator pages, so it imports only the tiny meta module (see content/tools/meta.ts).
	import { resolve } from '$app/paths';
	import { CRUMBS } from '$lib/content/tools/meta';

	let { current }: { current: string } = $props();

	const isHub = $derived(current === CRUMBS.tools);
	const link = 'inline-flex min-h-11 items-center text-primary underline';
</script>

<!-- Lucide ChevronRight (ISC), inline. -->
{#snippet chevron()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="lucide lucide-chevron-right"
		aria-hidden="true"
		focusable="false"><path d="m9 18 6-6-6-6" /></svg
	>
{/snippet}

<nav aria-label="Breadcrumb" class="pt-6">
	<ol class="flex flex-wrap items-center gap-1 text-label">
		<li><a href={resolve('/')} class={link}>{CRUMBS.home}</a></li>
		<li aria-hidden="true" class="inline-flex text-muted-foreground">
			{@render chevron()}
		</li>
		{#if !isHub}
			<li><a href={resolve('/tools/')} class={link}>{CRUMBS.tools}</a></li>
			<li aria-hidden="true" class="inline-flex text-muted-foreground">
				{@render chevron()}
			</li>
		{/if}
		<li aria-current="page" class="text-foreground">{current}</li>
	</ol>
</nav>
