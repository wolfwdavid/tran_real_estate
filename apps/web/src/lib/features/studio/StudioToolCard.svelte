<script lang="ts">
	// 09-UI-SPEC "StudioToolCard": the Phase 7 OverviewCard pattern. One stretched link (one tab
	// stop, one accessible name); the focus ring is drawn on the card through :has(a:focus-visible).
	// The meta line is live data from the hub (drafts or snapshots saved).
	import type { Component } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let {
		href,
		title,
		description,
		meta,
		linkText,
		icon: Icon
	}: {
		href: string;
		title: string;
		description: string;
		meta: string;
		linkText: string;
		icon: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
	} = $props();
</script>

<div
	class="group relative flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-card transition-[box-shadow,transform] duration-200 ease-out focus-within:shadow-card-hover hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring motion-safe:focus-within:-translate-y-0.5 motion-safe:hover:-translate-y-0.5"
	data-studio-tool-card
>
	<Icon size={24} class="text-secondary" aria-hidden="true" />
	<h2 class="text-body font-semibold text-foreground">{title}</h2>
	<p class="text-body text-muted-foreground">{description}</p>
	<p class="text-label text-muted-foreground tabular-nums" data-studio-tool-meta>{meta}</p>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve() output -->
	<a
		{href}
		class="mt-auto inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline decoration-1 underline-offset-[3px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
		>{linkText}<ArrowRight size={16} aria-hidden="true" /></a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>
