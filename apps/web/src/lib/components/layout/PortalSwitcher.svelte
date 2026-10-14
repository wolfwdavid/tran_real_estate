<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	// The Menu / Close icons are inline copies of Lucide `menu` and `x` (ISC licence, @lucide/svelte
	// 1.45.0 path data), not @lucide/svelte imports. This header is on every marketing page, and the
	// two imports alone pulled Lucide's shared Icon runtime (~1.7 KB gz) into the initial JS of the
	// budget-gated tool pages, which use no other @lucide/svelte icon (see ToolIcon.svelte).

	let { showSettings = false }: { showSettings?: boolean } = $props();

	let open = $state(false);
	let hydrated = $state(false);
	let button: HTMLButtonElement | undefined = $state();

	const portals = [
		{ href: resolve('/renter/'), label: 'Renter', id: '/(app)/renter' },
		{ href: resolve('/investor/'), label: 'Investor', id: '/(app)/investor' },
		{ href: resolve('/agent/'), label: 'Agent', id: '/(app)/agent' }
	];
	const settings = { href: resolve('/settings/'), label: 'Settings', id: '/(app)/settings' };

	// Compare route ids so aria-current is already present in the prerendered HTML under any base.
	// A portal's own sub-pages (e.g. /renter/shortlist/) mark it as the current section with
	// aria-current="true": the link is not the current page, but it is where the visitor is.
	const current = (id: string) =>
		page.route.id === id ? 'page' : page.route.id?.startsWith(`${id}/`) ? 'true' : undefined;

	onMount(() => {
		hydrated = true;
		// Close the menu whenever the viewport crosses 640px. A plain matchMedia listener, not
		// svelte/reactivity's MediaQuery: that import put the shared reactivity chunk (~1.1 KB gz)
		// into the initial JS of every page, including the budget-gated tool pages.
		const wide = matchMedia('(min-width: 640px)');
		const close = () => (open = false);
		wide.addEventListener('change', close);
		return () => wide.removeEventListener('change', close);
	});
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
					class="inline-flex min-h-11 items-center px-4 text-body underline-offset-[6px] hover:underline aria-[current]:font-semibold aria-[current]:underline aria-[current]:decoration-primary aria-[current]:decoration-2"
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
					class="inline-flex min-h-11 items-center px-4 text-body text-muted-foreground underline-offset-[6px] hover:underline aria-[current]:font-semibold aria-[current]:underline aria-[current]:decoration-primary aria-[current]:decoration-2"
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
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class={['lucide', open ? 'lucide-x' : 'lucide-menu']}
			aria-hidden="true"
			focusable="false"
		>
			{#if open}
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			{:else}
				<path d="M4 5h16" />
				<path d="M4 12h16" />
				<path d="M4 19h16" />
			{/if}
		</svg>{open ? 'Close' : 'Menu'}
	</button>

	<ul id="portal-menu" class="-mx-6 basis-full bg-surface sm:hidden md:-mx-8" hidden={!open}>
		{#each portals as p (p.id)}
			<li class="border-t border-border">
				<a
					href={p.href}
					aria-current={current(p.id)}
					class="flex min-h-12 items-center border-l-4 border-transparent px-4 text-body aria-[current]:border-primary aria-[current]:font-semibold"
					>{p.label}</a
				>
			</li>
		{/each}
		{#if showSettings}
			<li class="border-t border-border">
				<a
					href={settings.href}
					aria-current={current(settings.id)}
					class="flex min-h-12 items-center border-l-4 border-transparent px-4 text-body text-muted-foreground aria-[current]:border-primary aria-[current]:font-semibold"
					>{settings.label}</a
				>
			</li>
		{/if}
	</ul>
</nav>
