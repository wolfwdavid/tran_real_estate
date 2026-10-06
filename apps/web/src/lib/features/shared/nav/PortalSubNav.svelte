<script lang="ts">
	// The shared portal sub-navigation (07-UI-SPEC "PortalSubNav"), reusable by every portal. It
	// holds no portal-specific code: the caller passes the accessible name and the items.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { currentItemIndex, routeIdToPath, type SubNavItem } from './nav';

	let {
		label,
		items,
		currentPath
	}: {
		/** The landmark's accessible name, e.g. "Investor". */
		label: string;
		items: readonly SubNavItem[];
		/**
		 * Base-less pathname of the current page. Defaults to the route id's path, which is known
		 * while prerendering under any base (resolve() and base are relative there).
		 */
		currentPath?: string;
	} = $props();

	const current = $derived(
		currentItemIndex(items, currentPath ?? routeIdToPath(page.route.id) ?? '', '')
	);
	// Items carry base-less pathnames; resolve() adds the base (relative while prerendering). Its
	// typed overloads accept one literal route at a time, so a portal-agnostic list widens it.
	const resolvePath = resolve as (path: string) => string;
	const hrefOf = (item: SubNavItem) => resolvePath(item.href);
</script>

<nav aria-label={label} class="mb-6 border-b border-border">
	<ul class="flex flex-wrap items-center">
		{#each items as item, i (item.href)}
			<li>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefOf() is resolve() -->
				<a
					href={hrefOf(item)}
					aria-current={i === current ? 'page' : undefined}
					class="inline-flex min-h-11 items-center px-4 text-base leading-[1.6] text-foreground underline-offset-[6px] hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2"
					>{item.label}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</li>
		{/each}
	</ul>
</nav>
