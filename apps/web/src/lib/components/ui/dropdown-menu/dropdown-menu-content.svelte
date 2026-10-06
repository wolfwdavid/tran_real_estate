<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		portalProps,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
	} = $props();
</script>

<!-- Phase 8 reconciliation (08-UI-SPEC dropdown-menu): popover (= card) surface, 1px border, radius-lg,
     shadow-card-hover, 8px padding, Phase 2 outline focus, fade-only motion under motion-safe.
     Font size uses text-base + leading (not text-body) so tailwind-merge keeps the colour class. -->

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{align}
		class={cn(
			'z-50 max-h-(--bits-dropdown-menu-content-available-height) max-w-[calc(100vw-2rem)] min-w-56 origin-(--bits-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-popover p-2 text-base leading-[1.6] text-popover-foreground shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:duration-150 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 data-closed:overflow-hidden motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0',
			className
		)}
		{...restProps}
	/>
</DropdownMenuPortal>
