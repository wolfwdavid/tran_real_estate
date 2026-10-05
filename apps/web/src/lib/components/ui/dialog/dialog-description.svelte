<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
	bind:ref
	data-slot="dialog-description"
	class={cn(
		'text-body text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-primary-hover',
		className
	)}
	{...restProps}
/>
