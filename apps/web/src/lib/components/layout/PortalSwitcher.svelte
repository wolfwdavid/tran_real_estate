<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';

	let { showSettings = false }: { showSettings?: boolean } = $props();

	const wide = new MediaQuery('min-width: 640px', false);
	// Writable $derived: re-derives to closed whenever the viewport crosses 640px, and stays
	// assignable for the toggle. ($state + $effect trips eslint svelte/prefer-writable-derived.)
	let open = $derived.by(() => {
		void wide.current;
		return false;
	});
	let hydrated = $state(false);
	let button: HTMLButtonElement | undefined = $state();

	const portals = [
		{ href: resolve('/renter/'), label: 'Renter', id: '/(app)/renter' },
		{ href: resolve('/investor/'), label: 'Investor', id: '/(app)/investor' },
		{ href: resolve('/agent/'), label: 'Agent', id: '/(app)/agent' }
	];
	const settings = { href: resolve('/settings/'), label: 'Settings', id: '/(app)/settings' };

	// Compare route ids so aria-current is already present in the prerendered HTML under any base.
	const current = (id: string) => (page.route.id === id ? 'page' : undefined);

	onMount(() => (hydrated = true));
	afterNavigate(() => (open = false));

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			button?.focus();
		}
	}
</script>

<svelte:window {onkeydown} />

<!-- The nav wraps the whole header row so the full-width mobile panel stays inside one
     Portals landmark at every width. -->
<nav
	aria-label="Portals"
	class="mx-auto flex max-w-page flex-wrap items-center px-6 md:px-8"
	data-hydrated={hydrated || undefined}
>
	<a
		href={resolve('/')}
		class="mr-auto inline-flex min-h-16 items-center font-display text-body font-semibold sm:text-heading"
		>Tran Real Estate Tools</a
	>

	<ul class="hidden items-center sm:flex">
		{#each portals as p (p.id)}
			<li>
				<a
					href={p.href}
					aria-current={current(p.id)}
					class="inline-flex min-h-11 items-center px-4 text-body underline-offset-[6px] hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2"
					>{p.label}</a
				>
			</li>
		{/each}
		{#if showSettings}
			<li aria-hidden="true" class="mx-2 h-6 w-px bg-border"></li>
			<li>
				<a
					href={settings.href}
					aria-current={current(settings.id)}
					class="inline-flex min-h-11 items-center px-4 text-body text-muted-foreground underline-offset-[6px] hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2"
					>{settings.label}</a
				>
			</li>
		{/if}
	</ul>

	<button
		bind:this={button}
		type="button"
		class="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md border border-border-strong px-3 text-body sm:hidden"
		aria-expanded={open}
		aria-controls="portal-menu"
		onclick={() => (open = !open)}
	>
		{#if open}<X size={20} aria-hidden="true" />Close{:else}<Menu
				size={20}
				aria-hidden="true"
			/>Menu{/if}
	</button>

	<ul id="portal-menu" class="-mx-6 basis-full bg-surface sm:hidden md:-mx-8" hidden={!open}>
		{#each portals as p (p.id)}
			<li class="border-t border-border">
				<a
					href={p.href}
					aria-current={current(p.id)}
					class="flex min-h-12 items-center border-l-4 border-transparent px-4 text-body aria-[current=page]:border-primary aria-[current=page]:font-semibold"
					>{p.label}</a
				>
			</li>
		{/each}
		{#if showSettings}
			<li class="border-t border-border">
				<a
					href={settings.href}
					aria-current={current(settings.id)}
					class="flex min-h-12 items-center border-l-4 border-transparent px-4 text-body text-muted-foreground aria-[current=page]:border-primary aria-[current=page]:font-semibold"
					>{settings.label}</a
				>
			</li>
		{/if}
	</ul>
</nav>
