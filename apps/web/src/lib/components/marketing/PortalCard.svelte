<script lang="ts">
	import type { Component } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let {
		title,
		body,
		href,
		linkLabel,
		mark: Mark
	}: {
		title: string;
		body: string;
		href: string;
		linkLabel: string;
		mark: Component;
	} = $props();
</script>

<!--
	Whole-card click target: the single link's ::after stretches over the card, so there is
	one tab stop and one accessible name. The focus ring is drawn on the card via
	:has(a:focus-visible), which is why the link suppresses its own outline.
-->
<article
	class="group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-card transition-[box-shadow,transform] duration-200 ease-out focus-within:shadow-card-hover hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring motion-safe:focus-within:-translate-y-0.5 motion-safe:hover:-translate-y-0.5"
>
	<div class="flex size-24 items-center justify-center rounded-full bg-accent-surface">
		<Mark />
	</div>
	<h3 class="font-display text-heading font-semibold">{title}</h3>
	<p class="text-body text-muted-foreground">{body}</p>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve() output -->
	<a
		{href}
		class="mt-auto inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline decoration-1 underline-offset-[3px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
		>{linkLabel}<ArrowRight size={16} aria-hidden="true" /></a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</article>
