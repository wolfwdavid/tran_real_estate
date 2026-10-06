<script lang="ts">
	// Centered empty block: 24px secondary icon, Heading 24/600 title, muted body, then actions that
	// stack full width below 640px and sit inline with a 16px gap from 640px.
	import type { Component, Snippet } from 'svelte';

	let {
		icon: Icon,
		title,
		headingLevel = 2,
		body,
		children
	}: {
		icon: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
		title: string;
		headingLevel?: 2 | 3;
		body: string;
		children?: Snippet;
	} = $props();

	const headingClass = 'font-display text-heading font-semibold text-foreground';
</script>

<div class="mx-auto flex max-w-[480px] flex-col items-center gap-4 py-12 text-center">
	<Icon size={24} class="text-secondary" aria-hidden="true" />
	{#if headingLevel === 3}
		<h3 class={headingClass}>{title}</h3>
	{:else}
		<h2 class={headingClass}>{title}</h2>
	{/if}
	<p class="text-base leading-[1.6] text-muted-foreground">{body}</p>
	{#if children}
		<div
			class="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center [&>*]:w-full sm:[&>*]:w-auto"
		>
			{@render children()}
		</div>
	{/if}
</div>
