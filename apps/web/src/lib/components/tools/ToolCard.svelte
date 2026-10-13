<script lang="ts">
	// UI-SPEC "ToolCard": the Phase 2 PortalCard pattern without a property mark. One stretched
	// link, so the whole card is one tab stop with one accessible name.
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Wallet from '@lucide/svelte/icons/wallet';
	import Percent from '@lucide/svelte/icons/percent';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Landmark from '@lucide/svelte/icons/landmark';

	let {
		title,
		body,
		href,
		icon
	}: {
		title: string;
		body: string;
		/** resolve() output. */
		href: string;
		icon: 'wallet' | 'percent' | 'banknote' | 'landmark';
	} = $props();

	const icons = { wallet: Wallet, percent: Percent, banknote: Banknote, landmark: Landmark };
	const Icon = $derived(icons[icon]);
</script>

<article
	class="relative flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-card transition-[box-shadow,transform] duration-200 ease-out focus-within:shadow-card-hover hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring motion-safe:focus-within:-translate-y-0.5 motion-safe:hover:-translate-y-0.5"
>
	<Icon size={24} class="text-secondary" aria-hidden="true" />
	<h2 class="font-display text-heading font-semibold">{title}</h2>
	<p class="text-body text-muted-foreground">{body}</p>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve() output -->
	<a
		{href}
		class="mt-auto inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline decoration-1 underline-offset-[3px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
		>Open the calculator<ArrowRight size={16} aria-hidden="true" /></a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</article>
