<script lang="ts">
	// UI-SPEC "Tool pages" item 1: Home → Tools → current page. On the /tools/ hub the current page
	// IS "Tools", so the trail is Home → Tools (current) with no Tools link.
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { SHARED_TOOL_COPY as C } from '$lib/content/tools';

	let { current }: { current: string } = $props();

	const isHub = $derived(current === C.crumbTools);
	const link = 'inline-flex min-h-11 items-center text-primary underline';
</script>

<nav aria-label="Breadcrumb" class="pt-6">
	<ol class="flex flex-wrap items-center gap-1 text-label">
		<li><a href={resolve('/')} class={link}>{C.crumbHome}</a></li>
		<li aria-hidden="true" class="inline-flex text-muted-foreground">
			<ChevronRight size={16} aria-hidden="true" />
		</li>
		{#if !isHub}
			<li><a href={resolve('/tools/')} class={link}>{C.crumbTools}</a></li>
			<li aria-hidden="true" class="inline-flex text-muted-foreground">
				<ChevronRight size={16} aria-hidden="true" />
			</li>
		{/if}
		<li aria-current="page" class="text-foreground">{current}</li>
	</ol>
</nav>
