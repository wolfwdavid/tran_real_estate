<script lang="ts">
	// Reconciled: 44px tall, Body 16/400 muted → 600 `foreground` when selected, with a 2px
	// `foreground` bottom border (the non-color cue is the weight + underline). No pill fill, no
	// shadow, color-only transition (no movement), and the Phase 2 outline focus ring.
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.TriggerProps = $props();
</script>

<TabsPrimitive.Trigger
	bind:ref
	data-slot="tabs-trigger"
	class={cn(
		'-mb-px inline-flex h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center gap-2 border-b-2 border-transparent px-4 text-base leading-[1.6] font-normal whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
		className
	)}
	{...restProps}
/>
