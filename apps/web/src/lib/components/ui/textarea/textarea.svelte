<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		'data-slot': dataSlot = 'textarea',
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<!-- Reconciled like the Phase 3 input: card fill, 1px input border, radius-md, 16px padding,
     Body 16/1.6, 240px min height, vertical resize, destructive border when aria-invalid. -->
<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		'block min-h-60 w-full min-w-0 resize-y rounded-md border border-input bg-card p-4 text-base leading-[1.6] text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-destructive',
		className
	)}
	bind:value
	{...restProps}></textarea>
