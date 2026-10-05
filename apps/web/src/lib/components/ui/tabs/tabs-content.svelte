<script lang="ts">
	// Reconciled: the panel is focusable (Tab moves into it) with the Phase 2 outline focus ring.
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.ContentProps = $props();
</script>

<TabsPrimitive.Content
	bind:ref
	data-slot="tabs-content"
	class={cn(
		'flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
		className
	)}
	{...restProps}
/>
