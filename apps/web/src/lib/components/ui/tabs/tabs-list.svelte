<script lang="ts">
	// Reconciled: a plain row on a 1px `border` baseline (no pill background, no muted fill). The
	// selected trigger draws its 2px `foreground` underline over the baseline.
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps }: TabsPrimitive.ListProps = $props();
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	class={cn('flex w-full flex-wrap items-end gap-2 border-b border-border', className)}
	{...restProps}
/>
