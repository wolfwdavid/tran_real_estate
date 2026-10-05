<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import PopoverPortal from './popover-portal.svelte';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 8,
		align = 'center',
		collisionPadding = 16,
		portalProps,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
	} = $props();
</script>

<!-- Phase 5 reconciliation: card surface, 1px border, radius-lg, shadow-card-hover, 16px padding,
     320px wide capped at 100vw - 32px, Phase 2 outline focus, fade-only motion under motion-safe.
     Font size uses text-base + leading (not text-body) so tailwind-merge keeps the colour class. -->
<PopoverPortal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		{collisionPadding}
		class={cn(
			'z-50 flex w-80 max-w-[calc(100vw-2rem)] origin-(--bits-popover-content-transform-origin) flex-col gap-2 rounded-lg border border-border bg-popover p-4 text-base leading-[1.6] text-popover-foreground shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:duration-150 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0',
			className
		)}
		{...restProps}
	/>
</PopoverPortal>
