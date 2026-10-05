<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let {
		href,
		variant = 'primary',
		arrow = false,
		class: className = '',
		children
	}: {
		href: string;
		variant?: 'primary' | 'secondary';
		arrow?: boolean;
		class?: string;
		children: Snippet;
	} = $props();

	const variants = {
		primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
		secondary: 'border border-border-strong text-foreground hover:bg-surface'
	};
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve() output or a #fragment -->
<a
	{href}
	class={[
		'inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded-md px-6 text-body font-semibold transition-colors duration-150 ease-out motion-safe:active:translate-y-px',
		variants[variant],
		className
	]}
>
	{@render children()}
	{#if arrow}<ArrowRight size={16} aria-hidden="true" />{/if}
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
